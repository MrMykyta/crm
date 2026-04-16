'use strict';

const chatService = require('../../../services/system/chat/chatModuleService');
const AppError = require('../../../errors/AppError');
const asyncHandler = require('../../../middleware/asyncHandler');
const { ok, created } = require('../../../http/response');

// Формирует контекст действия пользователя для чат-операций.
function actorFrom(req) {
  return {
    userId: String(req.user.id),
    companyId: String(req.user.companyId),
    user: req.user,
  };
}

module.exports.listRooms = asyncHandler(async (req, res) => {
  const actor = actorFrom(req);
  const rooms = await chatService.listConversations({
    companyId: actor.companyId,
    userId: actor.userId,
  });

  return ok(res, rooms);
});

module.exports.getOrCreateDirect = asyncHandler(async (req, res) => {
  const actor = actorFrom(req);
  const { otherUserId } = req.body || {};

  const room = await chatService.createConversation({
    companyId: actor.companyId,
    creatorId: actor.userId,
    type: 'direct',
    otherUserId,
  });

  return ok(res, room);
});

module.exports.createGroup = asyncHandler(async (req, res) => {
  const actor = actorFrom(req);
  const { title, participantIds } = req.body || {};

  const room = await chatService.createConversation({
    companyId: actor.companyId,
    creatorId: actor.userId,
    type: 'group',
    title,
    participantIds,
  });

  return created(res, room);
});

module.exports.listMessages = asyncHandler(async (req, res) => {
  const actor = actorFrom(req);
  const { roomId } = req.params;
  const { before, limit } = req.query;

  const messages = await chatService.listMessages({
    companyId: actor.companyId,
    roomId,
    userId: actor.userId,
    user: actor.user,
    limit: limit ? Number(limit) : 50,
    before,
  });

  return ok(res, messages);
});

module.exports.listPinnedMessages = asyncHandler(async (req, res) => {
  const actor = actorFrom(req);
  const { roomId } = req.params;

  const messages = await chatService.listPinnedMessages({
    companyId: actor.companyId,
    roomId,
    userId: actor.userId,
    user: actor.user,
  });

  return ok(res, messages);
});

module.exports.sendMessage = asyncHandler(async (req, res) => {
  const actor = actorFrom(req);
  const { roomId } = req.params;

  const message = await chatService.sendMessage({
    companyId: actor.companyId,
    roomId,
    authorId: actor.userId,
    user: actor.user,
    text: req.body?.text || '',
    attachments: req.body?.attachments || [],
    replyTo: req.body?.replyTo,
    forwardFrom: req.body?.forwardFrom,
    forwardBatchId: req.body?.forwardBatchId,
    forwardBatchSeq: req.body?.forwardBatchSeq,
    allowSystem: false,
  });

  return created(res, message);
});

module.exports.listMessageReactions = asyncHandler(async (req, res) => {
  const actor = actorFrom(req);
  const { messageId } = req.params;

  const reactions = await chatService.getMessageReactions({
    companyId: actor.companyId,
    messageId,
    userId: actor.userId,
  });

  return res.status(200).json({ reactions });
});

module.exports.toggleReaction = asyncHandler(async (req, res) => {
  const actor = actorFrom(req);
  const { messageId } = req.params;

  const payload = await chatService.toggleReaction({
    companyId: actor.companyId,
    messageId,
    userId: actor.userId,
    emoji: req.body?.emoji,
  });

  return res.status(200).json(payload);
});

module.exports.removeReaction = asyncHandler(async (req, res) => {
  const actor = actorFrom(req);
  const { messageId, emoji: encodedEmoji } = req.params;

  const payload = await chatService.removeReaction({
    companyId: actor.companyId,
    messageId,
    userId: actor.userId,
    emoji: encodedEmoji ? decodeURIComponent(encodedEmoji) : '',
  });

  return res.status(200).json(payload);
});

module.exports.markRead = asyncHandler(async (req, res) => {
  const actor = actorFrom(req);
  const { roomId } = req.params;
  const { messageId } = req.body || {};

  if (!messageId) {
    throw new AppError(400, 'messageId is required');
  }

  const result = await chatService.markAsRead({
    companyId: actor.companyId,
    roomId,
    userId: actor.userId,
    messageId,
  });

  return res.status(200).json(result);
});

module.exports.pinMessage = asyncHandler(async (req, res) => {
  const actor = actorFrom(req);
  const { roomId, messageId } = req.params;

  const message = await chatService.pinMessage({
    companyId: actor.companyId,
    roomId,
    messageId,
    userId: actor.userId,
    user: actor.user,
  });

  return ok(res, message);
});

module.exports.unpinMessage = asyncHandler(async (req, res) => {
  const actor = actorFrom(req);
  const { roomId, messageId } = req.params;

  const message = await chatService.unpinMessage({
    companyId: actor.companyId,
    roomId,
    messageId,
    userId: actor.userId,
    user: actor.user,
  });

  return ok(res, message);
});

module.exports.editMessage = asyncHandler(async (req, res) => {
  const actor = actorFrom(req);
  const { roomId, messageId } = req.params;

  const message = await chatService.editMessage({
    companyId: actor.companyId,
    roomId,
    messageId,
    userId: actor.userId,
    user: actor.user,
    text: req.body?.text,
  });

  return ok(res, message);
});

module.exports.deleteMessage = asyncHandler(async (req, res) => {
  const actor = actorFrom(req);
  const { roomId, messageId } = req.params;

  const message = await chatService.deleteMessage({
    companyId: actor.companyId,
    roomId,
    messageId,
    userId: actor.userId,
    user: actor.user,
  });

  return ok(res, message);
});

module.exports.updateRoom = asyncHandler(async (req, res) => {
  const actor = actorFrom(req);
  const { roomId } = req.params;
  const { title, avatarUrl, isArchived } = req.body || {};

  const room = await chatService.updateRoom({
    companyId: actor.companyId,
    roomId,
    userId: actor.userId,
    patch: { title, avatarUrl, isArchived },
  });

  return ok(res, room);
});

