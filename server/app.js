require('dotenv').config();
const express = require('express');
const app = express();

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const path = require('path');

const rootRouter = require('./src/routes/rootRouter');
const uploadRoutes = require('./src/routes/system/uploadRouter');
const errorHandler = require('./src/middleware/errorHandler');
const { initCron } = require('./boot/cron');

/* ---------- Security / misc ---------- */
app.set('trust proxy', 1);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // crossOriginEmbedderPolicy: false, // раскомментируй, если ломаются воркеры/канвас
  })
);
app.use(compression());

// Небольшой rate-limit для анонимных POST/PUT/DEL (регистрация/логин/верификация)
app.use(
  ['/api/auth', '/api/users', '/api/password', '/api/verify'],
  rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true })
);

/* ---------- CORS ---------- */
// Поддержка нескольких источников: CORS_ORIGINS="https://site.tld,https://www.site.tld,http://localhost:3000"
const originsFromEnv =
  (process.env.CORS_ORIGINS && process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)) ||
  (process.env.APP_URL ? [process.env.APP_URL.trim()] : []);

const whitelist = new Set([
  ...originsFromEnv,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

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

app.use(express.json({ limit: '2mb' }));

/* ---------- Static (/uploads -> public/uploads) ---------- */
// Caddy проксирует /uploads/* на API → реально отдаём из public/uploads
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'public', 'uploads'), {
    dotfiles: 'deny',
    etag: true,
    maxAge: '7d',
    index: false,
    setHeaders(res) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  })
);

// Если нужна отдельная статика по /static (не путать с uploads)
app.use(
  '/static',
  express.static(path.join(__dirname, 'uploads'), {
    maxAge: '30d',
    immutable: true,
    index: false,
    setHeaders(res) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    },
  })
);

/* ---------- Health ---------- */
app.get('/health', (_req, res) => res.status(200).send('OK'));

/* ---------- API ---------- */
app.use('/api', uploadRoutes);
app.use('/api', rootRouter);

/* ---------- Errors ---------- */
app.use(errorHandler);

/* ---------- Cron ---------- */
initCron();

module.exports = app;