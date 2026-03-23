import { io } from "socket.io-client";

// In production this would be configurable
const socket = io();


// DOM Elements
const authScreen = document.getElementById("auth-screen");
const gameScreen = document.getElementById("game-screen");
const txtUser = document.getElementById("username");
const txtPass = document.getElementById("password");
const btnLogin = document.getElementById("btn-login");
const btnRegister = document.getElementById("btn-register");
const btnLogout = document.getElementById("btn-logout");
const authError = document.getElementById("auth-error");
const leaderboardList = document.getElementById("leaderboard-list");
const donationList = document.getElementById("donation-list");
const donateWidget = document.getElementById("donate-widget");
const donateName = document.getElementById("donate-name");
const donateAmount = document.getElementById("donate-amount");
const btnDonate = document.getElementById("btn-donate");
const quickDonateButtons = document.querySelectorAll(".quick-donate");
const donationToast = document.getElementById("donation-toast");

const myUsernameStr = document.getElementById("my-username");
const myUidStr = document.getElementById("my-uid");
const myScoreStr = document.getElementById("my-score");
const btnMatch = document.getElementById("btn-match");
const matchStatus = document.getElementById("match-status");
const lobbyWaitingText = document.getElementById("lobby-waiting-text");
const lobbyPlayerList = document.getElementById("lobby-player-list");
const lobbyOnlineCount = document.getElementById("lobby-online-count");
const lobbyQueueCount = document.getElementById("lobby-queue-count");
const lobbyIngameCount = document.getElementById("lobby-ingame-count");
const authOnlineList = document.getElementById("auth-online-list");
const authOnlineCount = document.getElementById("auth-online-count");
const authQueueCount = document.getElementById("auth-queue-count");
const authIngameCount = document.getElementById("auth-ingame-count");

const targetPlaceholder = document.getElementById("target-placeholder");
const targetInfo = document.getElementById("target-info");

const myHp = document.getElementById("my-hp");
const myHpText = document.getElementById("my-hp-text");
const myFirewall = document.getElementById("my-firewall");
const myCredits = document.getElementById("my-credits");
const invMiner = document.getElementById("inv-miner");
const invHp = document.getElementById("inv-hp");
const invEmp = document.getElementById("inv-emp");
const myEffects = document.getElementById("my-effects");

const enemyUsername = document.getElementById("enemy-username");
const enemyUid = document.getElementById("enemy-uid");
const enemyHp = document.getElementById("enemy-hp");
const enemyHpText = document.getElementById("enemy-hp-text");
const enemyFirewall = document.getElementById("enemy-firewall");
const enemyEffects = document.getElementById("enemy-effects");
const fakeWebsite = document.getElementById("fake-website");
const glitchOverlay = document.getElementById("glitch-overlay");

const terminalOutput = document.getElementById("terminal-output");
const terminalInput = document.getElementById("terminal-input");
const cooldownOverlay = document.getElementById("cooldown-overlay");
const cooldownTimer = document.getElementById("cooldown-timer");

const btnShop = document.getElementById("btn-shop");
const modalCredits = document.getElementById("modal-credits");
const btnBuyItems = document.querySelectorAll(".btn-buy");
const quickCmdButtons = document.querySelectorAll(".quick-cmd");

let inGame = false;
let cooldownInterval = null;
let toastTimeout = null;
let myUid = "";
const vndFormatter = new Intl.NumberFormat("vi-VN");
const backendUrl = "";
const MIN_DONATE = 2000;

const commandCategories = {
    exploit: "TAN CONG",
    spear: "TAN CONG",
    barrage: "TAN CONG",
    breach: "TAN CONG",
    bleed: "TAN CONG",
    pulse: "TAN CONG",
    ddos: "TAN CONG",
    virus: "TAN CONG",
    nuke: "TAN CONG",
    jam: "GAY NHIEU",
    sabotage: "GAY NHIEU",
    steal: "GAY NHIEU",
    scan: "TRINH SAT",
    probe: "TRINH SAT",
    ports: "TRINH SAT",
    patch: "PHONG THU",
    harden: "PHONG THU",
    reboot: "PHONG THU",
    firewall: "PHONG THU",
    heal: "PHONG THU",
    help: "TIEN ICH",
    guide: "TIEN ICH",
    status: "TIEN ICH",
    clear: "TIEN ICH",
    history: "TIEN ICH",
    buy: "TIEN ICH",
    use: "TIEN ICH",
    shop: "TIEN ICH",
    miner: "TIEN ICH",
    overclock: "TIEN ICH"
    ,
    frenzy: "DAC BIET",
    decoy: "DAC BIET",
    purge: "DAC BIET",
    gamble: "DAC BIET"
};

// Audio System
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const soundFX = {
    playTone: (freq, type, duration, vol) => {
        if(audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    },
    click: () => soundFX.playTone(800, 'square', 0.02, 0.02),
    success: () => { soundFX.playTone(600, 'sine', 0.1, 0.1); setTimeout(()=>soundFX.playTone(800, 'sine', 0.2, 0.1), 100); },
    error: () => { soundFX.playTone(150, 'sawtooth', 0.3, 0.1); },
    alarm: () => { soundFX.playTone(400, 'square', 0.1, 0.1); setTimeout(()=>soundFX.playTone(300, 'square', 0.3, 0.1), 100); }
};

function printLog(text, type = "info", instant = false) {
    const div = document.createElement("div");
    div.className = `log-${type}`;
    terminalOutput.appendChild(div);
    
    if (instant) {
        div.innerText = text;
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
        return;
    }

    let i = 0;
    const isError = type === 'error';
    const isSuccess = type === 'success';
    
    if (isError) soundFX.error();
    else if (isSuccess) soundFX.success();

    const interval = setInterval(() => {
        div.innerText += text.charAt(i);
        if(i % 3 === 0 && !isError && !isSuccess) soundFX.click(); // less click spam
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
        i++;
        if (i >= text.length) clearInterval(interval);
    }, 10);
}

function showDonationToast(message, tone = "default") {
    if (!donationToast) return;
    donationToast.innerText = message;
    donationToast.classList.remove("d-none");
    donationToast.style.borderColor = tone === "error" ? "rgba(255, 117, 117, 0.55)" : "rgba(117, 255, 117, 0.45)";
    donationToast.style.color = tone === "error" ? "#ffe0e0" : "#e8ffd8";
    donationToast.style.background = tone === "error" ? "rgba(40, 19, 19, 0.95)" : "rgba(26, 30, 22, 0.95)";

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => donationToast.classList.add("d-none"), 4500);
}

function getCommandCategory(cmdStr) {
    const cmd = String(cmdStr || "").trim().split(/\s+/)[0]?.toLowerCase();
    return commandCategories[cmd] || "KHAC";
}

function localizeServerText(text) {
    if (!text) return text;
    let t = String(text);
    const directMap = [
        [/Command not found:/gi, "Khong tim thay lenh:"],
        [/Empty command/gi, "Lenh rong"],
        [/Usage:/gi, "Cach dung:"],
        [/Insufficient Credits/gi, "Khong du Credits"],
        [/Target Firewall is active/gi, "Firewall doi thu dang hoat dong"],
        [/Port (\d+) is closed/gi, "Port $1 dang dong"],
        [/Port (\d+) is not open/gi, "Port $1 khong mo"],
        [/Target has no Credits to steal/gi, "Doi thu khong con Credits de rut"],
        [/No virus stacks detected/gi, "Khong co virus dang ton tai"],
        [/System integrity is already at maximum/gi, "Do ben he thong dang toi da"],
        [/Running Nmap stealth scan/gi, "Dang quet he thong doi thu"],
        [/Command rate limited/gi, "Lenh bi gioi han toc do"]
    ];
    for (const [pattern, replace] of directMap) t = t.replace(pattern, replace);
    return t;
}

function setLobbyCounts(stats = {}) {
    if (authOnlineCount) authOnlineCount.innerText = String(stats.onlineCount || 0);
    if (authQueueCount) authQueueCount.innerText = String(stats.queueCount || 0);
    if (authIngameCount) authIngameCount.innerText = String(stats.inGameCount || 0);
    if (lobbyOnlineCount) lobbyOnlineCount.innerText = String(stats.onlineCount || 0);
    if (lobbyQueueCount) lobbyQueueCount.innerText = String(stats.queueCount || 0);
    if (lobbyIngameCount) lobbyIngameCount.innerText = String(stats.inGameCount || 0);
}

function renderOnlinePlayers(players = []) {
    if (authOnlineList) {
        authOnlineList.innerHTML = players.length === 0
            ? `<li class="list-group-item text-muted">Chua co nguoi choi online.</li>`
            : players.slice(0, 8).map((p) => `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <span class="text-light">${p.username}</span>
                    <span class="badge bg-dark border">${p.uid}</span>
                </li>
            `).join("");
    }

    if (lobbyPlayerList) {
        lobbyPlayerList.innerHTML = players.length === 0
            ? `<div class="text-muted">Khong co nguoi choi kha dung.</div>`
            : players.slice(0, 12).map((p) => `
                <div class="lobby-player-row d-flex justify-content-between align-items-center mb-2">
                    <div>
                        <div class="text-light fw-bold">${p.username}</div>
                        <div class="small text-muted">${p.uid} • ${p.score} pts</div>
                    </div>
                    <button class="btn btn-sm btn-outline-info lobby-challenge-btn" data-uid="${p.uid}" ${p.inGame || p.inQueue ? "disabled" : ""}>
                        ${p.inGame ? "Dang dau" : p.inQueue ? "Dang cho" : "Thach dau"}
                    </button>
                </div>
            `).join("");
    }
}

function runLocalCommand(cmdStr) {
    const cmd = cmdStr.toLowerCase();

    if (cmd === "clear") {
        terminalOutput.innerHTML = "";
        printLog("Da xoa bo dem terminal.", "info", true);
        return true;
    }

    if (cmd === "history") {
        if (cmdHistory.length === 0) {
            printLog("Chua co lich su lenh.", "info", true);
            return true;
        }
        cmdHistory.forEach((h, i) => printLog(`${i + 1}. ${h}`, "self", true));
        return true;
    }

    return false;
}

function executeCommand(cmdStr) {
    if (!cmdStr || !inGame) return;
    const category = getCommandCategory(cmdStr);
    printLog(`[${category}] root@cyber:~# ${cmdStr}`, "self", true);

    if (runLocalCommand(cmdStr)) return;

    socket.emit("command", cmdStr);
    cmdHistory.push(cmdStr);
    historyIndex = cmdHistory.length;
}

// Shop Events
btnBuyItems.forEach(btn => {
    btn.onclick = () => {
        const item = btn.getAttribute("data-item");
        if(item === 'miner' || item === 'nuke') {
            socket.emit("command", item);
        } else {
            socket.emit("command", "buy " + item);
        }
    };
});

quickCmdButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        const cmd = btn.getAttribute("data-cmd");
        executeCommand(cmd);
        if (!terminalInput.disabled) {
            terminalInput.focus({ preventScroll: true });
        }
    });
});

// Authentication Let users spam enter
txtPass.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
         socket.emit("login", { username: txtUser.value, password: txtPass.value });
    }
});

btnLogin.onclick = () => {
    socket.emit("login", { username: txtUser.value, password: txtPass.value });
};

btnRegister.onclick = () => {
    socket.emit("register", { username: txtUser.value, password: txtPass.value });
};

btnLogout.onclick = () => {
    socket.emit("leave_game"); // If in game
    window.location.reload(); 
};

socket.on("register_success", () => authError.innerText = "Dang ky thanh cong. Ban co the dang nhap.");
socket.on("register_error", (msg) => authError.innerText = "Dang ky that bai: " + msg);
socket.on("login_success", ({ username, score, uid }) => {
    myUid = uid || "";
    myUsernameStr.innerText = username;
    if (myUidStr) myUidStr.innerText = myUid || "UID-NULL";
    myScoreStr.innerText = score;
    authScreen.classList.add("d-none");
    gameScreen.classList.remove("d-none");
    gameScreen.classList.add("d-flex");
    donateWidget?.classList.add("d-none");
    socket.emit("request_online_players");
});
socket.on("login_error", (msg) => authError.innerText = "Dang nhap that bai: " + msg);
socket.on("force_logout", () => {
    authScreen.classList.remove("d-none");
    gameScreen.classList.add("d-none");
    gameScreen.classList.remove("d-flex");
    donateWidget?.classList.remove("d-none");
    authError.innerText = "Tai khoan da bi xoa sau tran dau.";
});

socket.on("top_players", (players) => {
    leaderboardList.innerHTML = players.map((p, i) => `
        <li class="list-group-item d-flex justify-content-between align-items-center tracking-wide">
            <span><span class="text-accent fw-bold me-2">#${i+1}</span> ${p.username}</span>
            <span class="badge bg-secondary rounded-pill">${p.score} pt</span>
        </li>
    `).join('');
});

socket.on("lobby_stats", (stats) => {
    setLobbyCounts(stats);
});

socket.on("online_players", (players) => {
    renderOnlinePlayers(players);
});

function renderDonations(donations = []) {
    if (!donationList) return;
    if (!Array.isArray(donations) || donations.length === 0) {
        donationList.innerHTML = `<li class="list-group-item text-muted">Chua co donate nao.</li>`;
        return;
    }

    donationList.innerHTML = donations.slice(0, 8).map((d) => `
        <li class="list-group-item d-flex justify-content-between align-items-center tracking-wide">
            <span class="text-light">${d.donorName || 'Nha hao tam'}</span>
            <span class="badge bg-warning text-dark rounded-pill">${vndFormatter.format(Number(d.amount || 0))} VND</span>
        </li>
    `).join("");
}

socket.on("recent_donations", (donations) => {
    renderDonations(donations);
});

socket.on("donation_received", (donation) => {
    showDonationToast(`Cam on ${donation.donorName || "Nha hao tam"} da donate ${vndFormatter.format(Number(donation.amount || 0))} VND!`);
    if (inGame) {
        printLog(`[DONATE] ${donation.donorName || 'Nha hao tam'} vua ung ho ${vndFormatter.format(Number(donation.amount || 0))} VND. Cam on!`, "success", true);
    }
});

quickDonateButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        const amount = Number(btn.getAttribute("data-amount") || 0);
        if (amount > 0 && donateAmount) donateAmount.value = String(amount);
    });
});

btnDonate?.addEventListener("click", async () => {
    const donorName = (donateName?.value || "").trim() || "Nha hao tam";
    const amount = Number(donateAmount?.value || 10000);
    if (!Number.isFinite(amount) || amount < MIN_DONATE) {
        authError.innerText = `So tien donate toi thieu la ${vndFormatter.format(MIN_DONATE)} VND.`;
        return;
    }

    btnDonate.disabled = true;
    btnDonate.innerText = "Dang tao link...";
    authError.innerText = "";

    try {
        const resp = await fetch(`${backendUrl}/api/donate/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ donorName, amount })
        });
        const data = await resp.json();
        if (!resp.ok || !data.success) {
            throw new Error(data.message || "Khong tao duoc checkout SePay.");
        }

        const form = document.createElement("form");
        form.action = data.checkoutURL;
        form.method = "POST";
        form.target = "_blank";
        Object.keys(data.checkoutFormfields || {}).forEach((field) => {
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = field;
            input.value = data.checkoutFormfields[field];
            form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
        form.remove();
    } catch (error) {
        authError.innerText = `Loi donate: ${error.message}`;
        showDonationToast(`Loi donate: ${error.message}`, "error");
    } finally {
        btnDonate.disabled = false;
        btnDonate.innerText = "Donate ngay";
    }
});

lobbyPlayerList?.addEventListener("click", (e) => {
    const btn = e.target.closest(".lobby-challenge-btn");
    if (!btn) return;
    const targetUid = btn.getAttribute("data-uid");
    if (!targetUid) return;
    socket.emit("challenge_player", { targetUid });
});

socket.on("challenge_sent", ({ targetUid }) => {
    if (lobbyWaitingText) lobbyWaitingText.innerText = `Da gui thach dau toi ${targetUid}. Dang doi phan hoi...`;
});

socket.on("challenge_received", ({ fromUsername, fromUid }) => {
    const accepted = window.confirm(`${fromUsername} (${fromUid}) muon thach dau ban. Chap nhan?`);
    socket.emit("challenge_response", { fromUid, accepted });
});

socket.on("challenge_declined", ({ byUsername }) => {
    if (lobbyWaitingText) lobbyWaitingText.innerText = `${byUsername} da tu choi thach dau.`;
});

socket.on("challenge_error", (message) => {
    if (lobbyWaitingText) lobbyWaitingText.innerText = message || "Khong the thach dau luc nay.";
});

const paymentState = new URLSearchParams(window.location.search).get("payment");
if (paymentState === "success") {
    showDonationToast("Thanh toan thanh cong. He thong dang cho SePay gui webhook...");
} else if (paymentState === "error") {
    showDonationToast("Thanh toan that bai. Vui long thu lai.", "error");
} else if (paymentState === "cancel") {
    showDonationToast("Ban da huy giao dich donate.", "error");
}

// Matchmaking
btnMatch.onclick = () => {
    socket.emit("find_match");
};
socket.on("waiting_for_match", () => {
    matchStatus.innerText = "Dang tim doi thu...";
    btnMatch.disabled = true;
    if (lobbyWaitingText) lobbyWaitingText.innerText = "Ban da vao hang cho ngau nhien. Dang tim doi thu...";
});

// Game State Updates
socket.on("game_start", ({ opponent, opponentUid, myState, enemyState }) => {
    matchStatus.innerText = "Da tim thay doi thu. Bat dau giao tranh!";
    btnMatch.innerText = "Dang giao tranh";
    btnMatch.classList.replace("btn-accent", "btn-danger");
    inGame = true;
    
    // Setup UI
    targetPlaceholder.classList.add("d-none");
    targetInfo.classList.remove("d-none");
    enemyUsername.innerText = opponent;
    if (enemyUid) enemyUid.innerText = opponentUid || "UID-???";
    
    updateUI(myState, enemyState);
    
    // Enable Terminal
    terminalInput.disabled = false;
    btnShop.disabled = false;
    terminalInput.focus({ preventScroll: true });
    printLog("======================================", "info", true);
    printLog(`DA KET NOI HE THONG. DOI THU: ${opponent}`, "error");
    printLog("HE THONG SAN SANG. CHO LENH...", "success");
    printLog("Nhap 'help vi' hoac 'guide vi' de xem huong dan.", "info");
    printLog("======================================", "info", true);
    document.body.classList.add("combat-entry-flash");
    setTimeout(() => document.body.classList.remove("combat-entry-flash"), 800);
});

socket.on("state_update", ({ myState, enemyState }) => {
    updateUI(myState, enemyState);
});

socket.on("terminal_output", ({ text, type, damage }) => {
    printLog(localizeServerText(text), type);
    if (damage && damage > 0 && type !== 'warning') { // Enemy took damage from us
        soundFX.success();
    }
    if (type === 'warning' && damage) { // We took damage
         soundFX.alarm();
    }
});

socket.on("game_over", ({ result, message }) => {
    inGame = false;
    terminalInput.disabled = true;
    btnShop.disabled = true;
    btnMatch.disabled = false;
    btnMatch.innerText = "Tim doi thu moi";
    btnMatch.classList.replace("btn-danger", "btn-accent");
    matchStatus.innerText = "";
    
    printLog("======================================", "error");
    printLog(`KET NOI KET THUC: ${message}`, result === 'win' ? "success" : "error");
    printLog("======================================", "error");

    setTimeout(() => {
        targetPlaceholder.classList.remove("d-none");
        if (lobbyWaitingText) lobbyWaitingText.innerText = message;
        targetInfo.classList.add("d-none");
        // reset fake website visual
        fakeWebsite.classList.remove('critical-damage');
    }, 2000);
});

function updateUI(myState, enemyState) {
    if (myState) {
        myHpText.innerText = `${myState.hp}/${myState.maxHp}`;
        myHp.style.width = `${(myState.hp / myState.maxHp) * 100}%`;
        
        myFirewall.innerText = `${myState.firewallHp} / ${myState.maxFirewallHp}`;
        myFirewall.className = `badge ${myState.firewallHp > 0 ? 'bg-success text-light' : 'bg-danger text-light'} w-100 py-1`;
        
        myCredits.innerText = myState.credits;
        modalCredits.innerText = `${myState.credits} CR`;
        
        if(myState.inventory) {
            invMiner.innerText = myState.miners || 0;
            invHp.innerText = myState.inventory.hp_boost || 0;
            invEmp.innerText = myState.inventory.emp || 0;
        }

        renderEffects(myState.effects, myEffects);
        handleCooldown(myState.cooldownUntil);

        if (myState.hp <= 30) {
            myHp.classList.add("bg-danger");
            myHp.classList.remove("bg-accent");
        } else {
            myHp.classList.remove("bg-danger");
            myHp.classList.add("bg-accent");
        }
    }

    if (enemyState) {
        enemyHpText.innerText = `${enemyState.hp}/${enemyState.maxHp}`;
        enemyHp.style.width = `${(enemyState.hp / enemyState.maxHp) * 100}%`;
        
        enemyFirewall.innerText = `${enemyState.firewallHp} / ${enemyState.maxFirewallHp}`;
        enemyFirewall.className = `badge ${enemyState.firewallHp > 0 ? 'bg-success text-light' : 'bg-danger text-light'} px-3 py-1`;
        
        if (enemyState.effects) {
             renderEffects(enemyState.effects, enemyEffects);
        }

        // Glitch effect if damage taken
        if (enemyState.hp < enemyState.maxHp) {
            fakeWebsite.classList.add('glitch-active');
            if(glitchOverlay) glitchOverlay.classList.replace('opacity-0', 'opacity-50');
            setTimeout(() => {
                fakeWebsite.classList.remove('glitch-active');
                if(glitchOverlay) glitchOverlay.classList.replace('opacity-50', 'opacity-0');
            }, 500);
        }
        
        if (enemyState.hp <= 30) {
            fakeWebsite.classList.add('critical-damage');
            enemyHp.classList.replace("bg-target", "bg-danger");
        } else {
            fakeWebsite.classList.remove('critical-damage');
            enemyHp.classList.replace("bg-danger", "bg-target");
        }
    }
}

function renderEffects(effects, container) {
    if(!effects) return;
    let html = '';
    
    if (effects.virus > 0) {
        html += `<div class="text-danger fw-bold"><i class="bi bi-bug-fill"></i> VIRUS (${effects.virus} ticks)</div>`;
    }
    if ((effects.bleed || 0) > 0) {
        html += `<div class="text-danger"><i class="bi bi-droplet-fill"></i> BLEED (${effects.bleed} ticks)</div>`;
    }
    if ((effects.frenzy || 0) > 0) {
        html += `<div class="text-info"><i class="bi bi-lightning-fill"></i> FRENZY CHARGE (${effects.frenzy})</div>`;
    }
    if (effects.firewall_broken > 0) {
        html += `<div class="text-warning"><i class="bi bi-shield-slash-fill"></i> HW REBOOT (${effects.firewall_broken} ticks)</div>`;
    }

    if (html === '') {
        container.innerHTML = 'Khong co hieu ung bat loi.';
    } else {
        container.innerHTML = html;
    }
}

function handleCooldown(cooldownUntil) {
    const now = Date.now();
    if (cooldownUntil && cooldownUntil > now) {
        cooldownOverlay.classList.remove("d-none");
        terminalInput.disabled = true;
        
        if (cooldownInterval) clearInterval(cooldownInterval);
        
        cooldownInterval = setInterval(() => {
            const timeLeft = ((cooldownUntil - Date.now()) / 1000).toFixed(1);
            if (timeLeft <= 0) {
                clearInterval(cooldownInterval);
                cooldownOverlay.classList.add("d-none");
                if (inGame) {
                    terminalInput.disabled = false;
                    terminalInput.focus({ preventScroll: true });
                }
            } else {
                cooldownTimer.innerText = timeLeft;
            }
        }, 100);
    } else {
        cooldownOverlay.classList.add("d-none");
        if (inGame && document.activeElement !== terminalInput) {
            terminalInput.disabled = false;
            terminalInput.focus({ preventScroll: true });
        }
    }
}

// Terminal Input History Mechanism
const cmdHistory = [];
let historyIndex = -1;

terminalInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        const cmdStr = terminalInput.value.trim();
        if (cmdStr && inGame) executeCommand(cmdStr);
        terminalInput.value = "";
    } else if (e.key === "ArrowUp") {
        if (historyIndex > 0) {
            historyIndex--;
            terminalInput.value = cmdHistory[historyIndex];
        }
    } else if (e.key === "ArrowDown") {
        if (historyIndex < cmdHistory.length - 1) {
            historyIndex++;
            terminalInput.value = cmdHistory[historyIndex];
        } else {
            historyIndex = cmdHistory.length;
            terminalInput.value = "";
        }
    }
});
