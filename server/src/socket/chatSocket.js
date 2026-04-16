'use strict';

const ChatRoom = require('../mongoModels/chat/ChatRoom');
const chatService = require('../services/system/chat/chatModuleService');
const logger = require('../lib/logger');
const {
  buildRoomKey,
  buildUserKey,
  emitToRoomExcept,
} = require('./chatEmitter');

// Регистрирует socket-обработчики чата для подключённого пользователя.
module.exports = function chatSocket(_io, socket) {
  const userId = socket.user?.id;
  const companyId = socket.user?.companyId;

  if (!userId || !companyId) {
    logger.warn('[chatSocket] missing user/company on socket');
    socket.disconnect(true);
    return;
  }

  // Загружает комнату и проверяет, что текущий пользователь состоит в ней.
const getRoomForUser = async (roomId) => {
    const room = await ChatRoom.findOne({
      _id: roomId,
      companyId,
      'participants.userId': String(userId),
      isDeleted: false,
    });

    if (!room) {
      throw new Error('Room not found or access denied');
    }

    return room;
  };

  socket.join(buildUserKey(companyId, userId));

  socket.on('chat:join', async (payload, cb) => {
    try {
      const { roomId } = payload || {};
      if (!roomId) {
        throw new Error('roomId is required');
      }

      await getRoomForUser(roomId);
      socket.join(buildRoomKey(companyId, roomId));

      if (cb) {
        cb({ ok: true });
      }
    } catch (error) {
      logger.error('[chat:join] failed', { error: error.message });
      if (cb) {
        cb({ ok: false, error: error.message });
      }
    }
  });

  socket.on('chat:leave', async (payload, cb) => {
    try {
      const { roomId } = payload || {};
      if (!roomId) {
        throw new Error('roomId is required');
      }

      socket.leave(buildRoomKey(companyId, roomId));

      if (cb) {
        cb({ ok: true });
      }
    } catch (error) {
      logger.error('[chat:leave] failed', { error: error.message });
      if (cb) {
        cb({ ok: false, error: error.message });
      }
    }
  });

  socket.on('chat:send', async (payload, cb) => {
    try {
      const {
        roomId,
        text,
        attachments,
        replyTo,
        forwardFrom,
        isSystem,
        systemType,
        systemPayload,
        forwardBatchId,
        forwardBatchSeq,
      } = payload || {};

      if (!roomId) {
        throw new Error('roomId is required');
      }

      if (isSystem || systemType || systemPayload) {
        if (cb) {
          cb({ ok: true });
        }
        return;
      }

      if (!text && (!attachments || !attachments.length) && !forwardFrom) {
        throw new Error('text, attachments or forwardFrom required');
      }

      const message = await chatService.sendMessage({
        companyId,
        roomId,
        authorId: String(userId),
        text: text || '',
        attachments: attachments || [],
        replyTo,
        isSystem,
        systemType,
        systemPayload,
        forwardFrom,
        forwardBatchId,
        forwardBatchSeq,
      });

      const data = message.toObject ? message.toObject() : message;

      if (cb) {
        cb({ ok: true, data });
      }
    } catch (error) {
      logger.error('[chat:send] failed', { error: error.message });
      if (cb) {
        cb({ ok: false, error: error.message });
      }
    }
  });

  socket.on('chat:pin', async (payload, cb) => {
    try {
      const { roomId, messageId } = payload || {};
      if (!roomId || !messageId) {
        throw new Error('roomId and messageId are required');
      }

      const message = await chatService.pinMessage({
        companyId,
        roomId,
        messageId,
        userId: String(userId),
      });

      const data = message.toObject ? message.toObject() : message;
      if (cb) {
        cb({ ok: true, data });
      }
    } catch (error) {
      logger.error('[chat:pin] failed', { error: error.message });
      if (cb) {
        cb({ ok: false, error: error.message });
      }
    }
  });

  socket.on('chat:unpin', async (payload, cb) => {
    try {
      const { roomId, messageId } = payload || {};
      if (!roomId || !messageId) {
        throw new Error('roomId and messageId are required');
      }

      const message = await chatService.unpinMessage({
        companyId,
        roomId,
        messageId,
        userId: String(userId),
      });

      const data = message.toObject ? message.toObject() : message;
      if (cb) {
        cb({ ok: true, data });
      }
    } catch (error) {
      logger.error('[chat:unpin] failed', { error: error.message });
      if (cb) {
        cb({ ok: false, error: error.message });
      }
    }
  });

  socket.on('chat:typing', async (payload) => {
    try {
      const { roomId, isTyping, userName } = payload || {};
      if (!roomId) {
        return;
      }

      await getRoomForUser(roomId);

      emitToRoomExcept(socket, companyId, roomId, 'chat:typing', {
        roomId,
        userId,
        isTyping: Boolean(isTyping),
        userName: userName || null,
      });
    } catch (error) {
      logger.error('[chat:typing] failed', { error: error.message });
    }
  });

  socket.on('chat:read', async (payload, cb) => {
    try {
      const { roomId, messageId } = payload || {};
      if (!roomId || !messageId) {
        throw new Error('roomId and messageId required');
      }

      await chatService.markAsRead({
        companyId,
        roomId,
        userId: String(userId),
        messageId,
      });

      emitToRoomExcept(socket, companyId, roomId, 'chat:read', {
        roomId,
        userId,
        messageId,
      });

      if (cb) {
        cb({ ok: true });
      }
    } catch (error) {
      logger.error('[chat:read] failed', { error: error.message });
      if (cb) {
        cb({ ok: false, error: error.message });
      }
    }
  });
};
