/**
 * API Key Authentication Middleware
 * Validates X-API-Key header and enforces per-key rate limiting
 */

const { validateKey, checkRateLimit, publicView } = require('../utils/apiKeys');

/**
 * requireApiKey middleware
 * Attaches validated key entry to req.apiKey on success
 */
function requireApiKey(req, res, next) {
  const key =
    req.headers['x-api-key'] ||
    req.query.api_key ||  // also allow ?api_key=xxx for easy testing
    null;

  if (!key) {
    return res.status(401).json({
      error: 'API key required. Pass X-API-Key header or ?api_key= query param.',
      docs: 'Use POST /api/developer/keys to create a key.',
    });
  }

  const entry = validateKey(key);
  if (!entry) {
    return res.status(403).json({
      error: 'Invalid or revoked API key.',
    });
  }

  // Check rate limit
  const rl = checkRateLimit(key);
  res.set('X-RateLimit-Limit', entry.rateLimit);
  res.set('X-RateLimit-Remaining', rl.remaining);
  res.set('X-RateLimit-Reset', rl.resetIn);

  if (!rl.allowed) {
    return res.status(429).json({
      error: `Rate limit exceeded. Try again in ${rl.resetIn}s.`,
      resetIn: rl.resetIn,
    });
  }

  req.apiKey = publicView(entry);
  next();
}

module.exports = { requireApiKey };
