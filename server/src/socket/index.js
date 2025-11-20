// src/socket/index.js
const { Server } = require('socket.io');
const tokenService = require('../utils/tokenService'); // <-- путь проверь, если utils лежит где-то иначе

const originsFromEnv =
  (process.env.CORS_ORIGINS &&
    process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)) ||
  (process.env.APP_URL ? [process.env.APP_URL.trim()] : []);

const WHITELIST = new Set([
  ...originsFromEnv,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

module.exports = function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin(origin, cb) {
        if (!origin || WHITELIST.has(origin)) return cb(null, true);
        return cb(new Error(`Socket CORS blocked: ${origin}`));
      },
      credentials: true,
    },
  });

  // 👉 сохраняем io глобально, чтобы сервисы могли слать события
  global.io = io;

  // 🔐 JWT-авторизация через твой tokenService.verifyAccess
  io.use(async (socket, next) => {
    try {
      const auth = socket.handshake.auth || {};
      const headers = socket.handshake.headers || {};
      const query = socket.handshake.query || {};

      let token =
        auth.token ||
        query.token ||
        (headers.authorization && headers.authorization.split(' ')[1]);

      if (!token) {
        return next(new Error('No auth token'));
      }

      const payload = await tokenService.verifyAccess(token);

      const userId = String(payload.sub);
      const companyId = payload.cid ? String(payload.cid) : '';

      if (!userId) {
        return next(new Error('Invalid access token payload (no sub)'));
      }

      socket.user = {
        id: userId,
        companyId,
        payload,
      };

      next();
    } catch (e) {
      console.error('[socket auth error]', e.message);
      next(new Error('Auth failed'));
    }
  });

  const chatSocket = require('./chatSocket');

  io.on('connection', (socket) => {
    console.log('[socket] connected', socket.id, 'user:', socket.user?.id);

    chatSocket(io, socket);

    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected', socket.id, reason);
    });
  });

  return io;
};