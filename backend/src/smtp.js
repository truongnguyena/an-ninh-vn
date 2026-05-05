/**
 * SMTP Server
 * Listens on port 2525 (configurable), accepts all inbound email
 * for whitelisted domains, parses and stores in memory.
 */

require('dotenv').config();

const { SMTPServer } = require('smtp-server');
const { parseEmail } = require('./utils/parser');
const store = require('./store');
const { isValidDomain, DOMAINS } = require('./utils/generator');

const SMTP_PORT = parseInt(process.env.SMTP_PORT || '2525');

const smtpServer = new SMTPServer({
  // Disable TLS for local development
  secure: false,
  disabledCommands: ['AUTH', 'STARTTLS'],

  // Log connection info
  logger: false,

  // Banner shown to connecting clients
  banner: 'KurumiMail SMTP Ready',

  // Accept all senders (we filter on recipient)
  onMailFrom(address, session, callback) {
    return callback(); // accept all senders
  },

  // Only accept email to our configured domains
  onRcptTo(address, session, callback) {
    const recipient = address.address.toLowerCase();
    if (!isValidDomain(recipient)) {
      return callback(new Error(`Domain not accepted. Supported: ${DOMAINS.join(', ')}`));
    }

    // Check if the mailbox exists in our store
    if (!store.mailboxExists(recipient)) {
      // Silently accept but won't deliver — mailbox doesn't exist
      // We still accept so we don't leak info about which addresses exist
      session._unknownRecipient = recipient;
    } else {
      session._recipient = recipient;
    }

    return callback();
  },

  // Process the email data
  async onData(stream, session, callback) {
    try {
      // Collect stream into buffer
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks);

      const recipient = session._recipient;

      // If recipient didn't exist when RCPT TO was processed, skip
      if (!recipient) {
        return callback();
      }

      // Parse the email
      const parsed = await parseEmail(raw);

      // Add to store
      const msg = store.addMessage(recipient, parsed);

      if (msg) {
        console.log(
          `[SMTP] Delivered: ${parsed.from.address} → ${recipient} | Subject: "${parsed.subject}"`
        );
      }

      return callback();
    } catch (err) {
      console.error('[SMTP] Error processing email:', err.message);
      return callback(new Error('Failed to process email'));
    }
  },

  onError(err) {
    console.error('[SMTP] Server error:', err.message);
  },
});

function startSMTP() {
  return new Promise((resolve, reject) => {
    smtpServer.listen(SMTP_PORT, '0.0.0.0', (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`[SMTP] Server listening on port ${SMTP_PORT}`);
        console.log(`[SMTP] Accepting domains: ${DOMAINS.join(', ')}`);
        resolve(smtpServer);
      }
    });
  });
}

module.exports = { startSMTP, smtpServer };
