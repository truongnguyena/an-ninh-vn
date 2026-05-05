/**
 * API Key Management for KurumiMail Developer API
 * In-memory store — keys are lost on server restart (production would use DB)
 */

const crypto = require('crypto');

// Map<apiKey, KeyEntry>
const keys = new Map();

/**
 * KeyEntry shape:
 * {
 *   key: string,         // km_live_xxxxx
 *   name: string,        // app name
 *   email: string,       // developer email
 *   createdAt: Date,
 *   lastUsedAt: Date|null,
 *   usageCount: number,
 *   rateLimit: number,   // requests per minute
 *   active: boolean,
 *   // Sliding window rate limit tracking
 *   _window: number[],   // timestamps of recent requests
 * }
 */

const DEFAULT_RATE_LIMIT = parseInt(process.env.API_RATE_LIMIT || '300');

/**
 * Generate a new API key
 * @param {string} name - application/project name
 * @param {string} email - developer email
 * @returns {KeyEntry}
 */
function createKey(name, email) {
  if (!name || typeof name !== 'string') throw new Error('name is required');

  const rawKey = `km_live_${crypto.randomBytes(20).toString('hex')}`;

  const entry = {
    key: rawKey,
    name: name.trim().slice(0, 100),
    email: (email || '').trim().slice(0, 200),
    createdAt: new Date(),
    lastUsedAt: null,
    usageCount: 0,
    rateLimit: DEFAULT_RATE_LIMIT,
    active: true,
    _window: [],
  };

  keys.set(rawKey, entry);
  return entry;
}

/**
 * Validate an API key
 * @param {string} key
 * @returns {KeyEntry|null}
 */
function validateKey(key) {
  if (!key || typeof key !== 'string') return null;
  const entry = keys.get(key);
  if (!entry || !entry.active) return null;
  return entry;
}

/**
 * Check rate limit and increment usage
 * Uses a 60-second sliding window
 * @param {string} key
 * @returns {{ allowed: boolean, remaining: number, resetIn: number }}
 */
function checkRateLimit(key) {
  const entry = keys.get(key);
  if (!entry) return { allowed: false, remaining: 0, resetIn: 60 };

  const now = Date.now();
  const windowMs = 60 * 1000;

  // Remove timestamps older than 1 minute
  entry._window = entry._window.filter((t) => now - t < windowMs);

  if (entry._window.length >= entry.rateLimit) {
    const oldest = entry._window[0];
    const resetIn = Math.ceil((oldest + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, resetIn };
  }

  // Allow and record
  entry._window.push(now);
  entry.usageCount++;
  entry.lastUsedAt = new Date();

  return {
    allowed: true,
    remaining: entry.rateLimit - entry._window.length,
    resetIn: 60,
  };
}

/**
 * Revoke an API key
 * @param {string} key
 * @returns {boolean}
 */
function revokeKey(key) {
  const entry = keys.get(key);
  if (!entry) return false;
  entry.active = false;
  return true;
}

/**
 * Get safe public view of a key (no internal fields)
 * @param {KeyEntry} entry
 * @returns {object}
 */
function publicView(entry) {
  return {
    key: entry.key,
    name: entry.name,
    email: entry.email,
    createdAt: entry.createdAt,
    lastUsedAt: entry.lastUsedAt,
    usageCount: entry.usageCount,
    rateLimit: entry.rateLimit,
    active: entry.active,
  };
}

function getAllKeys() {
  return [...keys.values()].map(publicView);
}

module.exports = {
  createKey,
  validateKey,
  checkRateLimit,
  revokeKey,
  publicView,
  getAllKeys,
};
