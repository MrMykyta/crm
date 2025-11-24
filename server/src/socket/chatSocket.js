// src/socket/chatSocket.js
const ChatRoom = require("../mongoModels/chat/ChatRoom");
const chatService = require("../services/system/chat/chatService");

module.exports = function chatSocket(io, socket) {
  const userId = socket.user?.id;
  const companyId = socket.user?.companyId;

  if (!userId || !companyId) {
    console.warn("[chatSocket] no user or company on socket");
    socket.disconnect(true);
    return;
  }

  // Подписываем юзера на его личную комнату
  socket.join(`user:${userId}`);

  // -------------------------
  // JOIN ROOM
  // -------------------------
  socket.on("chat:join", async (payload, cb) => {
    try {
      const { roomId } = payload || {};
      if (!roomId) throw new Error("roomId is required");

      const room = await ChatRoom.findOne({
        _id: roomId,
        companyId,
        "participants.userId": String(userId),
        isDeleted: false,
      });

      if (!room) throw new Error("Room not found or access denied");

      socket.join(`room:${roomId}`);

      cb && cb({ ok: true });
    } catch (e) {
      console.error("[chat:join]", e);
      cb && cb({ ok: false, error: e.message });
    }
  });

  // -------------------------
  // LEAVE ROOM
  // -------------------------
  socket.on("chat:leave", async (payload, cb) => {
    try {
      const { roomId } = payload || {};
      if (!roomId) throw new Error("roomId is required");

      socket.leave(`room:${roomId}`);

      cb && cb({ ok: true });
    } catch (e) {
      console.error("[chat:leave]", e);
      cb && cb({ ok: false, error: e.message });
    }
  });

  // -------------------------
  // SEND MESSAGE
  // -------------------------
  socket.on("chat:send", async (payload, cb) => {
    try {
      const {
        roomId,
        text,
        attachments,
        replyTo,
        forwardFrom, // 👈 НОВОЕ
      } = payload || {};

      if (!roomId) throw new Error("roomId is required");
      if (!text && (!attachments || !attachments.length) && !forwardFrom) {
        // 👆 теперь можно отправить сообщение БЕЗ текста, если есть forwardFrom
        throw new Error("text, attachments or forwardFrom required");
      }

      const msg = await chatService.sendMessage({
        companyId,
        roomId,
        authorId: String(userId),
        text: text || "",
        attachments: attachments || [],
        replyTo,
        forwardFrom, // 👈 пробрасываем дальше
      });

      const msgObj = msg.toObject ? msg.toObject() : msg;

      cb && cb({ ok: true, data: msgObj });
    } catch (e) {
      console.error("[chat:send]", e);
      cb && cb({ ok: false, error: e.message });
    }
  });

  // -------------------------
  // TYPING
  // -------------------------
  socket.on("chat:typing", (payload) => {
    try {
      const { roomId, isTyping, userName } = payload || {};
      if (!roomId) return;

      socket.to(`room:${roomId}`).emit("chat:typing", {
        roomId,
        userId,
        isTyping: !!isTyping,
        // если фронт передал имя — прокидываем его дальше
        userName: userName || null,
      });
    } catch (e) {
      console.error("[chat:typing]", e);
    }
  });

  // -------------------------
  // READ MESSAGE
  // -------------------------
  socket.on("chat:read", async (payload, cb) => {
    try {
      const { roomId, messageId } = payload || {};
      if (!roomId || !messageId)
        throw new Error("roomId and messageId required");

      await chatService.markAsRead({
        companyId,
        roomId,
        userId: String(userId),
        messageId,
      });

      socket.to(`room:${roomId}`).emit("chat:read", {
        roomId,
        userId,
        messageId,
      });

      cb && cb({ ok: true });
    } catch (e) {
      console.error("[chat:read]", e);
      cb && cb({ ok: false, error: e.message });
    }
  });
};
