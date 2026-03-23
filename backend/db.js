const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'database.json');

let db = { users: {}, donations: [] };
if (fs.existsSync(dbPath)) {
    try {
        db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        if (!db.users) db.users = {};
        if (!Array.isArray(db.donations)) db.donations = [];
    } catch(e) {
        console.error("Failed to parse db", e);
    }
}

function createUid() {
    return `UID-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function ensureUserSchema() {
    let changed = false;
    for (const username of Object.keys(db.users)) {
        const u = db.users[username];
        if (!u.uid) {
            u.uid = createUid();
            changed = true;
        }
        if (!u.createdAt) {
            u.createdAt = new Date().toISOString();
            changed = true;
        }
    }
    if (changed) saveDb();
}

ensureUserSchema();

function saveDb() {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function register(username, password) {
    if (db.users[username]) return false;
    db.users[username] = {
        password,
        score: 1000,
        uid: createUid(),
        createdAt: new Date().toISOString()
    };
    saveDb();
    return true;
}

function login(username, password) {
    const user = db.users[username];
    if (user && user.password === password) return user;
    return null;
}

function getUser(username) {
    return db.users[username];
}

function updateScore(username, change) {
    if (db.users[username]) {
        db.users[username].score += change;
        saveDb();
    }
}

function deleteUser(username) {
    if (db.users[username]) {
        delete db.users[username];
        saveDb();
    }
}

function getTopUsers(limit = 10) {
    return Object.keys(db.users)
        .map(u => ({ username: u, score: db.users[u].score, uid: db.users[u].uid }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

function getUserByUid(uid) {
    return Object.keys(db.users).find((username) => db.users[username].uid === uid);
}

function addDonation({ donorName, amount, note, gateway, transactionId, transactionDate }) {
    const donation = {
        id: transactionId || `donate_${Date.now()}`,
        donorName: donorName || 'Nha hao tam',
        amount: Number(amount) || 0,
        note: note || '',
        gateway: gateway || '',
        transactionDate: transactionDate || new Date().toISOString(),
        createdAt: new Date().toISOString()
    };

    db.donations.unshift(donation);
    db.donations = db.donations.slice(0, 100);
    saveDb();
    return donation;
}

function getRecentDonations(limit = 10) {
    return db.donations.slice(0, limit);
}

module.exports = {
    register,
    login,
    getUser,
    updateScore,
    deleteUser,
    getTopUsers,
    getUserByUid,
    addDonation,
    getRecentDonations
};
