const ChatRoom = require("../../../mongoModels/chat/ChatRoom");
const ChatMessage = require("../../../mongoModels/chat/ChatMessage");
const mongoose = require("mongoose");
const { Op } = require("sequelize");
const ApplicationError = require("../../../errors/ApplicationError");
const { UserCompany, User } = require("../../../models");

const EDIT_WINDOW_MS = 15 * 60 * 1000;

const buildRoomKey = (companyId, roomId) =>
  `room:${String(companyId)}:${String(roomId)}`;
const buildUserKey = (companyId, userId) =>
  `user:${String(companyId)}:${String(userId)}`;

function toUniqueIds(ids = []) {
  return Array.from(new Set(ids.map((id) => String(id)).filter(Boolean)));
}

async function assertUsersInCompany(userIds, companyId) {
  const ids = toUniqueIds(userIds);
  if (!ids.length) return;

  const rows = await UserCompany.findAll({
    where: { companyId, userId: { [Op.in]: ids } },
    attributes: ["userId"],
    raw: true,
  });

  const allowed = new Set(rows.map((r) => String(r.userId)));
  const missing = ids.filter((id) => !allowed.has(String(id)));
  if (missing.length) {
    throw new ApplicationError("participantIds contain users outside company", 400);
  }
}

async function getRoomForUser({ companyId, roomId, userId }) {
  if (!companyId || !roomId || !userId) {
    throw new ApplicationError("Room access requires companyId and userId", 400);
  }

  if (!mongoose.isValidObjectId(roomId)) {
    throw new ApplicationError("Room not found", 404);
  }

  const room = await ChatRoom.findOne({
    _id: roomId,
    companyId,
    "participants.userId": String(userId),
    isDeleted: false,
  });

  if (!room) {
    throw new ApplicationError("Room not found or access denied", 404);
  }

  return room;
}

function getParticipant(room, userId) {
  return (room?.participants || []).find(
    (p) => String(p.userId) === String(userId)
  );
}

function assertGroupAdmin(room, userId) {
  if (room.type !== "group") {
    throw new ApplicationError("Group admin required", 400);
  }
  const p = getParticipant(room, userId);
  if (!p || p.role !== "admin") {
    throw new ApplicationError("Insufficient permissions", 403);
  }
  return p;
}

function assertCanPin(room, userId) {
  if (room.type === "direct") return;
  assertGroupAdmin(room, userId);
}

async function getMessageInRoom({ companyId, roomId, messageId }) {
  if (!mongoose.isValidObjectId(messageId)) {
    throw new ApplicationError("Message not found", 404);
  }

  const msg = await ChatMessage.findOne({
    _id: messageId,
    roomId,
    companyId,
  });

  if (!msg) {
    throw new ApplicationError("Message not found", 404);
  }
  return msg;
}

async function getUserDisplayName(userId) {
  if (!userId) return "Пользователь";
  const row = await User.findOne({
    where: { id: userId },
    attributes: ["firstName", "lastName", "email"],
    raw: true,
  });
  const full = [row?.firstName, row?.lastName].filter(Boolean).join(" ");
  return full || row?.email || "Пользователь";
}

function buildPinnedPreview(msg) {
  const raw = (msg?.text || "").trim();
  if (raw) {
    return raw.length > 40 ? `${raw.slice(0, 40)}…` : raw;
  }
  const name = msg?.attachments?.[0]?.name;
  return name || "сообщение";
}

function isSystemPrivileged(user) {
  const role = user?.role || null;
  return role === "admin" || role === "owner";
}

function canViewAudit({ user, room, participant }) {
  if (!room || !user) return false;
  if (room.type !== "group") return false;
  if (isSystemPrivileged(user)) return true;
  if (String(room.createdBy || "") === String(user.id || "")) return true;
  if (participant?.role === "admin") return true;
  return false;
}

async function loadMembershipRolesMap(companyId, userIds = []) {
  const ids = toUniqueIds(userIds);
  if (!ids.length) return new Map();

  const rows = await UserCompany.findAll({
    where: { companyId, userId: { [Op.in]: ids } },
    attributes: ["userId", "role"],
    raw: true,
  });

  const map = new Map();
  for (const row of rows) {
    map.set(String(row.userId), row.role || null);
  }
  return map;
}

async function resolveAuditUser({ user, userId, companyId }) {
  if (user && user.id) {
    return { id: String(user.id), role: user.role || null };
  }
  if (!userId || !companyId) return null;

  const row = await UserCompany.findOne({
    where: { companyId, userId },
    attributes: ["role"],
    raw: true,
  });
  return { id: String(userId), role: row?.role || null };
}

function sanitizeMessageAudit(message, canView) {
  if (canView) {
    return message?.toObject ? message.toObject() : { ...message };
  }

  const obj = message?.toObject ? message.toObject() : { ...message };
  if (obj?.meta && obj.meta.audit) {
    obj.meta = { ...obj.meta };
    delete obj.meta.audit;
    if (!Object.keys(obj.meta).length) {
      delete obj.meta;
    }
  }
  return obj;
}

async function findOrCreateDirectRoom({ companyId, userId, otherUserId }) {
  await assertUsersInCompany([userId, otherUserId], companyId);

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
  const unique = toUniqueIds([creatorId, ...(participantIds || [])]);
  await assertUsersInCompany(unique, companyId);

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
  if (pinnedMessage && pinnedMessage.isPinned && !pinnedMessage.deletedAt) {
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
    deletedAt: null,
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

async function pinMessage({ companyId, roomId, messageId, userId, user }) {
  const room = await getRoomForUser({ companyId, roomId, userId });
  if (room.type === "group" && room.isArchived) {
    throw new ApplicationError("Room is archived", 403);
  }
  assertCanPin(room, userId);
  const msg = await getMessageInRoom({ companyId, roomId, messageId });

  if (!msg.isPinned) {
    msg.isPinned = true;
    msg.pinnedAt = new Date();
    msg.pinnedBy = userId;
    await msg.save();

    await recomputeLastPinnedForRoom(room, { pinnedMessage: msg });

    try {
      const actorName = await getUserDisplayName(userId);
      const preview = buildPinnedPreview(msg);
      const systemText = `${actorName} закрепил(а) «${preview}»`;

      await sendMessage({
        companyId,
        roomId,
        authorId: userId,
        text: systemText,
        isSystem: true,
        systemType: "pin",
        systemPayload: { action: "pin", messageId: String(messageId) },
        allowSystem: true,
      });
    } catch (err) {
      console.error("[chatService.pinMessage] system pin message error", err);
    }
  }

  const io = global.io;

  if (io) {
    const participants = room.participants || [];
    const users = participants.map((p) => String(p.userId));
    const roleMap = await loadMembershipRolesMap(companyId, users);

    // личные комнаты пользователей — для списка чатов / бэджей
    for (const uid of users) {
      const participant = participants.find(
        (p) => String(p.userId) === String(uid)
      );
      const auditUser = { id: uid, role: roleMap.get(String(uid)) || null };
      const canAudit = canViewAudit({ user: auditUser, room, participant });
      const msgObj = sanitizeMessageAudit(msg, canAudit);

      io.to(buildUserKey(companyId, uid)).emit("chat:message:pinned", {
        roomId: String(roomId),
        message: msgObj,
      });
    }

    // сама комната — без audit, чтобы не утекало
    io.to(buildRoomKey(companyId, roomId)).emit("chat:message:pinned", {
      roomId: String(roomId),
      message: sanitizeMessageAudit(msg, false),
    });
  }

  const auditUser = await resolveAuditUser({ user, userId, companyId });
  const participant = auditUser ? getParticipant(room, auditUser.id) : null;
  const canAudit = canViewAudit({ user: auditUser, room, participant });
  return sanitizeMessageAudit(msg, canAudit);
}

async function unpinMessage({ companyId, roomId, messageId, userId, user }) {
  const room = await getRoomForUser({ companyId, roomId, userId });
  if (room.type === "group" && room.isArchived) {
    throw new ApplicationError("Room is archived", 403);
  }
  assertCanPin(room, userId);
  const msg = await getMessageInRoom({ companyId, roomId, messageId });

  if (msg.isPinned) {
    msg.isPinned = false;
    msg.pinnedAt = null;
    msg.pinnedBy = null;
    await msg.save();

    // удаляем ВСЕ системные сообщения об этом пине
    try {
      const systemPinMessages = await ChatMessage.find({
        companyId,
        roomId,
        isSystem: true,
        "meta.systemType": "pin",
        "meta.systemPayload.messageId": messageId,
      }).lean();

      const systemIds = systemPinMessages.map((m) => m._id);

      if (systemIds.length) {
        await ChatMessage.deleteMany({
          _id: { $in: systemIds },
          companyId,
          roomId,
        });

        // можно тут же разослать событие об удалении системных сообщений,
        // если на фронте захочешь их убирать лайвом:
        const io = global.io;
        if (io) {
          const participants = room.participants || [];
          const users = participants.map((p) => String(p.userId));

          for (const uid of users) {
            io.to(buildUserKey(companyId, uid)).emit("chat:system:deleted", {
              roomId: String(roomId),
              messageIds: systemIds.map(String),
            });
          }

          io.to(buildRoomKey(companyId, roomId)).emit("chat:system:deleted", {
            roomId: String(roomId),
            messageIds: systemIds.map(String),
          });
        }
      }
    } catch (err) {
      console.error("[chatService.unpinMessage] system pin delete error", err);
    }

    await recomputeLastPinnedForRoom(room, { pinnedMessage: msg });
  }

  const io = global.io;

  if (io) {
    const participants = room.participants || [];
    const users = participants.map((p) => String(p.userId));

    for (const uid of users) {
      io.to(buildUserKey(companyId, uid)).emit("chat:message:unpinned", {
        roomId: String(roomId),
        messageId: String(messageId),
      });
    }

    io.to(buildRoomKey(companyId, roomId)).emit("chat:message:unpinned", {
      roomId: String(roomId),
      messageId: String(messageId),
    });
  }

  const auditUser = await resolveAuditUser({ user, userId, companyId });
  const participant = auditUser ? getParticipant(room, auditUser.id) : null;
  const canAudit = canViewAudit({ user: auditUser, room, participant });
  return sanitizeMessageAudit(msg, canAudit);
}

/**
 * Отправка сообщения + обновление комнаты + broadcast по socket.io
 */
async function sendMessage({
  companyId,
  roomId,
  authorId,
  user,
  text,
  attachments = [],
  replyTo,
  isSystem,
  systemType,
  systemPayload,
  forwardFrom,
  forwardBatchId = null,
  forwardBatchSeq = null,
  allowSystem = false,
}) {
  const room = await getRoomForUser({
    companyId,
    roomId,
    userId: authorId,
  });

  if (room.type === "group" && room.isArchived && !allowSystem) {
    throw new ApplicationError("Room is archived", 403);
  }

  if (isSystem && !allowSystem) {
    throw new ApplicationError("System messages are not allowed", 403);
  }

  if (replyTo) {
    await getMessageInRoom({ companyId, roomId, messageId: replyTo });
  }

  let forward = null;

  // ======== ПЕРЕСЫЛКА ========
  if (forwardFrom && mongoose.isValidObjectId(forwardFrom)) {
    const orig = await ChatMessage.findOne({
      _id: forwardFrom,
      companyId,
    });

    if (!orig) {
      throw new ApplicationError("Forward source not found", 404);
    }

    await getRoomForUser({
      companyId,
      roomId: orig.roomId,
      userId: authorId,
    });

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

  console.log("isSystem:", isSystem);

  const meta = {};
  if (isSystem) {
    if (systemType) meta.systemType = systemType;
    if (systemPayload) meta.systemPayload = systemPayload;
  }

  const msg = await ChatMessage.create({
    companyId,
    roomId,
    authorId,
    text,
    attachments,
    isSystem: !!isSystem,
    replyToMessageId: replyTo || null,
    forward,
    forwardBatchId,
    forwardBatchSeq,
    meta,
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
      const participants = room.participants || [];
      const users = participants.map((p) => String(p.userId));
      const roleMap = await loadMembershipRolesMap(companyId, users);

      for (const uid of users) {
        const participant = participants.find(
          (p) => String(p.userId) === String(uid)
        );
        const auditUser = { id: uid, role: roleMap.get(String(uid)) || null };
        const canAudit = canViewAudit({ user: auditUser, room, participant });
        const msgObj = sanitizeMessageAudit(msg, canAudit);

        io.to(buildUserKey(companyId, uid)).emit("chat:message:new", {
          roomId,
          message: msgObj,
        });
      }

      io.to(buildRoomKey(companyId, roomId)).emit("chat:message:new", {
        roomId,
        message: sanitizeMessageAudit(msg, false),
      });
    }
  } catch (err) {
    console.error("[chatService.sendMessage] socket broadcast error", err);
  }

  const auditUser = await resolveAuditUser({ user, userId: authorId, companyId });
  const participant = auditUser ? getParticipant(room, auditUser.id) : null;
  const canAudit = canViewAudit({ user: auditUser, room, participant });
  return sanitizeMessageAudit(msg, canAudit);
}

async function getMessages({
  companyId,
  roomId,
  userId,
  user,
  limit = 50,
  before,
}) {
  const room = await getRoomForUser({ companyId, roomId, userId });

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

  const auditUser = await resolveAuditUser({ user, userId, companyId });
  const participant = auditUser ? getParticipant(room, auditUser.id) : null;
  const canAudit = canViewAudit({ user: auditUser, room, participant });
  const ordered = items.reverse();
  return ordered.map((m) => sanitizeMessageAudit(m, canAudit));
}

// список всех закреплённых сообщений комнаты (для логики «ближайший пин» на фронте)
async function getPinnedMessages({ companyId, roomId, userId, user }) {
  const room = await getRoomForUser({ companyId, roomId, userId });

  const items = await ChatMessage.find({
    companyId,
    roomId,
    isPinned: true,
    deletedAt: null,
  })
    .sort({ pinnedAt: -1, createdAt: -1, _id: -1 })
    .lean();

  const auditUser = await resolveAuditUser({ user, userId, companyId });
  const participant = auditUser ? getParticipant(room, auditUser.id) : null;
  const canAudit = canViewAudit({ user: auditUser, room, participant });
  return items.map((m) => sanitizeMessageAudit(m, canAudit));
}

async function markAsRead({ companyId, roomId, userId, messageId }) {
  const room = await getRoomForUser({ companyId, roomId, userId });

  const p = room.participants.find((x) => String(x.userId) === String(userId));
  if (!p) throw new ApplicationError("User not in this room", 403);

  p.lastReadAt = new Date();

  let storedMessageId = null;

  if (mongoose.isValidObjectId(messageId)) {
    await getMessageInRoom({ companyId, roomId, messageId });
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
        io.to(buildUserKey(companyId, uid)).emit("chat:message:read", {
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

async function editMessage({ companyId, roomId, messageId, userId, user, text }) {
  const nextText = text != null ? String(text).trim() : "";
  if (!nextText) {
    throw new ApplicationError("text is required", 400);
  }

  const room = await getRoomForUser({ companyId, roomId, userId });
  if (room.type === "group" && room.isArchived) {
    throw new ApplicationError("Room is archived", 403);
  }

  const msg = await getMessageInRoom({ companyId, roomId, messageId });
  if (msg.isSystem) {
    throw new ApplicationError("System messages cannot be edited", 403);
  }
  if (msg.deletedAt) {
    throw new ApplicationError("Message already deleted", 403);
  }

  if (String(msg.authorId) !== String(userId)) {
    throw new ApplicationError("Only author can edit message", 403);
  }

  const createdAt = new Date(msg.createdAt || Date.now()).getTime();
  const now = Date.now();
  if (now - createdAt > EDIT_WINDOW_MS) {
    throw new ApplicationError("Edit window expired", 403);
  }

  const nextMeta =
    msg.meta && typeof msg.meta === "object" ? { ...msg.meta } : {};
  const nextAudit =
    nextMeta.audit && typeof nextMeta.audit === "object"
      ? { ...nextMeta.audit }
      : {};

  nextAudit.prevText = msg.text || "";
  nextAudit.prevEditedAt = new Date();
  nextAudit.prevEditedBy = String(userId);
  nextMeta.audit = nextAudit;
  msg.meta = nextMeta;

  msg.text = nextText;
  msg.editedAt = new Date();
  msg.editedBy = String(userId);
  await msg.save();

  try {
    const io = global.io;
    if (io) {
      const participants = room.participants || [];
      const users = participants.map((p) => String(p.userId));
      const roleMap = await loadMembershipRolesMap(companyId, users);
      const audit = msg?.meta?.audit || null;

      for (const uid of users) {
        const participant = participants.find(
          (p) => String(p.userId) === String(uid)
        );
        const auditUser = { id: uid, role: roleMap.get(String(uid)) || null };
        const canAudit = canViewAudit({ user: auditUser, room, participant });

        const payload = {
          roomId: String(roomId),
          messageId: String(messageId),
          text: msg.text,
          editedAt: msg.editedAt,
          editedBy: msg.editedBy,
          ...(canAudit && audit ? { audit } : {}),
        };

        io.to(buildUserKey(companyId, uid)).emit("chat:message:edited", payload);
      }
      io.to(buildRoomKey(companyId, roomId)).emit("chat:message:edited", {
        roomId: String(roomId),
        messageId: String(messageId),
        text: msg.text,
        editedAt: msg.editedAt,
        editedBy: msg.editedBy,
      });
    }
  } catch (err) {
    console.error("[chatService.editMessage] socket emit error", err);
  }

  const auditUser = await resolveAuditUser({ user, userId, companyId });
  const participant = auditUser ? getParticipant(room, auditUser.id) : null;
  const canAudit = canViewAudit({ user: auditUser, room, participant });
  return sanitizeMessageAudit(msg, canAudit);
}

async function deleteMessage({ companyId, roomId, messageId, userId, user }) {
  const room = await getRoomForUser({ companyId, roomId, userId });
  if (room.type === "group" && room.isArchived) {
    throw new ApplicationError("Room is archived", 403);
  }

  const msg = await getMessageInRoom({ companyId, roomId, messageId });
  if (msg.isSystem) {
    throw new ApplicationError("System messages cannot be deleted", 403);
  }

  const wasPinned = !!msg.isPinned;

  if (msg.deletedAt) {
    if (wasPinned) {
      msg.isPinned = false;
      msg.pinnedAt = null;
      msg.pinnedBy = null;
      await msg.save();

      try {
        const systemPinMessages = await ChatMessage.find({
          companyId,
          roomId,
          isSystem: true,
          "meta.systemType": "pin",
          "meta.systemPayload.messageId": messageId,
        }).lean();

        const systemIds = systemPinMessages.map((m) => m._id);

        if (systemIds.length) {
          await ChatMessage.deleteMany({
            _id: { $in: systemIds },
            companyId,
            roomId,
          });

          const io = global.io;
          if (io) {
            const participants = room.participants || [];
            const users = participants.map((p) => String(p.userId));

            for (const uid of users) {
              io.to(buildUserKey(companyId, uid)).emit("chat:system:deleted", {
                roomId: String(roomId),
                messageIds: systemIds.map(String),
              });
            }

            io.to(buildRoomKey(companyId, roomId)).emit("chat:system:deleted", {
              roomId: String(roomId),
              messageIds: systemIds.map(String),
            });
          }
        }
      } catch (err) {
        console.error(
          "[chatService.deleteMessage] system pin delete error",
          err
        );
      }

      await recomputeLastPinnedForRoom(room, { pinnedMessage: msg });

      try {
        const io = global.io;
        if (io) {
          const participants = room.participants || [];
          const users = participants.map((p) => String(p.userId));

          for (const uid of users) {
            io.to(buildUserKey(companyId, uid)).emit("chat:message:unpinned", {
              roomId: String(roomId),
              messageId: String(messageId),
            });
          }
          io.to(buildRoomKey(companyId, roomId)).emit("chat:message:unpinned", {
            roomId: String(roomId),
            messageId: String(messageId),
          });
        }
      } catch (err) {
        console.error("[chatService.deleteMessage] socket emit error", err);
      }
    }

    const auditUser = await resolveAuditUser({ user, userId, companyId });
    const participant = auditUser ? getParticipant(room, auditUser.id) : null;
    const canAudit = canViewAudit({ user: auditUser, room, participant });
    return sanitizeMessageAudit(msg, canAudit);
  }

  const isAuthor = String(msg.authorId) === String(userId);

  if (!isAuthor) {
    throw new ApplicationError("Insufficient permissions", 403);
  }

  if (wasPinned) {
    msg.isPinned = false;
    msg.pinnedAt = null;
    msg.pinnedBy = null;
  }

  const nextMeta =
    msg.meta && typeof msg.meta === "object" ? { ...msg.meta } : {};
  const nextAudit =
    nextMeta.audit && typeof nextMeta.audit === "object"
      ? { ...nextMeta.audit }
      : {};

  nextAudit.textBeforeDelete = msg.text || "";
  nextAudit.snapshotDeletedAt = new Date();
  nextAudit.snapshotDeletedBy = String(userId);
  nextMeta.audit = nextAudit;
  msg.meta = nextMeta;

  msg.deletedAt = new Date();
  msg.deletedBy = String(userId);
  msg.text = "Сообщение удалено";
  msg.attachments = [];
  msg.forward = null;
  await msg.save();

  if (wasPinned) {
    try {
      const systemPinMessages = await ChatMessage.find({
        companyId,
        roomId,
        isSystem: true,
        "meta.systemType": "pin",
        "meta.systemPayload.messageId": messageId,
      }).lean();

      const systemIds = systemPinMessages.map((m) => m._id);

      if (systemIds.length) {
        await ChatMessage.deleteMany({
          _id: { $in: systemIds },
          companyId,
          roomId,
        });

        const io = global.io;
        if (io) {
          const participants = room.participants || [];
          const users = participants.map((p) => String(p.userId));

          for (const uid of users) {
            io.to(buildUserKey(companyId, uid)).emit("chat:system:deleted", {
              roomId: String(roomId),
              messageIds: systemIds.map(String),
            });
          }

          io.to(buildRoomKey(companyId, roomId)).emit("chat:system:deleted", {
            roomId: String(roomId),
            messageIds: systemIds.map(String),
          });
        }
      }
    } catch (err) {
      console.error("[chatService.deleteMessage] system pin delete error", err);
    }

    await recomputeLastPinnedForRoom(room, { pinnedMessage: msg });
  }

  try {
    const io = global.io;
    if (io) {
      const participants = room.participants || [];
      const users = participants.map((p) => String(p.userId));
      const roleMap = await loadMembershipRolesMap(companyId, users);
      const audit = msg?.meta?.audit || null;

      for (const uid of users) {
        const participant = participants.find(
          (p) => String(p.userId) === String(uid)
        );
        const auditUser = { id: uid, role: roleMap.get(String(uid)) || null };
        const canAudit = canViewAudit({ user: auditUser, room, participant });

        const payload = {
          roomId: String(roomId),
          messageId: String(messageId),
          text: msg.text,
          deletedAt: msg.deletedAt,
          deletedBy: msg.deletedBy,
          ...(canAudit && audit ? { audit } : {}),
        };

        io.to(buildUserKey(companyId, uid)).emit("chat:message:deleted", payload);
      }
      io.to(buildRoomKey(companyId, roomId)).emit("chat:message:deleted", {
        roomId: String(roomId),
        messageId: String(messageId),
        text: msg.text,
        deletedAt: msg.deletedAt,
        deletedBy: msg.deletedBy,
      });

      if (wasPinned) {
        for (const uid of users) {
          io.to(buildUserKey(companyId, uid)).emit("chat:message:unpinned", {
            roomId: String(roomId),
            messageId: String(messageId),
          });
        }
        io.to(buildRoomKey(companyId, roomId)).emit("chat:message:unpinned", {
          roomId: String(roomId),
          messageId: String(messageId),
        });
      }
    }
  } catch (err) {
    console.error("[chatService.deleteMessage] socket emit error", err);
  }

  const auditUser = await resolveAuditUser({ user, userId, companyId });
  const participant = auditUser ? getParticipant(room, auditUser.id) : null;
  const canAudit = canViewAudit({ user: auditUser, room, participant });
  return sanitizeMessageAudit(msg, canAudit);
}

async function updateRoom({ companyId, roomId, userId, patch = {} }) {
  const room = await getRoomForUser({ companyId, roomId, userId });
  assertGroupAdmin(room, userId);

  const next = {};
  if (patch.title !== undefined) next.title = patch.title || null;
  if (patch.avatarUrl !== undefined) next.avatarUrl = patch.avatarUrl || null;
  if (patch.isArchived !== undefined) next.isArchived = !!patch.isArchived;

  const keys = Object.keys(next);
  if (!keys.length) {
    throw new ApplicationError("No allowed fields to update", 400);
  }

  const wasArchived = !!room.isArchived;
  room.set(next);
  await room.save();

  const isArchivedNow = !!room.isArchived;
  if (wasArchived !== isArchivedNow) {
    const actorName = await getUserDisplayName(userId);
    const actionText = isArchivedNow
      ? `${actorName} архивировал(а) чат`
      : `${actorName} восстановил(а) чат`;

    try {
      await sendMessage({
        companyId,
        roomId,
        authorId: String(userId),
        text: actionText,
        isSystem: true,
        systemType: "archive",
        systemPayload: { action: isArchivedNow ? "archive" : "unarchive" },
        allowSystem: true,
      });
    } catch (err) {
      console.error("[chatService.updateRoom] system archive message error", err);
    }
  }

  try {
    const io = global.io;
    if (io) {
      const payload = {
        roomId: String(roomId),
        patch: next,
        updatedAt: room.updatedAt,
      };
      const participants = room.participants || [];
      const users = participants.map((p) => String(p.userId));

      for (const uid of users) {
        io.to(buildUserKey(companyId, uid)).emit("chat:room:updated", payload);
      }
      io.to(buildRoomKey(companyId, roomId)).emit("chat:room:updated", payload);
    }
  } catch (err) {
    console.error("[chatService.updateRoom] socket emit error", err);
  }

  return room;
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
  editMessage,
  deleteMessage,
  updateRoom,
  buildRoomKey,
  buildUserKey,
};
