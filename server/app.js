require('dotenv').config();
const express = require('express');
const fs = require('fs');
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
const { STORAGE_ROOT, PRIVATE_ROOT, PUBLIC_ROOT, TMP_ROOT } = require('./src/config/files');
const { APP_PUBLIC_URL } = require('./src/config/publicUrl');
const { allowedOrigins, validateOrigin } = require('./src/config/cors');
require('./src/modules/systemChatModule');
const { initCron } = require('./boot/cron');

// 🔹 MongoDB
const { connectMongo } = require('./src/db/mongo');
const shouldSkipMongo = process.env.SKIP_MONGO_CONNECT === '1';
const shouldSkipCron = process.env.SKIP_CRON === '1';

function ensureFileStorageDirs() {
  const dirs = [STORAGE_ROOT, PRIVATE_ROOT, PUBLIC_ROOT, TMP_ROOT];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

try {
  ensureFileStorageDirs();
} catch (e) {
  logger.error('[Files] Failed to initialize storage directories', { error: e.message });
  process.exit(1);
}

logger.info(`[Config] APP_PUBLIC_URL=${APP_PUBLIC_URL}`);

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

const cspFrameAncestors = ["'self'", ...allowedOrigins];
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
    origin: validateOrigin,
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// API responses are consumed by RTK Query/fetchBaseQuery and must always carry
// a JSON body. Browser-level conditional caching can turn JSON API responses
// into 304 responses with an empty body after rebuilds/full reloads.
app.use('/api', (req, res, next) => {
  delete req.headers['if-none-match'];
  delete req.headers['if-modified-since'];
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

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
