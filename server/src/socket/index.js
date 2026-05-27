// src/socket/index.js
const { Server } = require('socket.io');
const tokenService = require('../utils/tokenService');
const logger = require('../lib/logger');
const { validateOrigin } = require('../config/cors');

// Инициализирует Socket.IO, настраивает auth и подключает прикладные сокет-модули.
module.exports = function initSocket(server) {
  const io = new Server(server, {
    cors: {
      // Проверяет origin входящего socket-соединения по CORS_ORIGINS.
      origin: validateOrigin,
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
      logger.error('[socket auth error]', { message: e.message });
      next(new Error('Auth failed'));
    }
  });

  const chatSocket = require('./chatSocket');

  io.on('connection', (socket) => {
    logger.info('[socket] connected', { socketId: socket.id, userId: socket.user?.id || null });

    chatSocket(io, socket);

    socket.on('disconnect', (reason) => {
      logger.info('[socket] disconnected', { socketId: socket.id, reason });
    });
  });

  return io;
};
