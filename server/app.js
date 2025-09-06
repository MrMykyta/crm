require('dotenv').config();
const express = require('express');
const app = express();

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const rootRouter = require('./src/routes/rootRouter');
const errorHandler = require('./src/middleware/errorHandler');

const uploadRoutes = require('./src/routes/system/uploadRouter');

const { initCron } = require('./boot/cron');
const path = require('path');


app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // было same-origin
  // при необходимости можно ещё отключить crossOriginEmbedderPolicy,
  // если что-то ломается с воркерами/канвасом:
  // crossOriginEmbedderPolicy: false,
}));
app.use(compression());

const origins = process.env.DEV_ORIGIN ? process.env.DEV_ORIGIN.split(',') : ['http://localhost:3000'];
app.use(cors({ origin: origins, credentials: true }));

app.use(express.json({ limit: '2mb' }));
// убери прямой static, если нельзя — хотя бы отключи листинг
// app.use('/uploads', express.static('public/uploads', { dotfiles: 'deny', etag: true, index: false }));

const STATIC_DIR = path.join(__dirname, 'uploads');

app.use('/static', express.static(STATIC_DIR, {
  maxAge: '30d',
  immutable: true,
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
  }
}));

app.use('/api', uploadRoutes);
app.use('/api', rootRouter);
app.use(errorHandler);

initCron();
module.exports = app;