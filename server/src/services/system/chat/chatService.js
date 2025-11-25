// src/services/system/chat/chatService.js
const ChatRoom = require("../../../mongoModels/chat/ChatRoom");
const ChatMessage = require("../../../mongoModels/chat/ChatMessage");
const mongoose = require("mongoose");

async function findOrCreateDirectRoom({ companyId, userId, otherUserId }) {
  const existing = await ChatRoom.findOne({
    companyId,
    type: "direct",
    "participants.userId": { $all: [userId, otherUserId] },
  });

  if (existing) return existing;

  return ChatRoom.create({
    companyId,
    type: "direct",
    participants: [
      { userId, role: "member" },
      { userId: otherUserId, role: "member" },
    ],
    createdBy: userId,
  });
}

async function createGroupRoom({
  companyId,
  creatorId,
  title,
  participantIds,
}) {
  const unique = Array.from(new Set([creatorId, ...participantIds]));

  const participants = unique.map((id) => ({
    userId: id,
    role: id === creatorId ? "admin" : "member",
  }));

  return ChatRoom.create({
    companyId,
    type: "group",
    title,
    participants,
    createdBy: creatorId,
  });
}

// ======================
// ФУНКЦИЯ: getDeepOriginal
// ======================
async function getDeepOriginal(msg) {
  let current = msg;
  let hops = 0;

  while (
    current.forward &&
    current.forward.originalMessageId &&
    hops < 10
  ) {
    const next = await ChatMessage.findOne({
      _id: current.forward.originalMessageId,
      companyId: msg.companyId,
    });

    if (!next) break;

    current = next;
    hops += 1;
  }

  return current;
}

/**
 * Обновляет lastPinned* в комнате на основании самого «свежего» пина.
 * Если pinnedMessage (последний изменённый) передан, сначала пробуем его.
 */
async function recomputeLastPinnedForRoom(room, { pinnedMessage } = {}) {
  // если есть закреплённое сообщение — ставим его
  if (pinnedMessage && pinnedMessage.isPinned) {
    room.lastPinnedMessageId = pinnedMessage._id;
    room.lastPinnedAt = pinnedMessage.pinnedAt;
    await room.save();
    return;
  }

  // иначе ищем самый свежий пин в комнате
  const latest = await ChatMessage.findOne({
    roomId: room._id,
    companyId: room.companyId,
    isPinned: true,
  })
    .sort({ pinnedAt: -1, createdAt: -1 })
    .lean();

  if (latest) {
    room.lastPinnedMessageId = latest._id;
    room.lastPinnedAt = latest.pinnedAt;
  } else {
    room.lastPinnedMessageId = null;
    room.lastPinnedAt = null;
  }

  await room.save();
}

async function pinMessage({ companyId, roomId, messageId, userId }) {
  const room = await ChatRoom.findOne({ _id: roomId, companyId });
  if (!room) throw new Error("Room not found");

  const msg = await ChatMessage.findOne({ _id: messageId, roomId, companyId });
  if (!msg) throw new Error("Message not found");

  if (!msg.isPinned) {
    msg.isPinned = true;
    msg.pinnedAt = new Date();
    msg.pinnedBy = userId;
    await msg.save();

    await recomputeLastPinnedForRoom(room, { pinnedMessage: msg });
  }

  const io = global.io;
  const msgObj = msg.toObject ? msg.toObject() : msg;

  if (io) {
    const participants = room.participants || [];
    const users = participants.map((p) => String(p.userId));

    // личные комнаты пользователей — для списка чатов / бэджей
    for (const uid of users) {
      io.to(`user:${uid}`).emit("chat:message:pinned", {
        roomId: String(roomId),
        message: msgObj,
      });
    }

    // сама комната — чтобы «шапка» и сообщение обновились у всех
    io.to(`room:${roomId}`).emit("chat:message:pinned", {
      roomId: String(roomId),
      message: msgObj,
    });
  }

  return msg;
}

async function unpinMessage({ companyId, roomId, messageId, userId }) {
  const room = await ChatRoom.findOne({ _id: roomId, companyId });
  if (!room) throw new Error("Room not found");

  const msg = await ChatMessage.findOne({ _id: messageId, roomId, companyId });
  if (!msg) throw new Error("Message not found");

  if (msg.isPinned) {
    msg.isPinned = false;
    msg.pinnedAt = null;
    msg.pinnedBy = null;
    await msg.save();

    await recomputeLastPinnedForRoom(room, { pinnedMessage: msg });
  }

  const io = global.io;

  if (io) {
    const participants = room.participants || [];
    const users = participants.map((p) => String(p.userId));

    for (const uid of users) {
      io.to(`user:${uid}`).emit("chat:message:unpinned", {
        roomId: String(roomId),
        messageId: String(messageId),
      });
    }

    io.to(`room:${roomId}`).emit("chat:message:unpinned", {
      roomId: String(roomId),
      messageId: String(messageId),
    });
  }

  return msg;
}

/**
 * Отправка сообщения + обновление комнаты + broadcast по socket.io
 */
async function sendMessage({
  companyId,
  roomId,
  authorId,
  text,
  attachments = [],
  replyTo,
  forwardFrom,
  forwardBatchId = null,
  forwardBatchSeq = null,
}) {
  const room = await ChatRoom.findOne({ _id: roomId, companyId });
  if (!room) {
    throw new Error("Room not found");
  }

  let forward = null;

  // ======== ПЕРЕСЫЛКА ========
  if (forwardFrom && mongoose.isValidObjectId(forwardFrom)) {
    const orig = await ChatMessage.findOne({
      _id: forwardFrom,
      companyId,
    });

    if (orig) {
      const deep = await getDeepOriginal(orig);

      const rawSnippet = (deep.text || "").trim();
      const snippet =
        rawSnippet.length > 300 ? rawSnippet.slice(0, 300) + "…" : rawSnippet;

      forward = {
        sourceMessageId: orig._id,
        originalMessageId: deep._id,
        originalAuthorId: deep.authorId,
        originalAuthorName: deep?.forward?.originalAuthorName || null,
        textSnippet: snippet,
      };

      if ((!text || !text.trim()) && deep.text) {
        text = deep.text;
      }
    }
  }

  const msg = await ChatMessage.create({
    companyId,
    roomId,
    authorId,
    text,
    attachments,
    replyToMessageId: replyTo || null,
    forward,
    forwardBatchId,
    forwardBatchSeq,
    meta: {},
  });

  room.lastMessageAt = msg.createdAt;

  const previewText =
    (text && text.trim()) ||
    (forward && forward.textSnippet) ||
    attachments[0]?.name ||
    "Attachment";

  room.lastMessagePreview = previewText;
  await room.save();

  try {
    const io = global.io;
    if (io) {
      const msgObj = msg.toObject ? msg.toObject() : msg;

      const participants = room.participants || [];
      const users = participants.map((p) => String(p.userId));

      for (const uid of users) {
        io.to(`user:${uid}`).emit("chat:message:new", {
          roomId,
          message: msgObj,
        });
      }

      io.to(`room:${roomId}`).emit("chat:message:new", {
        roomId,
        message: msgObj,
      });
    }
  } catch (err) {
    console.error("[chatService.sendMessage] socket broadcast error", err);
  }

  return msg;
}

async function getMessages({ companyId, roomId, limit = 50, before }) {
  const query = { companyId, roomId };
  if (before) query.createdAt = { $lt: new Date(before) };

  const items = await ChatMessage.find(query)
    .sort({
      createdAt: -1,
      forwardBatchId: 1,
      forwardBatchSeq: 1,
      _id: -1,
    })
    .limit(limit);

  return items.reverse();
}

// список всех закреплённых сообщений комнаты (для логики «ближайший пин» на фронте)
async function getPinnedMessages({ companyId, roomId }) {
  const items = await ChatMessage.find({
    companyId,
    roomId,
    isPinned: true,
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  return items;
}

async function markAsRead({ companyId, roomId, userId, messageId }) {
  const room = await ChatRoom.findOne({ _id: roomId, companyId });
  if (!room) throw new Error("Room not found");

  const p = room.participants.find((x) => String(x.userId) === String(userId));
  if (!p) throw new Error("User not in this room");

  p.lastReadAt = new Date();

  let storedMessageId = null;

  if (mongoose.isValidObjectId(messageId)) {
    p.lastReadMessageId = messageId;
    storedMessageId = messageId;
  }

  await room.save();

  try {
    const io = global.io;
    if (io) {
      const participants = room.participants || [];
      const users = participants.map((x) => String(x.userId));

      for (const uid of users) {
        io.to(`user:${uid}`).emit("chat:message:read", {
          roomId: String(roomId),
          userId: String(userId),
          messageId: storedMessageId,
          lastReadAt: p.lastReadAt.toISOString(),
        });
      }
    }
  } catch (err) {
    console.error("[chatService.markAsRead] socket broadcast error", err);
  }
}

module.exports = {
  findOrCreateDirectRoom,
  createGroupRoom,
  sendMessage,
  getMessages,
  getPinnedMessages,
  markAsRead,
  pinMessage,
  unpinMessage,
};