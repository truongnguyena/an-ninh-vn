/**
 * Mailbox API Routes (Web UI)
 * All endpoints under /api/mailbox
 */

const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const store = require('../store');
const { isValidDomain, isValidLocal, DOMAINS } = require('../utils/generator');
const { extractPreview } = require('../utils/parser');

// ─── Static routes FIRST (before /:address wildcard) ────────────────────

// GET /api/mailbox/domains/list
router.get('/domains/list', (req, res) => {
  return res.json({ domains: DOMAINS });
});

// GET /api/mailbox/stats/info
router.get('/stats/info', (req, res) => {
  return res.json(store.getStats());
});

// ─── POST /api/mailbox ────────────────────────────────────────────────────
// Create a new mailbox (random or custom address)
router.post('/', (req, res) => {
  try {
    const { domain, local, ttlMinutes } = req.body || {};

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
        return res.status(400).json({
          error: 'Invalid local part. Use 3-40 alphanumeric chars, dots, hyphens, underscores.',
        });
      }
      const dom = domain && DOMAINS.includes(domain) ? domain : DOMAINS[0];
      const address = `${local.toLowerCase()}@${dom}`;

      if (!isValidDomain(address)) {
        return res.status(400).json({ error: 'Domain not supported.' });
      }
      if (store.isAddressTaken(address)) {
        return res.status(409).json({
          error: 'Địa chỉ email này đã được sử dụng. Vui lòng chọn địa chỉ khác.',
          address,
        });
      }
      addressInfo = { address, local: local.toLowerCase(), domain: dom };
    } else {
      // Auto-generate a guaranteed unique address
      addressInfo = store.generateUniqueAddress(domain || null);
    }

    const mailbox = store.createMailbox(addressInfo.address, ttl);

    return res.status(201).json({
      address: mailbox.address,
      createdAt: mailbox.createdAt,
      expiresAt: mailbox.expiresAt,
      messageCount: mailbox.messages.length,
      unseenCount: mailbox.unseenCount,
      domains: DOMAINS,
    });
  } catch (err) {
    const status = err.message.includes('taken') ? 409 :
                   err.message.includes('capacity') ? 503 : 500;
    console.error('[Routes] POST /mailbox:', err.message);
    return res.status(status).json({ error: err.message });
  }
});

// ─── GET /api/mailbox/:address ────────────────────────────────────────────
router.get('/:address', (req, res) => {
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
    messages,
  });
});

// ─── GET /api/mailbox/:address/search ─────────────────────────────────────
router.get('/:address/search', (req, res) => {
  const { address } = req.params;
  const { q } = req.query;

  if (!isValidDomain(address)) {
    return res.status(400).json({ error: 'Domain not supported.' });
  }
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters.' });
  }

  const mailbox = store.getMailbox(address);
  if (!mailbox) return res.status(404).json({ error: 'Mailbox not found or expired.' });

  const results = store.searchMessages(address, q.trim());
  return res.json({
    query: q,
    count: results.length,
    messages: results.map((m) => ({
      id: m.id,
      from: m.from,
      subject: m.subject,
      preview: extractPreview(m.text),
      receivedAt: m.receivedAt,
      seen: m.seen,
      starred: m.starred,
    })),
  });
});

// ─── GET /api/mailbox/:address/:id ────────────────────────────────────────
router.get('/:address/:id', (req, res) => {
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

// ─── GET /api/mailbox/:address/:id/eml ────────────────────────────────────
// Download email as .eml file
router.get('/:address/:id/eml', (req, res) => {
  const { address, id } = req.params;
  const msg = store.getMessage(address, id);
  if (!msg) return res.status(404).json({ error: 'Message not found.' });

  const fromAddr = msg.from?.address || 'unknown@sender.com';
  const fromName = msg.from?.name || fromAddr;
  const date = (msg.date || msg.receivedAt || new Date()).toUTCString();

  const eml = [
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

  res.set('Content-Type', 'message/rfc822');
  res.set('Content-Disposition', `attachment; filename="${id.slice(0, 8)}.eml"`);
  res.send(eml);
});

// ─── GET /api/mailbox/:address/:id/attachment/:index ──────────────────────
router.get('/:address/:id/attachment/:index', (req, res) => {
  const { address, id, index } = req.params;
  const msg = store.getMessage(address, id);
  if (!msg) return res.status(404).json({ error: 'Message not found.' });

  const att = msg.attachments[parseInt(index)];
  if (!att || !att.content) return res.status(404).json({ error: 'Attachment not found.' });

  const buf = Buffer.from(att.content, 'base64');
  res.set('Content-Type', att.contentType || 'application/octet-stream');
  res.set('Content-Disposition', `attachment; filename="${att.filename}"`);
  res.set('Content-Length', buf.length);
  res.send(buf);
});

// ─── PUT /api/mailbox/:address/:id/star ───────────────────────────────────
// Star or unstar a message
router.put('/:address/:id/star', (req, res) => {
  const { address, id } = req.params;
  const { starred = true } = req.body || {};

  if (!isValidDomain(address)) {
    return res.status(400).json({ error: 'Domain not supported.' });
  }

  const msg = store.starMessage(address, id, Boolean(starred));
  if (!msg) return res.status(404).json({ error: 'Message not found.' });

  return res.json({ id: msg.id, starred: msg.starred });
});

// ─── PUT /api/mailbox/:address/read-all ───────────────────────────────────
// Mark all messages as read
router.put('/:address/read-all', (req, res) => {
  const { address } = req.params;

  if (!isValidDomain(address)) {
    return res.status(400).json({ error: 'Domain not supported.' });
  }

  const ok = store.markAllSeen(address);
  if (!ok) return res.status(404).json({ error: 'Mailbox not found.' });

  return res.json({ message: 'All messages marked as read.' });
});

// ─── POST /api/mailbox/:address/webhook ───────────────────────────────────
// Register a webhook URL for new-message notifications
router.post('/:address/webhook', (req, res) => {
  const { address } = req.params;
  const { url } = req.body || {};

  if (!isValidDomain(address)) {
    return res.status(400).json({ error: 'Domain not supported.' });
  }

  // Validate URL if provided
  if (url) {
    try { new URL(url); } catch (_) {
      return res.status(400).json({ error: 'Invalid webhook URL.' });
    }
  }

  const mailbox = store.setWebhook(address, url || null);
  if (!mailbox) return res.status(404).json({ error: 'Mailbox not found.' });

  return res.json({
    message: url ? `Webhook registered.` : 'Webhook removed.',
    webhook: url || null,
  });
});

// ─── DELETE /api/mailbox/:address ─────────────────────────────────────────
router.delete('/:address', (req, res) => {
  const { address } = req.params;
  const deleted = store.deleteMailbox(address);
  if (!deleted) return res.status(404).json({ error: 'Mailbox not found.' });
  return res.json({ message: 'Mailbox deleted. Address is permanently retired.' });
});

// ─── DELETE /api/mailbox/:address/messages ────────────────────────────────
router.delete('/:address/messages', (req, res) => {
  const { address } = req.params;
  const cleared = store.clearMessages(address);
  if (!cleared) return res.status(404).json({ error: 'Mailbox not found.' });
  return res.json({ message: 'All messages cleared.' });
});

// ─── PUT /api/mailbox/:address/extend ─────────────────────────────────────
router.put('/:address/extend', (req, res) => {
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

// ─── POST /api/mailbox/test/send ─────────────────────────────────────────
router.post('/test/send', async (req, res) => {
  const { to, subject, text, html } = req.body || {};

  if (!to) return res.status(400).json({ error: 'Recipient (to) is required.' });
  if (!isValidDomain(to)) return res.status(400).json({ error: 'Recipient domain not supported.' });
  if (!store.mailboxExists(to)) return res.status(404).json({ error: 'Mailbox not found.' });

  try {
    const transport = nodemailer.createTransport({
      host: '127.0.0.1',
      port: parseInt(process.env.SMTP_PORT || '2525'),
      secure: false,
      ignoreTLS: true,
    });

    const info = await transport.sendMail({
      from: '"KurumiMail Test" <test@kurumi.vn>',
      to,
      subject: subject || '📬 Test Email từ KurumiMail',
      text: text || `Xin chào! Đây là email thử nghiệm gửi lúc ${new Date().toLocaleString('vi-VN')}.\n\nHộp thư tạm thời của bạn đang hoạt động! ✉️`,
      html: html || `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0f0f1a;color:#e2e8f0;border-radius:12px;">
          <h2 style="color:#a78bfa;margin-bottom:16px;">📬 KurumiMail Test</h2>
          <p style="margin-bottom:12px;">Xin chào! Đây là <strong style="color:#c4b5fd;">email thử nghiệm</strong> gửi lúc <em>${new Date().toLocaleString('vi-VN')}</em>.</p>
          <p>Hộp thư tạm thời của bạn đang hoạt động tốt! ✉️</p>
          <div style="background:#1e1b4b;border-left:4px solid #7c3aed;padding:12px;border-radius:4px;margin-top:16px;">
            <p style="margin:0;font-size:14px;color:#c4b5fd;">Gửi đến: <strong>${to}</strong></p>
          </div>
          <p style="margin-top:20px;font-size:12px;color:#64748b;">Email này sẽ tự động xóa khi hộp thư hết hạn.</p>
        </div>`,
    });

    return res.json({ message: 'Email thử nghiệm đã được gửi.', messageId: info.messageId });
  } catch (err) {
    console.error('[Routes] POST /test/send:', err.message);
    return res.status(500).json({ error: 'Không thể gửi email: ' + err.message });
  }
});

module.exports = router;
