require('dotenv').config();
const express = require('express');
const app = express();

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const rootRouter = require('./src/routes/rootRouter');
const errorHandler = require('./src/middleware/errorHandler');

app.set('trust proxy', 1);
app.use(helmet());
app.use(compression());

const origins = process.env.DEV_ORIGIN ? process.env.DEV_ORIGIN.split(',') : ['http://localhost:3000'];
app.use(cors({ origin: origins, credentials: true }));

app.use(express.json({ limit: '2mb' }));
// убери прямой static, если нельзя — хотя бы отключи листинг
// app.use('/uploads', express.static('public/uploads', { dotfiles: 'deny', etag: true, index: false }));
app.use(express.static('public/uploads'));
app.use('/api', rootRouter);
app.use(errorHandler);

module.exports = app;