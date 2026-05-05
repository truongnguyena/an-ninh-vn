/**
 * Developer API Routes
 * /api/developer — API key management for developers
 */

const express = require('express');
const router = express.Router();
const apiKeys = require('../utils/apiKeys');

// ─── POST /api/developer/keys ─────────────────────────────────────────────
// Create a new API key
router.post('/keys', (req, res) => {
  const { name, email } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({
      error: 'name is required (min 2 characters).',
    });
  }

  try {
    const entry = apiKeys.createKey(name.trim(), (email || '').trim());
    return res.status(201).json({
      message: 'API key created successfully. Save your key — it will not be shown again!',
      ...apiKeys.publicView(entry),
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ─── GET /api/developer/keys/:key ────────────────────────────────────────
// Get info about a specific API key
router.get('/keys/:key', (req, res) => {
  const entry = apiKeys.validateKey(req.params.key);
  if (!entry) {
    return res.status(404).json({ error: 'Key not found or revoked.' });
  }
  return res.json(apiKeys.publicView(entry));
});

// ─── DELETE /api/developer/keys/:key ─────────────────────────────────────
// Revoke an API key
router.delete('/keys/:key', (req, res) => {
  const revoked = apiKeys.revokeKey(req.params.key);
  if (!revoked) {
    return res.status(404).json({ error: 'Key not found.' });
  }
  return res.json({ message: 'API key revoked successfully.' });
});

// ─── GET /api/developer/docs ──────────────────────────────────────────────
// Return API documentation as JSON
router.get('/docs', (req, res) => {
  return res.json({
    version: '1.0',
    baseUrl: '/api/v1',
    authentication: {
      type: 'API Key',
      header: 'X-API-Key',
      query: 'api_key',
      example: 'curl -H "X-API-Key: km_live_xxx" https://your-domain/api/v1/mailbox',
    },
    rateLimit: {
      requests: parseInt(process.env.API_RATE_LIMIT || '300'),
      window: '60 seconds',
      headers: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    },
    endpoints: [
      {
        method: 'POST', path: '/api/v1/mailbox',
        description: 'Create a new temporary mailbox',
        body: { domain: 'string (optional)', local: 'string (optional)', ttlMinutes: 'number 1-1440 (optional)' },
        returns: 'MailboxInfo',
      },
      {
        method: 'GET', path: '/api/v1/mailbox/:address',
        description: 'List all messages in a mailbox',
        returns: 'MailboxInfo with messages[]',
      },
      {
        method: 'GET', path: '/api/v1/mailbox/:address/:id',
        description: 'Get full content of a single message',
        returns: 'Message with html, text, attachments',
      },
      {
        method: 'GET', path: '/api/v1/mailbox/:address/:id/raw',
        description: 'Get raw .eml content of a message',
        returns: 'text/plain (raw email)',
      },
      {
        method: 'DELETE', path: '/api/v1/mailbox/:address',
        description: 'Delete a mailbox permanently',
        returns: '{ message: string }',
      },
      {
        method: 'PUT', path: '/api/v1/mailbox/:address/extend',
        description: 'Extend mailbox TTL',
        body: { minutes: 'number 1-60' },
        returns: '{ expiresAt: Date }',
      },
      {
        method: 'GET', path: '/api/v1/domains',
        description: 'List all supported email domains',
        returns: '{ domains: string[] }',
      },
    ],
    examples: {
      curl: [
        'curl -X POST https://your-domain/api/v1/mailbox -H "X-API-Key: km_live_xxx" -H "Content-Type: application/json" -d \'{"domain":"kurumi.vn"}\'',
        'curl https://your-domain/api/v1/mailbox/neon-voi-42@kurumi.vn -H "X-API-Key: km_live_xxx"',
      ],
      javascript: `const res = await fetch('/api/v1/mailbox', {
  method: 'POST',
  headers: { 'X-API-Key': 'km_live_xxx', 'Content-Type': 'application/json' },
  body: JSON.stringify({ domain: 'kurumi.vn', ttlMinutes: 60 })
});
const { address } = await res.json();`,
      python: `import requests
headers = {'X-API-Key': 'km_live_xxx'}
r = requests.post('https://your-domain/api/v1/mailbox', headers=headers, json={'domain': 'kurumi.vn'})
address = r.json()['address']`,
    },
  });
});

module.exports = router;
