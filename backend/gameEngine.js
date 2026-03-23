function createWebsiteState() {
    const portsToConsider = [21, 22, 53, 80, 443, 3306, 8080];
    let openPorts = {};
    
    // Randomly select 3-5 open ports
    const numOpen = Math.floor(Math.random() * 3) + 3;
    const shuffled = portsToConsider.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, numOpen);

    selected.forEach(p => {
        openPorts[p] = {
            isOpen: true,
            isVulnerable: Math.random() > 0.4, // 60% chance to be vulnerable
            service: getServiceName(p)
        };
    });
    
    return {
        hp: 100, // System Integrity
        maxHp: 100,
        ports: openPorts,
        firewallHp: 100, // Structural HP instead of just toggle
        maxFirewallHp: 100,
        credits: 50, // Starting money for shop
        miners: 0, // Generates passive CR
        inventory: {
            hp_boost: 0,
            emp: 0
        },
        effects: {
            virus: 0, // Duration tracking for DoT
            firewall_broken: 0, // Cannot rebuild firewall if > 0
            bleed: 0, // Extra DoT from attack skills
            frenzy: 0 // Next attacks gain bonus damage
        },
        cooldownUntil: 0 // Timestamp when next command is allowed
    };
}

function getServiceName(port) {
    const map = {
        21: 'vsftpd_2.3.4', 
        22: 'OpenSSH_7.2p2', 
        53: 'BIND_9.x',
        80: 'Apache_2.4.41', 
        443: 'nginx_1.18.0', 
        3306: 'MySQL_5.7',
        8080: 'Tomcat_8.5'
    };
    return map[port] || 'Unknown_Service';
}

function processCommand(commandStr, attackerState, defenderState) {
    // 1. Check Cooldown
    const now = Date.now();
    if (now < attackerState.cooldownUntil) {
        const remaining = Math.ceil((attackerState.cooldownUntil - now) / 1000);
        return { error: `[SYSTEM] Command rate limited. Cooldown active for ${remaining}s.` };
    }

    const parts = commandStr.trim().split(' ').filter(p => p);
    if (parts.length === 0) return { error: 'Empty command' };
    
    const rawCmd = parts[0].toLowerCase();
    const aliases = {
        ls: 'help',
        '?': 'help',
        h: 'help',
        g: 'guide',
        recon: 'scan',
        chk: 'probe',
        atk: 'exploit',
        fw: 'firewall',
        fix: 'patch',
        med: 'heal',
        stats: 'status'
    };
    const cmd = aliases[rawCmd] || rawCmd;
    
    // Set fixed 5s cooldown for all successful commands actions except help/shop list
    const applyCooldown = () => {
        attackerState.cooldownUntil = Date.now() + 5000;
        return 5; // Return seconds for frontend
    };

    const frenzyBonus = () => {
        if ((attackerState.effects.frenzy || 0) > 0) {
            attackerState.effects.frenzy--;
            return 15;
        }
        return 0;
    };

    switch (cmd) {
        case 'help':
            if ((parts[1] || '').toLowerCase() === 'vi') {
                return {
                    result: `=== HUONG DAN LENH (VI) ===
 help/guide vi | Tro giup   | Xem huong dan tieng Viet.
 status        | Tien ich   | Xem HP, khiem, credits, inventory, hieu ung.
 ports         | Trinh sat  | Liet ke port cua ban va trang thai bao mat.
 scan          | Trinh sat  | Quet port doi thu (can ha firewall doi thu).
 probe [port]  | Trinh sat  | Kiem tra port co de bi khai thac hay khong.
 exploit [p]   | Tan cong   | Tan cong port mo cua doi thu.
 spear [port]  | Tan cong   | Dam xuyen 1 muc tieu.
 barrage [port]| Tan cong   | Tan xa 3 lan lien tiep.
 breach        | Tan cong   | Pha manh vao khiem va loi he thong.
 bleed [port]  | Tan cong   | Gay sat thuong + hieu ung mat mau.
 pulse         | Tan cong   | Sat thuong thuan bo qua khiem.
 sabotage      | Gay nhieu  | Dot CR doi thu + sat thuong.
 frenzy        | Dac biet   | Tang sat thuong cho cac don tan cong tiep.
 decoy         | Dac biet   | Tang 20 HP khiem.
 purge         | Dac biet   | Xoa virus/bleed cua ban.
 gamble        | Dac biet   | Cuoc lon: rat manh hoac tu bi phan sat thuong.
 jam           | Kinh te    | Dot credits doi thu va hut mot phan ve ban.
 patch [port]  | Phong thu  | Va 1 port cua ban.
 harden all    | Phong thu  | Va toan bo port yeu (ton 30 CR).
 reboot        | Hoi phuc   | Xoa virus, hoi 10 HP (ton 25 CR).
 heal          | Hoi phuc   | Hoi HP.
 firewall build| Khiem      | Dung lai khiem (ton 15 CR).`,
                    type: 'info'
                };
            }
            return {
                result: `=== CYBER OPS MANUAL ===
 aliases  | Utility      | ls/?/h->help, g->guide, recon->scan, chk->probe, atk->exploit, fw->firewall, fix->patch, med->heal, stats->status.
 guide    | Utility      | Detailed usage + examples for all new commands.
 status   | Utility      | Show your full node status.
 ports    | Recon        | List your own open ports and vulnerability status.
  scan      | Recon        | Reveal target ports & services.
 probe     | Recon        | Usage: probe [port]. Check if target port is vulnerable.
  exploit   | Attack       | Usage: exploit [port]. Damage vulnerable ports.
 spear     | Attack       | Usage: spear [port]. High focused damage.
 barrage   | Attack       | Usage: barrage [port]. Triple-hit burst.
 breach    | Attack       | Usage: breach. Shield break + HP pressure.
 bleed     | Attack       | Usage: bleed [port]. Adds bleed DoT.
 pulse     | Attack       | Usage: pulse. Pure damage bypassing firewall.
 sabotage  | Jam          | Usage: sabotage. Burns enemy CR and HP.
 frenzy    | Special      | Usage: frenzy. Empower next attacks.
 decoy     | Special      | Usage: decoy. Emergency firewall boost.
 purge     | Special      | Usage: purge. Clean self debuffs.
 gamble    | Special      | Usage: gamble. High-risk high-reward strike.
 jam       | Attack       | Usage: jam. Drain enemy credits when firewall is down.
  patch     | Defend       | Usage: patch [port]. Secure your ports.
 harden    | Defend       | Usage: harden all. Patch all vulnerable ports (costs CR).
 reboot    | Defend       | Usage: reboot. Clean virus stacks and recover stability.
  heal      | Repair       | Restore 20 Integrity.
  firewall  | Shield       | Usage: firewall build. Rebuild structural shield (Needs 15 CR).
  steal     | Hack         | Usage: steal. Siphon enemy credits if their firewall is down.
  overclock | Risk         | Usage: overclock. Trade 20 HP for 30 CR and Instant Cooldown reset!
  ddos      | Attack       | Usage: ddos. Destroy enemy firewall instantly (Needs 30 CR).
  virus     | Payload      | Usage: virus [port]. Inject DoT damage (Needs 50 CR).
  nuke      | Ultimate     | Usage: nuke. 80 pure unblockable damage! (Needs 200 CR).
  miner     | Income       | Usage: miner. Build crypto miner for +5CR/tick (Needs 100 CR).
  shop      | Market       | View available items to buy.
  buy       | Purchase     | Usage: buy [item]. Buy from shop.
  use       | Deploy       | Usage: use [item]. Deploy inventory item.`,
                type: 'info'
            };

        case 'guide':
            if ((parts[1] || '').toLowerCase() === 'vi') {
                return {
                    result: `=== HUONG DAN CHIEN THUAT (VI) ===
1) Trinh sat
   - ports: xem he thong cua ban.
   - scan/probe [port]: doc thong tin doi thu truoc khi exploit.

2) Phong thu
   - harden all: va nhanh tat ca port yeu.
   - reboot: dung mat mau theo virus ngay lap tuc.

3) Kinh te
   - jam: lam doi thu mat credits khi firewall cua ho da sap.

3.5) Bo 10 lenh moi
   - spear/barrage/breach/bleed/pulse: tan cong gay mat mau nhanh.
   - sabotage: gay nhieu + dot CR.
   - frenzy/decoy/purge/gamble: bo ky nang dac biet.

4) Goi y
   - Mo dau bang scan/probe, sau do exploit dung port.
   - Khi bi virus, uu tien reboot de giam sat thuong.`,
                    type: 'info'
                };
            }
            return {
                result: `=== COMMAND GUIDE (NEW) ===
1) Recon & Visibility
   ports
   -> Show your open ports and whether each is Vulnerable or Secured.

   probe [port]
   -> Example: probe 443
   -> Requires enemy firewall down. Reveals if service is patchable target.

2) Defense & Recovery
   harden all
   -> Costs 30 CR. Patches all your currently vulnerable open ports.

   reboot
   -> Costs 25 CR. Removes all virus stacks and restores 10 HP.

3) Economy Warfare
   jam
   -> Requires enemy firewall down. Burns enemy CR and steals partial amount.

4) Utility
   status
   -> Full stats: HP, firewall, credits, inventory, active effects.

Tips:
- Open with 'scan' or 'probe [port]' before using 'exploit [port]'.
- Use 'harden all' right after enemy recon pressure.
- If infected, prioritize 'reboot' to stop DoT.`,
                type: 'info'
            };

        case 'status':
            return {
                result: `=== NODE STATUS ===
Integrity : ${attackerState.hp}/${attackerState.maxHp}
Firewall  : ${attackerState.firewallHp}/${attackerState.maxFirewallHp}
Credits   : ${attackerState.credits}
Miners    : ${attackerState.miners}
Inventory : hp_boost=${attackerState.inventory.hp_boost || 0}, emp=${attackerState.inventory.emp || 0}
Effects   : virus=${attackerState.effects.virus}, bleed=${attackerState.effects.bleed || 0}, frenzy=${attackerState.effects.frenzy || 0}, firewall_broken=${attackerState.effects.firewall_broken}`,
                type: 'info'
            };
            
        case 'ports': {
            const rows = Object.entries(attackerState.ports).map(([p, info]) => {
                const state = info.isVulnerable ? 'VULNERABLE' : 'SECURED';
                return `${String(p).padEnd(6)} | ${info.service.padEnd(18)} | ${state}`;
            });
            return {
                result: `=== YOUR PORT MAP ===\nPORT   | SERVICE             | STATE\n${rows.join('\n')}`,
                type: 'info'
            };
        }

        case 'probe': {
            const probePort = parts[1];
            if (!probePort) return { error: 'Usage: probe [port]' };
            if (defenderState.firewallHp > 0) {
                applyCooldown();
                return { result: '[-] Probe blocked. Target firewall is active.', type: 'error' };
            }
            const target = defenderState.ports[probePort];
            applyCooldown();
            if (!target || !target.isOpen) return { result: `[-] Port ${probePort} appears filtered/closed.`, type: 'warning' };
            return {
                result: `[+] Probe report on ${probePort}: ${target.service} | ${target.isVulnerable ? 'LIKELY VULNERABLE' : 'PATCHED/HARDENED'}`,
                type: target.isVulnerable ? 'success' : 'info'
            };
        }

        case 'shop':
            return {
                result: `=== SHADOW MARKET === (Your CR: ${attackerState.credits})
  hp_boost  | 50 CR  | Instantly restores 50 System Integrity.
  emp       | 100 CR | Deals massive 40 Damage through firewalls.`,
                type: 'warning'
            };
            
        case 'buy':
            const item = parts[1];
            if (!item) return { error: 'Usage: buy [item]' };
            const prices = { hp_boost: 50, emp: 100 };
            
            if (!prices[item]) return { error: `Item '${item}' not found in shop.` };
            if (attackerState.credits < prices[item]) {
                return { error: `Insufficient Credits. You have ${attackerState.credits} CR, need ${prices[item]} CR.` };
            }
            
            attackerState.credits -= prices[item];
            attackerState.inventory[item] = (attackerState.inventory[item] || 0) + 1;
            applyCooldown();
            return { 
                result: `[+] Purchased ${item}. Added to inventory. (-${prices[item]} CR)`, 
                type: 'success', selfUpdate: true 
            };
            
        case 'use':
            const itemToUse = parts[1];
            if (!itemToUse || !attackerState.inventory[itemToUse] || attackerState.inventory[itemToUse] <= 0) {
                return { error: `You don't own '${itemToUse}'.` };
            }
            
            attackerState.inventory[itemToUse] -= 1;
            applyCooldown();
            
            if (itemToUse === 'hp_boost') {
                attackerState.hp = Math.min(attackerState.hp + 50, attackerState.maxHp);
                return { result: `[+] Deployed hp_boost. Integrity massively restored!`, type: 'success', selfUpdate: true };
            } else if (itemToUse === 'emp') {
                defenderState.hp = Math.max(0, defenderState.hp - 40);
                return { result: `[!] EMP DETONATED. Massive damage dealt bypassing all defenses!`, type: 'success' };
            }
            return { error: 'Item effect error.' };

        case 'scan':
            if (defenderState.firewallHp > 0) {
                applyCooldown();
                return { result: `[-] Scan blocked. Target Firewall is active (${defenderState.firewallHp} HP).`, type: 'error' };
            }
            applyCooldown();
            let scanResult = 'Running Nmap stealth scan...\n\nPORT     STATE  SERVICE\n';
            for (let p in defenderState.ports) {
                if (defenderState.ports[p].isOpen) {
                    scanResult += `${p.padEnd(8)} open   ${defenderState.ports[p].service}\n`;
                }
            }
            return { result: scanResult, type: 'info' };

        case 'miner':
            if (attackerState.credits < 100) return { error: `Miner requires 100 CR. You have ${attackerState.credits} CR.` };
            attackerState.credits -= 100;
            attackerState.miners += 1;
            applyCooldown();
            return { result: `[+] Crypto Miner Deployed! Operating at +5 CR per tick. Total Miners: ${attackerState.miners}`, type: 'success', selfUpdate: true };
            
        case 'steal':
            if (defenderState.firewallHp > 0) {
                applyCooldown();
                return { result: '[-] Steal blocked. Target Firewall is active.', type: 'error' };
            }
            if (defenderState.credits <= 0) {
                applyCooldown();
                return { result: '[-] Target has no Credits to steal.', type: 'error' };
            }
            applyCooldown();
            let stolen = Math.floor(Math.random() * 20) + 10;
            stolen = Math.min(stolen, defenderState.credits);
            defenderState.credits -= stolen;
            attackerState.credits += stolen;
            return { result: `[+] Siphoned ${stolen} CR from target to your account!`, type: 'success' };

        case 'jam':
            if (defenderState.firewallHp > 0) {
                applyCooldown();
                return { result: '[-] Jam blocked. Firewall still active.', type: 'error' };
            }
            applyCooldown();
            if (defenderState.credits <= 0) {
                return { result: '[-] Target has no CR to disrupt.', type: 'warning' };
            }
            const drained = Math.min(defenderState.credits, Math.floor(Math.random() * 18) + 12);
            const siphoned = Math.ceil(drained * 0.5);
            defenderState.credits -= drained;
            attackerState.credits += siphoned;
            return { result: `[+] Signal jam successful. Burned ${drained} enemy CR, rerouted ${siphoned} CR to you.`, type: 'success' };

        case 'spear': {
            const spearPort = parts[1];
            if (!spearPort) return { error: 'Usage: spear [port]' };
            const target = defenderState.ports[spearPort];
            if (!target || !target.isOpen) return { error: `Port ${spearPort} is not open.` };
            applyCooldown();
            let damage = Math.floor(Math.random() * 13) + 18 + frenzyBonus();
            if (target.isVulnerable) damage += 10;
            defenderState.hp = Math.max(0, defenderState.hp - damage);
            return { result: `[+] SPEAR hit port ${spearPort} for ${damage} damage.`, type: 'success', damage };
        }

        case 'barrage': {
            const barragePort = parts[1];
            if (!barragePort) return { error: 'Usage: barrage [port]' };
            const target = defenderState.ports[barragePort];
            if (!target || !target.isOpen) return { error: `Port ${barragePort} is not open.` };
            applyCooldown();
            let total = 0;
            for (let i = 0; i < 3; i++) total += Math.floor(Math.random() * 7) + 8;
            total += frenzyBonus();
            defenderState.hp = Math.max(0, defenderState.hp - total);
            return { result: `[+] BARRAGE completed on ${barragePort}. Total damage: ${total}.`, type: 'success', damage: total };
        }

        case 'breach': {
            if (attackerState.credits < 25) return { error: `Breach requires 25 CR. You have ${attackerState.credits} CR.` };
            attackerState.credits -= 25;
            applyCooldown();
            const shieldDamage = Math.min(defenderState.firewallHp, 40);
            defenderState.firewallHp = Math.max(0, defenderState.firewallHp - 40);
            let hpDamage = 0;
            if (defenderState.firewallHp === 0) {
                hpDamage = 20 + frenzyBonus();
                defenderState.hp = Math.max(0, defenderState.hp - hpDamage);
            }
            return {
                result: `[+] BREACH fired. Shield damage ${shieldDamage}${hpDamage > 0 ? `, HP damage ${hpDamage}` : ''}. (-25 CR)`,
                type: 'success',
                damage: hpDamage
            };
        }

        case 'bleed': {
            const bleedPort = parts[1];
            if (!bleedPort) return { error: 'Usage: bleed [port]' };
            if (attackerState.credits < 35) return { error: `Bleed requires 35 CR. You have ${attackerState.credits} CR.` };
            if (defenderState.firewallHp > 0) return { error: 'Bleed failed. Enemy firewall is active.' };
            const target = defenderState.ports[bleedPort];
            if (!target || !target.isOpen) return { error: `Port ${bleedPort} is not open.` };
            attackerState.credits -= 35;
            applyCooldown();
            const upfront = 12 + frenzyBonus();
            defenderState.hp = Math.max(0, defenderState.hp - upfront);
            defenderState.effects.bleed = (defenderState.effects.bleed || 0) + 3;
            return { result: `[+] BLEED injected on ${bleedPort}. Immediate ${upfront} damage + DoT applied.`, type: 'success', damage: upfront };
        }

        case 'pulse':
            if (attackerState.credits < 45) return { error: `Pulse requires 45 CR. You have ${attackerState.credits} CR.` };
            attackerState.credits -= 45;
            applyCooldown();
            {
                const pulseDamage = 30 + frenzyBonus();
                defenderState.hp = Math.max(0, defenderState.hp - pulseDamage);
                return { result: `[+] PULSE overloaded enemy core for ${pulseDamage} pure damage. (-45 CR)`, type: 'success', damage: pulseDamage };
            }

        case 'sabotage':
            if (attackerState.credits < 30) return { error: `Sabotage requires 30 CR. You have ${attackerState.credits} CR.` };
            attackerState.credits -= 30;
            applyCooldown();
            {
                const loss = Math.min(defenderState.credits, 25);
                defenderState.credits -= loss;
                const sabotageDamage = 10 + frenzyBonus();
                defenderState.hp = Math.max(0, defenderState.hp - sabotageDamage);
                return { result: `[+] SABOTAGE successful. Enemy lost ${loss} CR and ${sabotageDamage} HP.`, type: 'success', damage: sabotageDamage };
            }

        case 'frenzy':
            applyCooldown();
            attackerState.effects.frenzy = Math.min((attackerState.effects.frenzy || 0) + 2, 4);
            return { result: `[+] FRENZY activated. ${attackerState.effects.frenzy} empowered attack charge(s) ready (+15 damage each).`, type: 'warning', selfUpdate: true };

        case 'decoy':
            if (attackerState.credits < 20) return { error: `Decoy requires 20 CR. You have ${attackerState.credits} CR.` };
            attackerState.credits -= 20;
            applyCooldown();
            attackerState.firewallHp = Math.min(attackerState.maxFirewallHp, attackerState.firewallHp + 20);
            return { result: `[+] DECOY matrix deployed. Firewall +20 HP. (-20 CR)`, type: 'success', selfUpdate: true };

        case 'purge': {
            if (attackerState.credits < 20) return { error: `Purge requires 20 CR. You have ${attackerState.credits} CR.` };
            attackerState.credits -= 20;
            applyCooldown();
            const hadVirus = attackerState.effects.virus > 0;
            const hadBleed = (attackerState.effects.bleed || 0) > 0;
            attackerState.effects.virus = 0;
            attackerState.effects.bleed = 0;
            attackerState.hp = Math.min(attackerState.maxHp, attackerState.hp + 8);
            return { result: `[+] PURGE complete. Cleansed ${hadVirus || hadBleed ? 'negative effects' : 'system cache'} and restored 8 HP.`, type: 'success', selfUpdate: true };
        }

        case 'gamble':
            applyCooldown();
            if (Math.random() < 0.55) {
                const crit = 55 + frenzyBonus();
                defenderState.hp = Math.max(0, defenderState.hp - crit);
                return { result: `[+] GAMBLE WIN! Massive strike dealt ${crit} pure damage.`, type: 'success', damage: crit };
            } else {
                attackerState.hp = Math.max(0, attackerState.hp - 20);
                return { result: `[-] GAMBLE FAILED! Backfire caused 20 self-damage.`, type: 'error', selfUpdate: true };
            }

        case 'overclock':
            if (attackerState.hp <= 25) {
                return { error: '[-] Warning: System Integrity too low for Overclock. Risk of fatal crash.' };
            }
            attackerState.hp -= 20;
            attackerState.credits += 30;
            attackerState.cooldownUntil = 0; // resets cooldown instantly
            return { result: '[!] SYSTEM OVERCLOCKED. Integrity compromised (-20 HP), but gained +30 CR and bypassed cooldown!', type: 'warning', selfUpdate: true };
            
        case 'exploit':
            const port = parts[1];
            if (!port) return { error: 'Usage: exploit [port]' };
            
            applyCooldown();
            let damage = Math.floor(Math.random() * 25) + 20; // 20-45 damage
            
            // Firewall absorption layer
            if (defenderState.firewallHp > 0) {
                const initDamage = damage;
                if (defenderState.firewallHp >= damage) {
                    defenderState.firewallHp -= damage;
                    attackerState.credits += 10;
                    return { result: `[-] Exploit absorbed by enemy Firewall. Dealt ${damage} damage to their shield. (+10 CR)`, type: 'warning', damage: initDamage };
                } else {
                    damage -= defenderState.firewallHp;
                    defenderState.firewallHp = 0;
                    // continue with remaining damage to HP
                }
            }

            const pState = defenderState.ports[port];
            if (!pState || !pState.isOpen) {
                return { result: `Exploit failed. Port ${port} is closed.`, type: 'error' };
            }
            
            if (pState.isVulnerable) {
                defenderState.hp = Math.max(0, defenderState.hp - damage);
                
                // Rewards for hitting flesh
                attackerState.credits += 40; 
                
                pState.isVulnerable = false; 
                pState.service += " (Compromised)";
                
                return { 
                    result: `[+] Exploit payload delivered on port ${port}!\n[!] Dealt ${damage} structural damage. (+40 CR)`, 
                    type: 'success',
                    damage
                };
            } else {
                return { result: `[-] Exploit failed. The service on port ${port} is patched.`, type: 'error' };
            }

        case 'ddos':
            if (attackerState.credits < 30) return { error: `DDOS requires 30 CR. You have ${attackerState.credits} CR.` };
            
            attackerState.credits -= 30;
            applyCooldown();
            
            defenderState.firewallHp = 0;
            defenderState.effects.firewall_broken = 4; // Broken for ~10s
            
            return { result: `[+] DDOS Attack Launched! Target firewall has collapsed completely! (-30 CR)`, type: 'success', damage: 1 };

        case 'virus':
            const vPort = parts[1];
            if (!vPort) return { error: 'Usage: virus [port]' };
            if (attackerState.credits < 50) return { error: `Virus requires 50 CR. You have ${attackerState.credits} CR.` };
            if (defenderState.firewallHp > 0) {
                applyCooldown();
                return { result: 'Virus injection failed. Firewall blocked payload.', type: 'error' };
            }
            
            const vpState = defenderState.ports[vPort];
            if (!vpState || !vpState.isOpen) return { error: `Port ${vPort} is not open.` };
            
            attackerState.credits -= 50;
            applyCooldown();
            
            defenderState.effects.virus += 4; // Ticks 4 times, stacks
            return { result: `[+] VIRUS INJECTED into port ${vPort}! Target will suffer damage over time. (-50 CR)`, type: 'success' };

        case 'nuke':
            if (attackerState.credits < 200) return { error: `Nuke requires 200 CR. You have ${attackerState.credits} CR.` };
            attackerState.credits -= 200;
            applyCooldown();
            defenderState.hp = Math.max(0, defenderState.hp - 80);
            return { result: '[CRITICAL ALERT] TACTICAL NUKE DEPLOYED. 80 PURE DAMAGE DEALT BYPASSING ALL FIREWALLS!', type: 'success', damage: 80 };

        case 'patch':
            const patchPort = parts[1];
            if (!patchPort) return { error: 'Usage: patch [port]' };
            
            const myPort = attackerState.ports[patchPort];
            if (myPort) {
                if (!myPort.isVulnerable) {
                    return { result: `Port ${patchPort} is already secure.`, type: 'info' };
                }
                applyCooldown();
                myPort.isVulnerable = false;
                attackerState.credits += 10; // Reward for patching
                return { result: `[+] Port ${patchPort} has been successfully patched. (+10 CR)`, selfUpdate: true, type: 'success' };
            }
            return { error: `Invalid port ${patchPort}.` };

        case 'harden': {
            const target = parts[1];
            if (target !== 'all') return { error: 'Usage: harden all' };
            if (attackerState.credits < 30) return { error: `Harden all requires 30 CR. You have ${attackerState.credits} CR.` };
            const vulnerablePorts = Object.values(attackerState.ports).filter(p => p.isOpen && p.isVulnerable);
            if (vulnerablePorts.length === 0) return { result: 'All open ports are already hardened.', type: 'info' };

            attackerState.credits -= 30;
            vulnerablePorts.forEach(p => { p.isVulnerable = false; });
            applyCooldown();
            return {
                result: `[+] Harden protocol complete. Secured ${vulnerablePorts.length} vulnerable port(s). (-30 CR)`,
                selfUpdate: true,
                type: 'success'
            };
        }

        case 'heal':
            if (attackerState.hp >= attackerState.maxHp) {
                return { result: 'System integrity is already at maximum.', type: 'info' };
            }
            applyCooldown();
            const healAmount = 25;
            attackerState.hp = Math.min(attackerState.hp + healAmount, attackerState.maxHp);
            return { result: `[+] Restored ${healAmount} system integrity.`, selfUpdate: true, type: 'success' };

        case 'reboot':
            if (attackerState.credits < 25) return { error: `Reboot requires 25 CR. You have ${attackerState.credits} CR.` };
            if (attackerState.effects.virus <= 0) return { result: 'No virus stacks detected. Reboot unnecessary.', type: 'info' };
            attackerState.credits -= 25;
            attackerState.effects.virus = 0;
            attackerState.hp = Math.min(attackerState.maxHp, attackerState.hp + 10);
            applyCooldown();
            return { result: '[+] Emergency reboot complete. Virus removed and stability restored (+10 HP).', selfUpdate: true, type: 'success' };

        case 'firewall':
            const state = parts[1];
            
            if (state === 'build' || state === 'on') {
                if (attackerState.effects.firewall_broken > 0) {
                    return { error: `[-] Cannot rebuild firewall! Hardware cooling down (${attackerState.effects.firewall_broken} ticks remaining).` };
                }
                if (attackerState.firewallHp === attackerState.maxFirewallHp) return { result: 'Firewall is already at MAX HP.', type: 'info' };
                if (attackerState.credits < 15) return { error: `Rebuilding firewall requires 15 CR.` };
                
                applyCooldown();
                attackerState.credits -= 15;
                attackerState.firewallHp = Math.min(attackerState.firewallHp + 50, attackerState.maxFirewallHp);
                return { result: `[+] Firewall rebuilt by 50 HP. Current Shield: ${attackerState.firewallHp}/${attackerState.maxFirewallHp}.`, selfUpdate: true, type: 'success' };
            } else {
                return { error: 'Usage: firewall build' };
            }

        default:
            return { error: `Command not found: ${cmd}. Type 'help'.` };
    }
}

// Function called every server tick (~2.5s interval or trigger based)
function processTick(state) {
    let msg = [];
    
    // Miner Income
    if (state.miners > 0) {
        state.credits += state.miners * 5;
    }
    
    // Virus DoT
    if (state.effects.virus > 0) {
        state.hp = Math.max(0, state.hp - 10);
        state.effects.virus--;
        msg.push("[ALERT] Virus payload corrupting files! (-10 HP)");
    }

    if ((state.effects.bleed || 0) > 0) {
        state.hp = Math.max(0, state.hp - 7);
        state.effects.bleed--;
        msg.push("[ALERT] Bleed protocol draining integrity! (-7 HP)");
    }
    
    // Firewall Broken timer
    if (state.effects.firewall_broken > 0) {
        state.firewallHp = 0;
        state.effects.firewall_broken--;
        if (state.effects.firewall_broken === 0) {
            msg.push("System Notice: Firewall hardware rebooted. You can 'firewall build' now.");
        }
    }
    
    return msg;
}

module.exports = { createWebsiteState, processCommand, processTick };
