/**
 * Developer REST API v1
 * /api/v1 — Requires X-API-Key authentication
 * Full programmatic access to mailboxes for external developers
 */

const express = require('express');
const router = express.Router();
const store = require('../store');
const { isValidDomain, isValidLocal, DOMAINS } = require('../utils/generator');
const { extractPreview } = require('../utils/parser');

// ─── GET /api/v1/domains ──────────────────────────────────────────────────
router.get('/domains', (req, res) => {
  return res.json({ domains: DOMAINS });
});

// ─── POST /api/v1/mailbox ─────────────────────────────────────────────────
// Create mailbox — with optional custom domain, local, and TTL
router.post('/mailbox', (req, res) => {
  try {
    const { domain, local, ttlMinutes } = req.body || {};

    // Validate TTL if provided
    let ttl = null;
    if (ttlMinutes !== undefined) {
      ttl = parseInt(ttlMinutes);
      if (isNaN(ttl) || ttl < 1 || ttl > 1440) {
        return res.status(400).json({ error: 'ttlMinutes must be between 1 and 1440.' });
      }
    }

    let addressInfo;

    if (local) {
      if (!isValidLocal(local)) {
        return res.status(400).json({ error: 'Invalid local part. Use 3-40 alphanumeric/.-_ chars.' });
      }
      const dom = domain && DOMAINS.includes(domain) ? domain : DOMAINS[0];
      const address = `${local.toLowerCase()}@${dom}`;
      if (!isValidDomain(address)) {
        return res.status(400).json({ error: 'Domain not supported.' });
      }
      if (store.isAddressTaken(address)) {
        return res.status(409).json({
          error: 'This email address is already taken. Please choose a different one.',
          address,
        });
      }
      addressInfo = { address, local: local.toLowerCase(), domain: dom };
    } else {
      addressInfo = store.generateUniqueAddress(domain || null);
    }

    const mailbox = store.createMailbox(addressInfo.address, ttl);

    return res.status(201).json({
      address: mailbox.address,
      createdAt: mailbox.createdAt,
      expiresAt: mailbox.expiresAt,
      ttlMinutes: ttl || parseInt(process.env.EMAIL_TTL_MINUTES || '30'),
      messageCount: 0,
      domains: DOMAINS,
    });
  } catch (err) {
    const status = err.message.includes('taken') ? 409 :
                   err.message.includes('capacity') ? 503 : 500;
    return res.status(status).json({ error: err.message });
  }
});

// ─── GET /api/v1/mailbox/:address ────────────────────────────────────────
router.get('/mailbox/:address', (req, res) => {
  const { address } = req.params;

  if (!isValidDomain(address)) {
    return res.status(400).json({ error: 'Domain not supported.' });
  }

  const mailbox = store.getMailbox(address);
  if (!mailbox) {
    return res.status(404).json({ error: 'Mailbox not found or expired.' });
  }

  const messages = mailbox.messages.map((m) => ({
    id: m.id,
    from: m.from,
    subject: m.subject,
    preview: extractPreview(m.text),
    receivedAt: m.receivedAt,
    seen: m.seen,
    starred: m.starred,
    hasAttachments: m.attachments.length > 0,
  }));

  return res.json({
    address: mailbox.address,
    createdAt: mailbox.createdAt,
    expiresAt: mailbox.expiresAt,
    unseenCount: mailbox.unseenCount,
    messageCount: messages.length,
    messages,
  });
});

// ─── GET /api/v1/mailbox/:address/:id ────────────────────────────────────
router.get('/mailbox/:address/:id', (req, res) => {
  const { address, id } = req.params;

  if (!isValidDomain(address)) {
    return res.status(400).json({ error: 'Domain not supported.' });
  }

  const mailbox = store.getMailbox(address);
  if (!mailbox) return res.status(404).json({ error: 'Mailbox not found or expired.' });

  const msg = store.getMessage(address, id);
  if (!msg) return res.status(404).json({ error: 'Message not found.' });

  store.markSeen(address, id);

  return res.json({
    id: msg.id,
    from: msg.from,
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
    date: msg.date,
    receivedAt: msg.receivedAt,
    seen: true,
    starred: msg.starred,
    attachments: msg.attachments.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      size: a.size,
    })),
  });
});

// ─── GET /api/v1/mailbox/:address/:id/raw ────────────────────────────────
// Download raw .eml content
router.get('/mailbox/:address/:id/raw', (req, res) => {
  const { address, id } = req.params;
  const msg = store.getMessage(address, id);
  if (!msg) return res.status(404).json({ error: 'Message not found.' });

  const eml = buildEml(msg);
  const filename = `${id.slice(0, 8)}.eml`;

  res.set('Content-Type', 'message/rfc822');
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(eml);
});

// ─── DELETE /api/v1/mailbox/:address ─────────────────────────────────────
router.delete('/mailbox/:address', (req, res) => {
  const { address } = req.params;
  const deleted = store.deleteMailbox(address);
  if (!deleted) return res.status(404).json({ error: 'Mailbox not found.' });
  return res.json({ message: 'Mailbox deleted. Address is permanently retired.' });
});

// ─── PUT /api/v1/mailbox/:address/extend ─────────────────────────────────
router.put('/mailbox/:address/extend', (req, res) => {
  const { address } = req.params;
  const { minutes = 10 } = req.body || {};
  const extra = Math.min(Math.max(parseInt(minutes) || 10, 1), 60);

  const mailbox = store.extendMailbox(address, extra);
  if (!mailbox) return res.status(404).json({ error: 'Mailbox not found or expired.' });

  return res.json({
    address: mailbox.address,
    expiresAt: mailbox.expiresAt,
    message: `Extended by ${extra} minutes.`,
  });
});

// ─── EML Builder ─────────────────────────────────────────────────────────

function buildEml(msg) {
  const fromAddr = msg.from?.address || 'unknown@sender.com';
  const fromName = msg.from?.name || fromAddr;
  const date = (msg.date || msg.receivedAt || new Date()).toUTCString();

  return [
    `From: ${fromName} <${fromAddr}>`,
    `To: ${msg.to}`,
    `Subject: ${msg.subject}`,
    `Date: ${date}`,
    `Message-ID: <${msg.id}@kurumi.vn>`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    msg.text || '(No content)',
  ].join('\r\n');
}

module.exports = router;
