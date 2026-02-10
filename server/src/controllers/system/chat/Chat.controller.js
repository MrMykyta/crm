// src/controllers/chat/chatController.js
const chatService = require("../../../services/system/chat/chatService");
const ChatRoom = require("../../../mongoModels/chat/ChatRoom");
const ChatMessage = require("../../../mongoModels/chat/ChatMessage");

/**
 * GET /api/chat/rooms
 * Возвращаем список комнат + myUnreadCount для текущего пользователя
 */
module.exports.listRooms = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const companyId = String(req.user.companyId);

    // 1) тащим все комнаты, где участвует юзер
    const rooms = await ChatRoom.find({
      companyId,
      "participants.userId": userId,
      isDeleted: false,
    })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .lean();

    if (!rooms.length) {
      return res.json({ data: [] });
    }

    // 2) для каждой комнаты считаем непрочитанные сообщения
    //    критерия:
    //    - сообщение НЕ от меня
    //    - не isSystem (по желанию, чтобы не считать системные)
    //    - createdAt > lastReadAt участника (если lastReadAt есть)
    const countsByRoom = {};

    await Promise.all(
      rooms.map(async (room) => {
        const roomId = room._id;
        const participants = room.participants || [];

        const me = participants.find(
          (p) => String(p.userId) === String(userId)
        );

        const lastReadAt = me?.lastReadAt
          ? new Date(me.lastReadAt)
          : null;

        const filter = {
          companyId,
          roomId,
          isDeleted: { $ne: true },
          authorId: { $ne: userId },
          // если не хочешь считать системные как непрочитанные — оставь это условие
          isSystem: { $ne: true },
        };

        if (lastReadAt) {
          filter.createdAt = { $gt: lastReadAt };
        }

        const cnt = await ChatMessage.countDocuments(filter);
        countsByRoom[String(roomId)] = cnt;
      })
    );

    // 3) приклеиваем myUnreadCount к каждой комнате
    const enriched = rooms.map((room) => {
      const idStr = String(room._id);
      const myUnreadCount = countsByRoom[idStr] || 0;

      return {
        ...room,
        myUnreadCount,
      };
    });

    res.json({ data: enriched });
  } catch (e) {
    console.error("[chatController.listRooms]", e);
    next(e);
  }
};

/**
 * POST /api/chat/direct
 * body: { otherUserId }
 */
module.exports.getOrCreateDirect = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const companyId = String(req.user.companyId);
    const { otherUserId } = req.body;

    if (!otherUserId) {
      return res.status(400).json({ error: "otherUserId is required" });
    }

    const room = await chatService.findOrCreateDirectRoom({
      companyId,
      userId,
      otherUserId: String(otherUserId),
    });

    res.json({ data: room });
  } catch (e) {
    console.error("[chatController.getOrCreateDirect]", e);
    next(e);
  }
};

/**
 * GET /api/chat/rooms/:roomId/messages
 */
module.exports.listMessages = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const companyId = String(req.user.companyId);
    const { roomId } = req.params;
    const { before, limit } = req.query;

    const messages = await chatService.getMessages({
      companyId,
      roomId,
      userId,
      user: req.user,
      limit: limit ? Number(limit) : 50,
      before,
    });

    res.json({ data: messages });
  } catch (e) {
    console.error("[chatController.listMessages]", e);
    next(e);
  }
};

/**
 * GET /api/chat/rooms/:roomId/pins
 */
module.exports.listPinnedMessages = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const companyId = String(req.user.companyId);
    const { roomId } = req.params;

    const messages = await chatService.getPinnedMessages({
      companyId,
      roomId,
      userId,
      user: req.user,
    });

    res.json({ data: messages });
  } catch (e) {
    console.error("[chatController.listPinnedMessages]", e);
    next(e);
  }
};

/**
 * POST /api/chat/rooms/:roomId/messages
 */
module.exports.sendMessage = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const companyId = String(req.user.companyId);
    const { roomId } = req.params;

    const {
      text,
      attachments,
      replyTo,
      forwardFrom,
      forwardBatchId,
      forwardBatchSeq,
    } = req.body;

    const msg = await chatService.sendMessage({
      companyId,
      roomId,
      authorId: userId,
      user: req.user,
      text: text || "",
      attachments: attachments || [],
      replyTo,
      forwardFrom,
      forwardBatchId,
      forwardBatchSeq,
      allowSystem: false,
    });

    res.status(201).json({ data: msg });
  } catch (e) {
    console.error("[chatController.sendMessage]", e);
    next(e);
  }
};

/**
 * GET /api/chat/messages/:messageId/reactions
 */
module.exports.listMessageReactions = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const companyId = String(req.user.companyId);
    const { messageId } = req.params;

    const reactions = await chatService.getMessageReactions({
      companyId,
      messageId,
      userId,
    });

    res.json({ reactions });
  } catch (e) {
    console.error("[chatController.listMessageReactions]", e);
    next(e);
  }
};

/**
 * POST /api/chat/messages/:messageId/reactions
 */
module.exports.toggleReaction = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const companyId = String(req.user.companyId);
    const { messageId } = req.params;
    const { emoji } = req.body || {};

    const payload = await chatService.toggleReaction({
      companyId,
      messageId,
      userId,
      emoji,
    });

    res.json(payload);
  } catch (e) {
    console.error("[chatController.toggleReaction]", e);
    next(e);
  }
};

/**
 * DELETE /api/chat/messages/:messageId/reactions/:emoji
 */
module.exports.removeReaction = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const companyId = String(req.user.companyId);
    const { messageId, emoji: emojiParam } = req.params;
    const emoji = emojiParam ? decodeURIComponent(emojiParam) : "";

    const payload = await chatService.removeReaction({
      companyId,
      messageId,
      userId,
      emoji,
    });

    res.json(payload);
  } catch (e) {
    console.error("[chatController.removeReaction]", e);
    next(e);
  }
};

/**
 * POST /api/chat/rooms/:roomId/read
 */
module.exports.markRead = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const companyId = String(req.user.companyId);
    const { roomId } = req.params;
    const { messageId } = req.body;

    if (!messageId) {
      return res.status(400).json({ error: "messageId is required" });
    }

    await chatService.markAsRead({
      companyId,
      roomId,
      userId,
      messageId,
    });

    res.json({ success: true });
  } catch (e) {
    console.error("[chatController.markRead]", e);
    next(e);
  }
};

module.exports.createGroup = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const companyId = String(req.user.companyId);
    const { title, participantIds } = req.body || {};

    if (!title) {
      return res.status(400).json({ error: "title is required" });
    }
    if (!Array.isArray(participantIds) || !participantIds.length) {
      return res
        .status(400)
        .json({ error: "participantIds is required" });
    }

    const room = await chatService.createGroupRoom({
      companyId,
      creatorId: userId,
      title,
      participantIds: participantIds.map(String),
    });

    res.status(201).json({ data: room });
  } catch (e) {
    console.error("[chatController.createGroup]", e);
    next(e);
  }
};

/**
 * POST /api/chat/rooms/:roomId/pin/:messageId
 */
module.exports.pinMessage = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const companyId = String(req.user.companyId);
    const { roomId, messageId } = req.params;

    const msg = await chatService.pinMessage({
      companyId,
      roomId,
      messageId,
      userId,
      user: req.user,
    });

    res.json({ data: msg });
  } catch (e) {
    console.error("[chatController.pinMessage]", e);
    next(e);
  }
};

/**
 * POST /api/chat/rooms/:roomId/unpin/:messageId
 */
module.exports.unpinMessage = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const companyId = String(req.user.companyId);
    const { roomId, messageId } = req.params;

    const msg = await chatService.unpinMessage({
      companyId,
      roomId,
      messageId,
      userId,
      user: req.user,
    });

    res.json({ data: msg });
  } catch (e) {
    console.error("[chatController.unpinMessage]", e);
    next(e);
  }
};

/**
 * PATCH /api/chat/rooms/:roomId/messages/:messageId
 */
module.exports.editMessage = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const companyId = String(req.user.companyId);
    const { roomId, messageId } = req.params;
    const { text } = req.body || {};

    const msg = await chatService.editMessage({
      companyId,
      roomId,
      messageId,
      userId,
      user: req.user,
      text,
    });

    res.json({ data: msg });
  } catch (e) {
    console.error("[chatController.editMessage]", e);
    next(e);
  }
};

/**
 * DELETE /api/chat/rooms/:roomId/messages/:messageId
 */
module.exports.deleteMessage = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const companyId = String(req.user.companyId);
    const { roomId, messageId } = req.params;

    const msg = await chatService.deleteMessage({
      companyId,
      roomId,
      messageId,
      userId,
      user: req.user,
    });

    res.json({ data: msg });
  } catch (e) {
    console.error("[chatController.deleteMessage]", e);
    next(e);
  }
};

/**
 * PATCH /api/chat/rooms/:roomId
 */
module.exports.updateRoom = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const companyId = String(req.user.companyId);
    const { roomId } = req.params;
    const { title, avatarUrl, isArchived } = req.body || {};

    const room = await chatService.updateRoom({
      companyId,
      roomId,
      userId,
      patch: { title, avatarUrl, isArchived },
    });

    res.json({ data: room });
  } catch (e) {
    console.error("[chatController.updateRoom]", e);
    next(e);
  }
};
