/**
 * Email parser utilities
 * Wraps mailparser to extract structured data from raw email streams
 */

const { simpleParser } = require('mailparser');

/**
 * Parse a raw email buffer/stream into a structured message object
 * @param {Buffer|Readable} raw
 * @returns {Promise<ParsedMessage>}
 */
async function parseEmail(raw) {
  const parsed = await simpleParser(raw, {
    skipImageLinks: false,
    skipHtmlToText: false,
    skipTextToHtml: false,
    skipTextLinks: false,
  });

  // Extract from address
  const fromAddr = parsed.from?.value?.[0] || {};
  const from = {
    address: fromAddr.address || 'unknown@sender.com',
    name: fromAddr.name || fromAddr.address || 'Unknown Sender',
  };

  // Extract attachments (metadata only, no binary in memory for now)
  const attachments = (parsed.attachments || []).map((att) => ({
    filename: att.filename || 'attachment',
    contentType: att.contentType || 'application/octet-stream',
    size: att.size || 0,
    contentId: att.contentId || null,
    // Store actual content as base64 for download support
    content: att.content ? att.content.toString('base64') : null,
  }));

  return {
    from,
    to: parsed.to?.text || '',
    subject: parsed.subject || '(No Subject)',
    text: parsed.text || '',
    html: parsed.html || parsed.textAsHtml || parsed.text || '',
    date: parsed.date || new Date(),
    attachments,
    headers: {
      messageId: parsed.messageId || null,
      inReplyTo: parsed.inReplyTo || null,
      references: parsed.references || null,
    },
  };
}

/**
 * Sanitize HTML content for safe iframe rendering
 * Removes scripts and dangerous attributes while preserving layout
 * @param {string} html
 * @returns {string}
 */
function sanitizeHtml(html) {
  if (!html) return '';

  return html
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove on* event handlers
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]*/gi, '')
    // Remove javascript: URIs
    .replace(/href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, 'href="#"')
    // Remove meta refresh
    .replace(/<meta[^>]*http-equiv\s*=\s*["']refresh["'][^>]*>/gi, '')
    // Remove base tags that could hijack relative URLs
    .replace(/<base[^>]*>/gi, '');
}

/**
 * Extract a plain text preview from email (first 200 chars)
 * @param {string} text
 * @returns {string}
 */
function extractPreview(text) {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > 200 ? clean.slice(0, 200) + '…' : clean;
}

module.exports = {
  parseEmail,
  sanitizeHtml,
  extractPreview,
};
