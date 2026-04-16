require('dotenv').config();
const express = require('express');
const app = express();

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

const rootRouter = require('./src/routes/rootRouter');
const errorHandler = require('./src/middleware/errorHandler');
const requestContext = require('./src/middleware/requestContext');
const logger = require('./src/lib/logger');
const { mountAll } = require('./src/lib/moduleRegistry');
require('./src/modules/systemChatModule');
const { initCron } = require('./boot/cron');

// 🔹 MongoDB
const { connectMongo } = require('./src/db/mongo');
const shouldSkipMongo = process.env.SKIP_MONGO_CONNECT === '1';
const shouldSkipCron = process.env.SKIP_CRON === '1';

async function initMongoIfEnabled() {
  if (shouldSkipMongo) {
    logger.info('[Mongo] Connection skipped by SKIP_MONGO_CONNECT=1');
    return;
  }

  try {
    await connectMongo();
  } catch (e) {
    logger.error('[Mongo] Failed to connect', { error: e.message });
    process.exit(1);
  }
}

initMongoIfEnabled();

/* ---------- Security / misc ---------- */
app.set('trust proxy', 1);
app.use(requestContext);

// Поддержка нескольких источников: CORS_ORIGINS="https://site.tld,https://www.site.tld,http://localhost:3000"
const originsFromEnv =
  (process.env.CORS_ORIGINS && process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)) ||
  (process.env.APP_URL ? [process.env.APP_URL.trim()] : []);

const whitelist = new Set([
  ...originsFromEnv,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

const cspFrameAncestors = ["'self'", ...whitelist];
const cspDirectives = helmet.contentSecurityPolicy.getDefaultDirectives();
cspDirectives['frame-ancestors'] = cspFrameAncestors;

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: cspDirectives,
    },
    // crossOriginEmbedderPolicy: false, // раскомментируй, если ломаются воркеры/канвас
  })
);
app.use(compression({
  filter: (req, res) => {
    // для SSE — НЕЛЬЗЯ сжимать
    const type = req.headers.accept || '';
    if (type.includes('text/event-stream')) return false;
    return compression.filter(req, res);
  }
}));

// Небольшой rate-limit для анонимных POST/PUT/DEL (регистрация/логин/верификация)
app.use(
  ['/api/auth', '/api/users', '/api/password', '/api/verify'],
  rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true })
);

app.use(
  cors({
    origin(origin, cb) {
      // Разрешаем:
      //  - запросы без Origin (curl/healthcheck)
      //  - те, что есть в whitelist
      if (!origin || whitelist.has(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

/* ---------- Files (Unified) ---------- */
// Private files are NEVER served via express.static.
// Public files are served only via /api/public-files/:publicKey.

/* ---------- Health ---------- */
app.get('/health', (_req, res) => res.status(200).send('OK'));
app.get('/api/health', (_req, res) => res.status(200).json({ data: { status: 'ok' } }));

/* ---------- API ---------- */
app.use('/api', rootRouter);
mountAll(app, '/api');

/* ---------- Errors ---------- */
app.use(errorHandler);

/* ---------- Cron ---------- */
if (shouldSkipCron) {
  logger.info('[Cron] init skipped by SKIP_CRON=1');
} else {
  initCron();
}

module.exports = app;
