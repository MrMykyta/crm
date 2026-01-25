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

  const buildRoomKey = chatService.buildRoomKey;
  const buildUserKey = chatService.buildUserKey;

  const getRoomForUser = async (roomId) => {
    const room = await ChatRoom.findOne({
      _id: roomId,
      companyId,
      "participants.userId": String(userId),
      isDeleted: false,
    });
    if (!room) throw new Error("Room not found or access denied");
    return room;
  };

  // Подписываем юзера на его личную комнату (company scoped)
  socket.join(buildUserKey(companyId, userId));

  // -------------------------
  // JOIN ROOM
  // -------------------------
  socket.on("chat:join", async (payload, cb) => {
    try {
      const { roomId } = payload || {};
      if (!roomId) throw new Error("roomId is required");

      await getRoomForUser(roomId);
      socket.join(buildRoomKey(companyId, roomId));

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

      socket.leave(buildRoomKey(companyId, roomId));

      cb && cb({ ok: true });
    } catch (e) {
      console.error("[chat:leave]", e);
      cb && cb({ ok: false, error: e.message });
    }
  });

  // -------------------------
  // SEND MESSAGE (в т.ч. системное)
  // -------------------------
  socket.on("chat:send", async (payload, cb) => {
    try {
      const {
        roomId,
        text,
        attachments,
        replyTo,
        forwardFrom,
        // системные поля
        isSystem,
        systemType,
        systemPayload,
        forwardBatchId,
        forwardBatchSeq,
      } = payload || {};

      if (!roomId) throw new Error("roomId is required");
      if (isSystem || systemType || systemPayload) {
        cb && cb({ ok: true });
        return;
      }
      if (!text && (!attachments || !attachments.length) && !forwardFrom) {
        throw new Error("text, attachments or forwardFrom required");
      }

      const msg = await chatService.sendMessage({
        companyId,
        roomId,
        authorId: String(userId),
        text: text || "",
        attachments: attachments || [],
        replyTo,
        isSystem,
        systemType,
        systemPayload,
        forwardFrom,
        forwardBatchId,
        forwardBatchSeq,
      });

      const msgObj = msg.toObject ? msg.toObject() : msg;

      cb && cb({ ok: true, data: msgObj });
    } catch (e) {
      console.error("[chat:send]", e);
      cb && cb({ ok: false, error: e.message });
    }
  });

  // -------------------------
  // PIN MESSAGE
  // -------------------------
  socket.on("chat:pin", async (payload, cb) => {
    try {
      const { roomId, messageId } = payload || {};
      if (!roomId || !messageId) {
        throw new Error("roomId and messageId are required");
      }

      const msg = await chatService.pinMessage({
        companyId,
        roomId,
        messageId,
        userId: String(userId),
      });

      const msgObj = msg.toObject ? msg.toObject() : msg;
      cb && cb({ ok: true, data: msgObj });
    } catch (e) {
      console.error("[chat:pin]", e);
      cb && cb({ ok: false, error: e.message });
    }
  });

  // -------------------------
  // UNPIN MESSAGE
  // -------------------------
  socket.on("chat:unpin", async (payload, cb) => {
    try {
      const { roomId, messageId } = payload || {};
      if (!roomId || !messageId) {
        throw new Error("roomId and messageId are required");
      }

      const msg = await chatService.unpinMessage({
        companyId,
        roomId,
        messageId,
        userId: String(userId),
      });

      const msgObj = msg.toObject ? msg.toObject() : msg;
      cb && cb({ ok: true, data: msgObj });
    } catch (e) {
      console.error("[chat:unpin]", e);
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
      getRoomForUser(roomId)
        .then(() => {
          socket.to(buildRoomKey(companyId, roomId)).emit("chat:typing", {
            roomId,
            userId,
            isTyping: !!isTyping,
            userName: userName || null,
          });
        })
        .catch((e) => {
          console.error("[chat:typing]", e);
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

      socket.to(buildRoomKey(companyId, roomId)).emit("chat:read", {
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
