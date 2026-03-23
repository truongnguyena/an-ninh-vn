require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const db = require('./db');
const gameEngine = require('./gameEngine');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist')));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Memory State
let matchmakingQueue = [];
let activeGames = {}; // roomId -> {...}
let playerToGame = {}; // socketId -> roomId
let connectedPlayers = {}; // socketId -> { username, uid, score }
let pendingChallenges = {}; // targetSocketId -> challengerSocketId
let sepayClient = null;

async function getSepayClient() {
    if (sepayClient) return sepayClient;
    const mod = await import('sepay-pg-node');
    const { SePayPgClient } = mod;
    const merchantId = process.env.SEPAY_MERCHANT_ID || '';
    const secretKey = process.env.SEPAY_SECRET_KEY || '';
    const env = /^SP-LIVE-/i.test(merchantId) || /^spsk_live_/i.test(secretKey) ? 'production' : 'sandbox';

    sepayClient = new SePayPgClient({
        env,
        merchant_id: merchantId,
        secret_key: secretKey
    });
    return sepayClient;
}

function normalizeDonorName(raw) {
    if (!raw) return 'Nha hao tam';
    const cleaned = raw.replace(/[^\p{L}\p{N}\s_-]/gu, '').trim();
    return cleaned || 'Nha hao tam';
}

function extractDonorName(content = '') {
    const match = content.match(/donate[:\-\s]+([^\n\r]+)/i);
    if (!match) return 'Nha hao tam';
    return normalizeDonorName(match[1]);
}

function isPlayerBusy(socketId) {
    return Boolean(playerToGame[socketId] || matchmakingQueue.includes(socketId));
}

function getLobbyPlayers(forSocketId) {
    return Object.entries(connectedPlayers)
        .filter(([sid]) => sid !== forSocketId)
        .map(([sid, p]) => ({
            socketId: sid,
            username: p.username,
            uid: p.uid,
            score: p.score,
            inQueue: matchmakingQueue.includes(sid),
            inGame: Boolean(playerToGame[sid])
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 25);
}

function emitLobbyState() {
    const queueCount = matchmakingQueue.length;
    const onlineCount = Object.keys(connectedPlayers).length;
    const inGameCount = Object.keys(playerToGame).length;
    io.emit('lobby_stats', { queueCount, onlineCount, inGameCount });
    Object.keys(connectedPlayers).forEach((sid) => {
        io.to(sid).emit('online_players', getLobbyPlayers(sid));
    });
}

function startGameBetween(p1, p2) {
    const roomId = `game_${Date.now()}_${Math.random()}`;
    activeGames[roomId] = {
        roomId,
        p1,
        p2,
        players: {
            [p1]: { username: connectedPlayers[p1].username, state: gameEngine.createWebsiteState() },
            [p2]: { username: connectedPlayers[p2].username, state: gameEngine.createWebsiteState() }
        }
    };

    playerToGame[p1] = roomId;
    playerToGame[p2] = roomId;
    matchmakingQueue = matchmakingQueue.filter(id => id !== p1 && id !== p2);
    delete pendingChallenges[p1];
    delete pendingChallenges[p2];

    io.to(p1).emit('game_start', {
        opponent: connectedPlayers[p2].username,
        opponentUid: connectedPlayers[p2].uid,
        myState: activeGames[roomId].players[p1].state,
        enemyState: getPublicEnemyState(activeGames[roomId].players[p2].state)
    });
    io.to(p2).emit('game_start', {
        opponent: connectedPlayers[p1].username,
        opponentUid: connectedPlayers[p1].uid,
        myState: activeGames[roomId].players[p2].state,
        enemyState: getPublicEnemyState(activeGames[roomId].players[p1].state)
    });
    emitLobbyState();
}

app.post('/webhooks/sepay', (req, res) => {
    const payload = req.body || {};
    const transferType = (payload.transferType || '').toLowerCase();
    const transferAmount = Number(payload.transferAmount || 0);

    if (transferType !== 'in' || transferAmount <= 0) {
        return res.status(200).json({ success: true, ignored: true });
    }

    const donation = db.addDonation({
        donorName: extractDonorName(payload.content || payload.description || ''),
        amount: transferAmount,
        note: payload.content || '',
        gateway: payload.gateway || '',
        transactionId: payload.id ? String(payload.id) : '',
        transactionDate: payload.transactionDate || ''
    });

    io.emit('recent_donations', db.getRecentDonations(8));
    io.emit('donation_received', donation);

    return res.status(200).json({ success: true });
});

app.post('/api/donate/checkout', async (req, res) => {
    try {
        const merchantId = process.env.SEPAY_MERCHANT_ID;
        const secretKey = process.env.SEPAY_SECRET_KEY;
        if (!merchantId || !secretKey) {
            return res.status(500).json({
                success: false,
                message: 'SePay chua duoc cau hinh. Thieu SEPAY_MERCHANT_ID hoac SEPAY_SECRET_KEY.'
            });
        }

        const amount = Number(req.body?.amount || 10000);
        const donorName = normalizeDonorName(req.body?.donorName || 'Nha hao tam');
        if (!Number.isFinite(amount) || amount < 2000) {
            return res.status(400).json({ success: false, message: 'So tien donate toi thieu la 2,000 VND.' });
        }

        const client = await getSepayClient();
        const checkoutURL = client.checkout.initCheckoutUrl();
        const invoice = `DONATE_${Date.now()}`;
        const appBase = 'http://localhost:5173';
        const checkoutFormfields = client.checkout.initOneTimePaymentFields({
            payment_method: 'BANK_TRANSFER',
            order_invoice_number: invoice,
            order_amount: amount,
            currency: 'VND',
            order_description: `DONATE:${donorName} | ${invoice}`,
            success_url: `${appBase}/?payment=success`,
            error_url: `${appBase}/?payment=error`,
            cancel_url: `${appBase}/?payment=cancel`
        });

        return res.json({ success: true, checkoutURL, checkoutFormfields });
    } catch (error) {
        console.error('SePay checkout init failed:', error);
        return res.status(500).json({ success: false, message: 'Khong the tao link thanh toan SePay.' });
    }
});

// Global game loop tick for DoTs/effects every 2.5 seconds.
setInterval(() => {
    for (const roomId in activeGames) {
        const game = activeGames[roomId];
        if (!game || !game.players || !game.players[game.p1] || !game.players[game.p2]) continue;

        const p1Result = gameEngine.processTick(game.players[game.p1].state);
        const p2Result = gameEngine.processTick(game.players[game.p2].state);

        p1Result.forEach(msg => io.to(game.p1).emit('terminal_output', { text: msg, type: 'warning' }));
        p2Result.forEach(msg => io.to(game.p2).emit('terminal_output', { text: msg, type: 'warning' }));

        if (p1Result.length > 0 || p2Result.length > 0) {
            io.to(game.p1).emit('state_update', {
                myState: game.players[game.p1].state,
                enemyState: getPublicEnemyState(game.players[game.p2].state)
            });
            io.to(game.p2).emit('state_update', {
                myState: game.players[game.p2].state,
                enemyState: getPublicEnemyState(game.players[game.p1].state)
            });

            checkWinLoss(roomId);
        }
    }
}, 2500);

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Initial data load
    socket.emit('top_players', db.getTopUsers(5));
    socket.emit('recent_donations', db.getRecentDonations(8));
    socket.emit('lobby_stats', { queueCount: matchmakingQueue.length, onlineCount: Object.keys(connectedPlayers).length, inGameCount: Object.keys(playerToGame).length });
    socket.emit('online_players', []);

    socket.on('register', ({ username, password }) => {
        if (!username || !password) return socket.emit('register_error', 'Thong tin khong hop le');
        if (db.register(username, password)) {
            socket.emit('register_success');
            io.emit('top_players', db.getTopUsers(5));
        } else {
            socket.emit('register_error', 'Ten tai khoan da ton tai');
        }
    });

    socket.on('login', ({ username, password }) => {
        const user = db.login(username, password);
        if (user) {
            connectedPlayers[socket.id] = { username, uid: user.uid, score: user.score };
            socket.emit('login_success', { username, score: user.score, uid: user.uid });
            emitLobbyState();
        } else {
            socket.emit('login_error', 'Sai ten dang nhap hoac mat khau');
        }
    });

    socket.on('find_match', () => {
        const me = connectedPlayers[socket.id];
        if (!me) return;

        if (matchmakingQueue.includes(socket.id)) return;
        if (playerToGame[socket.id]) return;

        if (matchmakingQueue.length > 0) {
            const opponentId = matchmakingQueue.shift();
            // Validate opponent still connected and logged in
            if (!connectedPlayers[opponentId]) {
                emitLobbyState();
                return;
            }
            startGameBetween(opponentId, socket.id);
        } else {
            matchmakingQueue.push(socket.id);
            socket.emit('waiting_for_match');
            emitLobbyState();
        }
    });

    socket.on('command', (cmdStr) => {
        const roomId = playerToGame[socket.id];
        if (!roomId) return socket.emit('terminal_output', { text: 'Ban chua o trong tran dau nao.', type: 'error' });

        const game = activeGames[roomId];
        const isP1 = game.p1 === socket.id;
        const myId = socket.id;
        const enemyId = isP1 ? game.p2 : game.p1;

        const myData = game.players[myId];
        const enemyData = game.players[enemyId];

        // Firewall is now Structural, so no more HP drain per turn
        // Just empty here

        const result = gameEngine.processCommand(cmdStr, myData.state, enemyData.state);

        if (result.error) {
            socket.emit('terminal_output', { text: result.error, type: 'error' });
        } else {
            socket.emit('terminal_output', { text: result.result, type: result.type, damage: result.damage });
            
            // If enemy or self state affected
            socket.emit('state_update', {
                myState: myData.state,
                enemyState: getPublicEnemyState(enemyData.state)
            });
            io.to(enemyId).emit('state_update', {
                myState: enemyData.state,
                enemyState: getPublicEnemyState(myData.state)
            });
                
            if (result.type === 'success' && result.text && result.text.includes('Exploit')) {
                  io.to(enemyId).emit('terminal_output', { text: `[CRITICAL ALERT] Incoming Attack Detected! Infrastructure Compromised!`, type: 'error' });
            }

            checkWinLoss(roomId);
        }
    });

    socket.on('challenge_player', ({ targetUid }) => {
        const me = connectedPlayers[socket.id];
        if (!me) return;
        if (isPlayerBusy(socket.id)) return socket.emit('challenge_error', 'Ban dang o trong tran hoac hang cho.');
        const targetSocketId = Object.keys(connectedPlayers).find((sid) => connectedPlayers[sid].uid === targetUid);
        if (!targetSocketId || !connectedPlayers[targetSocketId]) return socket.emit('challenge_error', 'Khong tim thay nguoi choi.');
        if (targetSocketId === socket.id) return socket.emit('challenge_error', 'Khong the tu thach dau chinh minh.');
        if (isPlayerBusy(targetSocketId)) return socket.emit('challenge_error', 'Doi thu dang ban, thu lai sau.');

        pendingChallenges[targetSocketId] = socket.id;
        io.to(targetSocketId).emit('challenge_received', {
            fromUsername: me.username,
            fromUid: me.uid
        });
        socket.emit('challenge_sent', { targetUid });
    });

    socket.on('challenge_response', ({ fromUid, accepted }) => {
        const me = connectedPlayers[socket.id];
        if (!me) return;
        const challengerSocketId = Object.keys(connectedPlayers).find((sid) => connectedPlayers[sid].uid === fromUid);
        if (!challengerSocketId || pendingChallenges[socket.id] !== challengerSocketId) return;

        delete pendingChallenges[socket.id];
        if (!accepted) {
            io.to(challengerSocketId).emit('challenge_declined', { byUid: me.uid, byUsername: me.username });
            return;
        }
        if (isPlayerBusy(socket.id) || isPlayerBusy(challengerSocketId)) {
            io.to(challengerSocketId).emit('challenge_error', 'Mot trong hai nguoi choi dang ban.');
            return;
        }
        startGameBetween(challengerSocketId, socket.id);
    });

    socket.on('request_online_players', () => {
        socket.emit('online_players', getLobbyPlayers(socket.id));
        socket.emit('lobby_stats', { queueCount: matchmakingQueue.length, onlineCount: Object.keys(connectedPlayers).length, inGameCount: Object.keys(playerToGame).length });
    });

    socket.on('leave_game', () => {
        const roomId = playerToGame[socket.id];
        if (roomId) {
            const game = activeGames[roomId];
            const enemyId = game.p1 === socket.id ? game.p2 : game.p1;
            io.to(enemyId).emit('game_over', { result: 'win', message: 'Doi thu da roi tran. Ban chien thang!' });
            // Award fixed score? Or no score?
            endGame(roomId);
            emitLobbyState();
        }
    });

    socket.on('disconnect', () => {
        const roomId = playerToGame[socket.id];
        if (roomId) {
            const game = activeGames[roomId];
            if (game) {
                const enemyId = game.p1 === socket.id ? game.p2 : game.p1;
                io.to(enemyId).emit('game_over', { result: 'win', message: 'Doi thu mat ket noi. Ban chien thang!' });
                endGame(roomId);
            }
        }
        matchmakingQueue = matchmakingQueue.filter(id => id !== socket.id);
        delete connectedPlayers[socket.id];
        delete pendingChallenges[socket.id];
        Object.keys(pendingChallenges).forEach((targetId) => {
            if (pendingChallenges[targetId] === socket.id) delete pendingChallenges[targetId];
        });
        emitLobbyState();
    });
});

function checkWinLoss(roomId) {
    const game = activeGames[roomId];
    if (!game) return;

    let loserId = null;
    let winnerId = null;

    if (game.players[game.p1].state.hp <= 0 && game.players[game.p2].state.hp <= 0) {
        loserId = 'draw';
    } else if (game.players[game.p1].state.hp <= 0) {
        loserId = game.p1;
        winnerId = game.p2;
    } else if (game.players[game.p2].state.hp <= 0) {
        loserId = game.p2;
        winnerId = game.p1;
    }

    if (loserId) {
        if (loserId === 'draw') {
            io.to(game.p1).emit('game_over', { result: 'draw', message: 'Hai ben cung bi ha guc.' });
            io.to(game.p2).emit('game_over', { result: 'draw', message: 'Hai ben cung bi ha guc.' });
        } else {
            const winnerData = game.players[winnerId];
            const loserData = game.players[loserId];
            const loserUser = db.getUser(loserData.username);
            const loserScore = loserUser ? loserUser.score : 0;

            db.updateScore(winnerData.username, loserScore);
            db.deleteUser(loserData.username);

            io.to(winnerId).emit('game_over', { result: 'win', message: `Ban thang! Thu ve ${loserScore} diem tu doi thu.` });
            io.to(loserId).emit('game_over', { result: 'loss', message: 'Ban thua! Ha tang bi pha huy va tai khoan bi xoa.' });

            const winnerUser = db.getUser(winnerData.username);
            if (winnerUser && connectedPlayers[winnerId]) {
                connectedPlayers[winnerId].score = winnerUser.score;
            }
            io.to(winnerId).emit('login_success', { username: winnerData.username, score: winnerUser ? winnerUser.score : 0, uid: winnerUser ? winnerUser.uid : '' });
            io.to(loserId).emit('force_logout');
        }

        io.emit('top_players', db.getTopUsers(5));
        endGame(roomId);
        emitLobbyState();
    }
}

function getPublicEnemyState(state) {
    // Only return what the attacker would know without scanning
    return { 
        hp: state.hp, 
        maxHp: state.maxHp, 
        firewallHp: state.firewallHp,
        maxFirewallHp: state.maxFirewallHp
    };
}

function endGame(roomId) {
    const game = activeGames[roomId];
    if (game) {
        delete playerToGame[game.p1];
        delete playerToGame[game.p2];
        delete activeGames[roomId];
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
});
