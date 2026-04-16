'use strict';

const ChatRoom = require('../../../mongoModels/chat/ChatRoom');
const ChatMessage = require('../../../mongoModels/chat/ChatMessage');
const AppError = require('../../../errors/AppError');
const logger = require('../../../lib/logger');
const legacyChatService = require('./chatService');

// toPlain: выполняет вспомогательную бизнес-логику сервиса.
function toPlain(value) {
  if (!value) {
    return value;
  }
  return value.toObject ? value.toObject() : value;
}

// toMessageDto: выполняет вспомогательную бизнес-логику сервиса.
function toMessageDto(message) {
  const raw = toPlain(message) || {};
  return {
    ...raw,
    id: raw.id ? String(raw.id) : String(raw._id || ''),
    conversationId: raw.conversationId
      ? String(raw.conversationId)
      : String(raw.roomId || ''),
    senderId: raw.senderId ? String(raw.senderId) : String(raw.authorId || ''),
    text: raw.text || '',
    attachments: Array.isArray(raw.attachments) ? raw.attachments : raw.attachments || [],
    reactions: raw.reactions || {},
    createdAt: raw.createdAt || null,
  };
}

// toConversationDto: выполняет вспомогательную бизнес-логику сервиса.
function toConversationDto(room) {
  const raw = toPlain(room) || {};
  return {
    ...raw,
    id: raw.id ? String(raw.id) : String(raw._id || ''),
  };
}

// postMessageHooks: выполняет вспомогательную бизнес-логику сервиса.
async function postMessageHooks(_context) {
  return undefined;
}

// listConversations: возвращает список записей с фильтрами, сортировкой и пагинацией.
async function listConversations({ companyId, userId }) {
  const safeCompanyId = String(companyId || '');
  const safeUserId = String(userId || '');

  const rooms = await ChatRoom.find({
    companyId: safeCompanyId,
    'participants.userId': safeUserId,
    isDeleted: false,
  })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .lean();

  if (!rooms.length) {
    return [];
  }

  const countsByRoom = {};

  await Promise.all(
    rooms.map(async (room) => {
      const participants = room.participants || [];
      const me = participants.find((p) => String(p.userId) === safeUserId);
      const lastReadAt = me?.lastReadAt ? new Date(me.lastReadAt) : null;

      const filter = {
        companyId: safeCompanyId,
        roomId: room._id,
        isDeleted: { $ne: true },
        authorId: { $ne: safeUserId },
        isSystem: { $ne: true },
      };

      if (lastReadAt) {
        filter.createdAt = { $gt: lastReadAt };
      }

      countsByRoom[String(room._id)] = await ChatMessage.countDocuments(filter);
    })
  );

  return rooms.map((room) => {
    const roomId = String(room._id);
    return {
      ...toConversationDto(room),
      myUnreadCount: countsByRoom[roomId] || 0,
    };
  });
}

// createConversation: создаёт новую запись и возвращает результат.
async function createConversation({
  companyId,
  creatorId,
  type,
  otherUserId,
  title,
  participantIds,
}) {
  if (type === 'direct') {
    if (!otherUserId) {
      throw new AppError(400, 'otherUserId is required');
    }
    const room = await legacyChatService.findOrCreateDirectRoom({
      companyId,
      userId: creatorId,
      otherUserId: String(otherUserId),
    });
    return toConversationDto(room);
  }

  if (type === 'group') {
    if (!title) {
      throw new AppError(400, 'title is required');
    }
    if (!Array.isArray(participantIds) || !participantIds.length) {
      throw new AppError(400, 'participantIds is required');
    }

    const room = await legacyChatService.createGroupRoom({
      companyId,
      creatorId,
      title,
      participantIds: participantIds.map(String),
    });

    return toConversationDto(room);
  }

  throw new AppError(400, 'Unsupported conversation type');
}

// sendMessage: выполняет вспомогательную бизнес-логику сервиса.
async function sendMessage(payload) {
  const message = await legacyChatService.sendMessage(payload);

  try {
    await postMessageHooks({
      companyId: payload.companyId,
      conversationId: String(payload.roomId),
      messageId: String(message?._id || message?.id || ''),
      senderId: String(payload.authorId),
    });
  } catch (err) {
    logger.error('chat postMessageHooks failed', { error: err.message });
  }

  return toMessageDto(message);
}

// listMessages: возвращает список записей с фильтрами, сортировкой и пагинацией.
async function listMessages(payload) {
  const messages = await legacyChatService.getMessages(payload);
  return messages.map(toMessageDto);
}

// listPinnedMessages: возвращает список записей с фильтрами, сортировкой и пагинацией.
async function listPinnedMessages(payload) {
  const messages = await legacyChatService.getPinnedMessages(payload);
  return messages.map(toMessageDto);
}

// markAsRead: выполняет вспомогательную бизнес-логику сервиса.
async function markAsRead(payload) {
  await legacyChatService.markAsRead(payload);
  return { success: true };
}

// addReaction: добавляет реакцию к сообщению.
async function addReaction(payload) {
  return legacyChatService.toggleReaction(payload);
}

// removeReaction: удаляет запись с учётом бизнес-ограничений.
async function removeReaction(payload) {
  return legacyChatService.removeReaction(payload);
}

// toggleReaction: переключает реакцию пользователя на сообщении.
async function toggleReaction(payload) {
  return legacyChatService.toggleReaction(payload);
}

// getMessageReactions: возвращает данные по входным параметрам сервиса.
async function getMessageReactions(payload) {
  return legacyChatService.getMessageReactions(payload);
}

// pinMessage: выполняет вспомогательную бизнес-логику сервиса.
async function pinMessage(payload) {
  const message = await legacyChatService.pinMessage(payload);
  return toMessageDto(message);
}

// unpinMessage: выполняет вспомогательную бизнес-логику сервиса.
async function unpinMessage(payload) {
  const message = await legacyChatService.unpinMessage(payload);
  return toMessageDto(message);
}

// editMessage: выполняет вспомогательную бизнес-логику сервиса.
async function editMessage(payload) {
  const message = await legacyChatService.editMessage(payload);
  return toMessageDto(message);
}

// deleteMessage: удаляет запись с учётом бизнес-ограничений.
async function deleteMessage(payload) {
  const message = await legacyChatService.deleteMessage(payload);
  return toMessageDto(message);
}

// updateRoom: обновляет запись и возвращает актуальные данные.
async function updateRoom(payload) {
  const room = await legacyChatService.updateRoom(payload);
  return toConversationDto(room);
}

module.exports = {
  createConversation,
  listConversations,
  sendMessage,
  listMessages,
  markAsRead,
  addReaction,
  removeReaction,
  toggleReaction,
  getMessageReactions,
  listPinnedMessages,
  pinMessage,
  unpinMessage,
  editMessage,
  deleteMessage,
  updateRoom,
  postMessageHooks,
};
