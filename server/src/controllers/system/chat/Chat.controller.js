// src/controllers/chat/chatController.js
const chatService = require("../../../services/system/chat/chatService");
const ChatRoom = require("../../../mongoModels/chat/ChatRoom");

/**
 * GET /api/chat/rooms
 */
module.exports.listRooms = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const companyId = String(req.companyId);

    const rooms = await ChatRoom.find({
      companyId,
      "participants.userId": userId,
      isDeleted: false,
    }).sort({ lastMessageAt: -1, updatedAt: -1 });

    res.json({ data: rooms });
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
    const companyId = String(req.companyId);
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
    const companyId = String(req.companyId);
    const { roomId } = req.params;
    const { before, limit } = req.query;

    const messages = await chatService.getMessages({
      companyId,
      roomId,
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
 * POST /api/chat/rooms/:roomId/messages
 */
module.exports.sendMessage = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const companyId = String(req.companyId);
    const { roomId } = req.params;

    const {
      text,
      attachments,
      replyTo,
      forwardFrom, // 👈 НОВОЕ
    } = req.body;

    const msg = await chatService.sendMessage({
      companyId,
      roomId,
      authorId: userId,
      text: text || "",
      attachments: attachments || [],
      replyTo,
      forwardFrom, // 👈 пробрасываем
    });

    res.status(201).json({ data: msg });
  } catch (e) {
    console.error("[chatController.sendMessage]", e);
    next(e);
  }
};

/**
 * POST /api/chat/rooms/:roomId/read
 */
module.exports.markRead = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const companyId = String(req.companyId);
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
    const companyId = String(req.companyId);
    const { title, participantIds } = req.body || {};

    if (!title) {
      return res.status(400).json({ error: "title is required" });
    }
    if (!Array.isArray(participantIds) || !participantIds.length) {
      return res.status(400).json({ error: "participantIds is required" });
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
