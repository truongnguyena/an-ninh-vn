/**
 * In-memory store for mailboxes, messages, and global address registry
 * - Uniqueness: Every address ever created is tracked PERMANENTLY in addressRegistry
 *   Even after expiry/deletion, the address cannot be reused by anyone
 * - TTL: configurable (default 30 min)
 * - Auto-cleanup every 60 seconds (mailboxes only, not registry)
 */

const { v4: uuidv4 } = require('uuid');
const { generateAddress } = require('./utils/generator');

const TTL_MS = parseInt(process.env.EMAIL_TTL_MINUTES || '30') * 60 * 1000;
const MAX_MAILBOXES = parseInt(process.env.MAX_MAILBOXES || '1000');

// Map<address, MailboxEntry>
const mailboxes = new Map();

/**
 * GLOBAL ADDRESS REGISTRY
 * Stores EVERY address ever created — persists beyond mailbox expiry/deletion.
 * Guarantees no two users ever share the same address at any point in time.
 * Set<string> of lowercase email addresses
 */
const addressRegistry = new Set();

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Check if an address has ever been used (including expired/deleted mailboxes)
 * @param {string} address
 * @returns {boolean}
 */
function isAddressTaken(address) {
  return addressRegistry.has(address.toLowerCase());
}

/**
 * Generate a unique address that has never been used before
 * Retries up to maxAttempts times to avoid collisions
 * @param {string|null} domain
 * @param {number} maxAttempts
 * @returns {{ local: string, domain: string, address: string }}
 */
function generateUniqueAddress(domain = null, maxAttempts = 15) {
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = generateAddress(domain);
    if (!addressRegistry.has(candidate.address)) {
      return candidate;
    }
  }
  // Fallback: append timestamp to guarantee uniqueness
  const base = generateAddress(domain);
  const ts = Date.now().toString(36);
  const address = `${base.local}-${ts}@${base.domain}`;
  return { local: `${base.local}-${ts}`, domain: base.domain, address };
}

// ─── Mailbox Operations ──────────────────────────────────────────────────────

/**
 * Create a new mailbox
 * @param {string} address - must NOT already be in addressRegistry
 * @param {number} ttlMinutes - custom TTL in minutes (optional)
 * @returns {object} mailbox entry
 */
function createMailbox(address, ttlMinutes = null) {
  const addr = address.toLowerCase();

  // Hard uniqueness check — addresses can never be reused
  if (addressRegistry.has(addr)) {
    throw new Error(`Address "${addr}" is already taken and cannot be reused.`);
  }

  if (mailboxes.size >= MAX_MAILBOXES) {
    // Remove oldest expired mailbox to make room
    const now = Date.now();
    for (const [a, box] of mailboxes) {
      if (box.expiresAt < now) {
        mailboxes.delete(a);
        break;
      }
    }
    if (mailboxes.size >= MAX_MAILBOXES) {
      throw new Error('Server is at capacity. Please try again later.');
    }
  }

  const now = new Date();
  const ttl = ttlMinutes ? ttlMinutes * 60 * 1000 : TTL_MS;
  const expiresAt = new Date(now.getTime() + ttl);

  const entry = {
    address: addr,
    messages: [],
    createdAt: now,
    expiresAt,
    unseenCount: 0,
    webhook: null,        // webhook URL for notifications
  };

  mailboxes.set(addr, entry);
  addressRegistry.add(addr); // register permanently — never removed

  return entry;
}

function getMailbox(address) {
  return mailboxes.get(address.toLowerCase()) || null;
}

function mailboxExists(address) {
  return mailboxes.has(address.toLowerCase());
}

// ─── Message Operations ──────────────────────────────────────────────────────

function addMessage(address, message) {
  const box = mailboxes.get(address.toLowerCase());
  if (!box) return false;

  const msg = {
    id: uuidv4(),
    from: message.from || { address: 'unknown@sender.com', name: 'Unknown' },
    to: address.toLowerCase(),
    subject: message.subject || '(No Subject)',
    text: message.text || '',
    html: message.html || message.text || '',
    date: message.date || new Date(),
    receivedAt: new Date(),
    seen: false,
    starred: false,
    labels: [],
    attachments: message.attachments || [],
    raw: message.raw || null,
  };

  box.messages.unshift(msg); // newest first
  box.unseenCount++;

  // Keep max 100 messages per mailbox
  if (box.messages.length > 100) {
    box.messages = box.messages.slice(0, 100);
  }

  // Fire webhook if configured
  if (box.webhook) {
    fireWebhook(box.webhook, { event: 'message.received', address, message: { id: msg.id, from: msg.from, subject: msg.subject } });
  }

  return msg;
}

function getMessage(address, messageId) {
  const box = mailboxes.get(address.toLowerCase());
  if (!box) return null;
  return box.messages.find((m) => m.id === messageId) || null;
}

function markSeen(address, messageId) {
  const box = mailboxes.get(address.toLowerCase());
  if (!box) return;
  const msg = box.messages.find((m) => m.id === messageId);
  if (msg && !msg.seen) {
    msg.seen = true;
    box.unseenCount = Math.max(0, box.unseenCount - 1);
  }
}

function markAllSeen(address) {
  const box = mailboxes.get(address.toLowerCase());
  if (!box) return false;
  box.messages.forEach((m) => { m.seen = true; });
  box.unseenCount = 0;
  return true;
}

function starMessage(address, messageId, starred) {
  const box = mailboxes.get(address.toLowerCase());
  if (!box) return null;
  const msg = box.messages.find((m) => m.id === messageId);
  if (!msg) return null;
  msg.starred = starred;
  return msg;
}

function searchMessages(address, query) {
  const box = mailboxes.get(address.toLowerCase());
  if (!box || !query) return [];
  const q = query.toLowerCase();
  return box.messages.filter((m) =>
    m.subject.toLowerCase().includes(q) ||
    (m.from.address && m.from.address.toLowerCase().includes(q)) ||
    (m.from.name && m.from.name.toLowerCase().includes(q)) ||
    m.text.toLowerCase().includes(q)
  );
}

// ─── Mailbox Management ──────────────────────────────────────────────────────

/**
 * Delete a mailbox BUT keep address in registry (burned forever)
 */
function deleteMailbox(address) {
  // addressRegistry.delete is intentionally NOT called here
  return mailboxes.delete(address.toLowerCase());
}

function clearMessages(address) {
  const box = mailboxes.get(address.toLowerCase());
  if (!box) return false;
  box.messages = [];
  box.unseenCount = 0;
  return true;
}

function extendMailbox(address, extraMinutes = 10) {
  const box = mailboxes.get(address.toLowerCase());
  if (!box) return null;
  box.expiresAt = new Date(box.expiresAt.getTime() + extraMinutes * 60 * 1000);
  return box;
}

function setWebhook(address, url) {
  const box = mailboxes.get(address.toLowerCase());
  if (!box) return null;
  box.webhook = url || null;
  return box;
}

// ─── Webhook Helper ──────────────────────────────────────────────────────────

function fireWebhook(url, payload) {
  // Fire-and-forget webhook delivery
  const http = url.startsWith('https') ? require('https') : require('http');
  const data = JSON.stringify(payload);
  try {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (url.startsWith('https') ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'User-Agent': 'KurumiMail-Webhook/1.0',
      },
    };
    const req = http.request(options);
    req.on('error', () => {}); // silently ignore failures
    req.write(data);
    req.end();
  } catch (_) { /* ignore */ }
}

// ─── Stats ───────────────────────────────────────────────────────────────────

function getStats() {
  return {
    totalMailboxes: mailboxes.size,
    maxMailboxes: MAX_MAILBOXES,
    totalRegisteredAddresses: addressRegistry.size,
    uptime: Math.floor(process.uptime()),
  };
}

// ─── Auto-cleanup ────────────────────────────────────────────────────────────

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  let removed = 0;
  for (const [address, box] of mailboxes) {
    if (box.expiresAt.getTime() < now) {
      mailboxes.delete(address);
      // NOTE: address stays in addressRegistry permanently
      removed++;
    }
  }
  if (removed > 0) {
    console.log(`[Store] Cleaned up ${removed} expired mailbox(es). Active: ${mailboxes.size} | Registry: ${addressRegistry.size}`);
  }
}, 60 * 1000);

cleanupInterval.unref();

module.exports = {
  createMailbox,
  getMailbox,
  mailboxExists,
  isAddressTaken,
  generateUniqueAddress,
  addMessage,
  getMessage,
  markSeen,
  markAllSeen,
  starMessage,
  searchMessages,
  deleteMailbox,
  clearMessages,
  extendMailbox,
  setWebhook,
  getStats,
};
