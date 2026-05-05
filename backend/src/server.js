/**
 * KurumiMail Backend Server — Production Ready
 * Serves both the REST API and the built React frontend (dist/)
 */

require('dotenv').config();

const path    = require('path');
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const compression = require('compression');
const rateLimit   = require('express-rate-limit');
const { startSMTP, smtpServer } = require('./smtp');
const mailboxRoutes  = require('./routes/mailbox');
const developerRoutes = require('./routes/developer');
const v1Routes       = require('./routes/v1');
const { requireApiKey } = require('./middleware/auth');

const PORT     = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD  = NODE_ENV === 'production';

const app = express();

// ─── Trust proxy (for Nginx / Cloudflare) ────────────────────────────────────
if (IS_PROD) app.set('trust proxy', 1);

// ─── Security Headers ─────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: IS_PROD ? {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'"],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:      ["'self'", 'data:', 'blob:'],
      frameSrc:    ["'self'"],
      connectSrc:  ["'self'"],
      objectSrc:   ["'none'"],
    },
  } : false,
}));

// ─── Compression ──────────────────────────────────────────────────────────────
app.use(compression());

// ─── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // In production: whitelist from env; in dev: allow all
    if (!IS_PROD || !origin || ALLOWED_ORIGINS.length === 0) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  credentials: false,
}));

// ─── Body Parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ─── Rate Limiting ────────────────────────────────────────────────────────────

const uiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Quá nhiều requests. Vui lòng thử lại sau.' },
});

const createLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Quá nhiều lần tạo hộp thư. Vui lòng đợi một phút.' },
});

const v1Limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Global API rate limit exceeded.' },
  skip: (req) => !!req.headers['x-api-key'],
});

app.use('/api/mailbox', uiLimiter);
app.use('/api/mailbox', (req, res, next) => {
  if (req.method === 'POST' && req.path === '/') return createLimiter(req, res, next);
  next();
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/mailbox',   mailboxRoutes);
app.use('/api/developer', developerRoutes);
app.use('/api/v1', v1Limiter, requireApiKey, v1Routes);

// Health check
app.get('/api/health', (req, res) => {
  const { getStats } = require('./store');
  res.json({
    status:    'ok',
    env:       NODE_ENV,
    uptime:    Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    version:   '2.1.0',
    ...getStats(),
  });
});

// ─── Serve Frontend (Production) ─────────────────────────────────────────────
const DIST = path.join(__dirname, '../../frontend/dist');

if (IS_PROD) {
  // Serve static assets (JS, CSS, images, etc.)
  app.use(express.static(DIST, {
    maxAge:  '7d',           // Cache static assets 7 days
    etag:    true,
    index:   false,          // Let the catch-all below handle index.html
  }));

  // SPA fallback — send index.html for all non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(DIST, 'index.html'));
  });
}

// ─── Error Handlers ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

app.use((err, req, res, _next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS policy violation.' });
  }
  console.error('[Server] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error.' });
});

// ─── Startup ──────────────────────────────────────────────────────────────────
let httpServer;

async function start() {
  try {
    await startSMTP();

    httpServer = app.listen(PORT, '0.0.0.0', () => {
      const bar = '═'.repeat(44);
      console.log(`\n╔${bar}╗`);
      console.log(`║   KurumiMail v2.1 — ${NODE_ENV.toUpperCase().padEnd(22)}║`);
      console.log(`╠${bar}╣`);
      console.log(`║  HTTP API  → http://0.0.0.0:${PORT}${' '.repeat(14)}║`);
      console.log(`║  SMTP      → port ${process.env.SMTP_PORT || 2525}${' '.repeat(25)}║`);
      if (IS_PROD) {
      console.log(`║  Frontend  → served from dist/        ║`);
      }
      console.log(`║  Health    → /api/health              ║`);
      console.log(`╚${bar}╝\n`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err.message);
    process.exit(1);
  }
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n[Server] ${signal} — shutting down gracefully...`);
  if (httpServer) {
    httpServer.close(() => {
      console.log('[Server] HTTP closed.');
      if (smtpServer) {
        smtpServer.close(() => { console.log('[SMTP] Closed.'); process.exit(0); });
      } else {
        process.exit(0);
      }
    });
    setTimeout(() => { console.error('[Server] Force exit.'); process.exit(1); }, 10000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

start();
