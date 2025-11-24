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
  forwardFrom, // 👈 НОВОЕ
}) {
  const room = await ChatRoom.findOne({ _id: roomId, companyId });
  if (!room) throw new Error("Room not found");

  let forwardFromMessageId = null;
  let meta = {};

  // если пересылаем сообщение
  if (forwardFrom && mongoose.isValidObjectId(forwardFrom)) {
    const orig = await ChatMessage.findOne({
      _id: forwardFrom,
      companyId,
    });

    if (orig) {
      forwardFromMessageId = orig._id;

      const rawSnippet = (orig.text || "").trim();
      const snippet =
        rawSnippet.length > 300 ? rawSnippet.slice(0, 300) + "…" : rawSnippet;

      meta.forward = {
        fromMessageId: String(orig._id),
        fromRoomId: String(orig.roomId),
        authorId: orig.authorId,
        textSnippet: snippet,
      };

      // если пользователь не написал свой текст — подставим текст оригинала
      if ((!text || !text.trim()) && orig.text) {
        text = orig.text;
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
    forwardFromMessageId,
    meta,
  });

  room.lastMessageAt = msg.createdAt;

  const previewText =
    (text && text.trim()) ||
    meta.forward?.textSnippet ||
    attachments[0]?.name ||
    "Attachment";

  room.lastMessagePreview = previewText;
  await room.save();

  // 👉 BROADCAST ДЛЯ ВСЕХ УЧАСТНИКОВ ЧАТА, ЧЕРЕЗ "ЛИЧНЫЕ" КОМНАТЫ user:{id}
  try {
    const io = global.io;
    if (io) {
      const msgObj = msg.toObject ? msg.toObject() : msg;

      const participants = room.participants || [];
      const users = participants.map((p) => String(p.userId));

      console.log(
        "[chatService.sendMessage] broadcast chat:message:new",
        "roomId=",
        roomId,
        "users=",
        users
      );

      for (const uid of users) {
        io.to(`user:${uid}`).emit("chat:message:new", {
          roomId,
          message: msgObj,
        });
      }
    } else {
      console.warn("[chatService.sendMessage] global.io is not set");
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
    .sort({ createdAt: -1 })
    .limit(limit);

  return items.reverse();
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

  // 🔔 BROADCAST "chat:message:read" ВСЕМ УЧАСТНИКАМ КОМНАТЫ
  try {
    const io = global.io;
    if (io) {
      const participants = room.participants || [];
      const users = participants.map((x) => String(x.userId));

      for (const uid of users) {
        io.to(`user:${uid}`).emit("chat:message:read", {
          roomId: String(roomId),
          userId: String(userId),
          messageId: storedMessageId, // может быть null, если temp-id
          lastReadAt: p.lastReadAt.toISOString(),
        });
      }
    } else {
      console.warn("[chatService.markAsRead] global.io is not set");
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
  markAsRead,
};
