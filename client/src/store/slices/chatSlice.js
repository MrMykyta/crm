// src/store/slices/chatSlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  activeRoomId: null,
  pinned: {}, // pinned[roomId] = {message}
  activePinnedIndexByRoomId: {}, // activePinnedIndexByRoomId[roomId] = number
  rooms: [], // список комнат
  messages: {}, // messages[roomId] = []
  composerDrafts: {}, // drafts[roomId] = { text, context }
  // context: { type: 'reply' | null, id, authorId, authorName, text }
  forwardDraft: null, // { messageId, fromRoomId, toRoomId, authorId, authorName, text }
};

const chatSlice = createSlice({
  name: "chat",
  initialState,

  reducers: {
    setRooms(state, action) {
      const rooms = Array.isArray(action.payload) ? action.payload : [];
      // если сервер уже прислал myUnreadCount — просто принимаем
      state.rooms = rooms.map((r) => ({
        ...r,
        myUnreadCount:
          typeof r.myUnreadCount === "number" ? r.myUnreadCount : 0,
      }));
    },

    setActiveRoom(state, action) {
      state.activeRoomId = action.payload ? String(action.payload) : null;
    },

    // история сообщений для комнаты (после первоначальной загрузки)
    setMessages(state, action) {
      const { roomId, messages } = action.payload || {};
      if (!roomId) return;
      state.messages[String(roomId)] = Array.isArray(messages)
        ? messages
        : [];
    },

    // добавить одно сообщение в комнату (live)
    addMessage(state, action) {
      const { roomId, message } = action.payload || {};
      if (!roomId || !message) return;

      const key = String(roomId);
      if (!state.messages[key]) state.messages[key] = [];

      const list = state.messages[key];

      // защита от дублей
      if (list.some((m) => String(m._id) === String(message._id))) return;

      list.push(message);
    },

    // добавить пачку сообщений в начало (подгрузка старых)
    prependMessages(state, action) {
      const { roomId, messages } = action.payload || {};
      if (!roomId || !Array.isArray(messages) || !messages.length) return;

      const key = String(roomId);
      const existing = state.messages[key] || [];

      const existingIds = new Set(
        existing.map((m) => (m && m._id ? String(m._id) : null)).filter(Boolean)
      );

      const toAdd = messages.filter(
        (m) => m && m._id && !existingIds.has(String(m._id))
      );

      if (!toAdd.length) return;

      state.messages[key] = [...toAdd, ...existing];
    },

    // обновляем превью, время последнего сообщения и myUnreadCount
    // payload: { roomId, message, currentUserId?, isActive? }
    updateRoomFromMessage(state, action) {
      const { roomId, message, currentUserId, isActive } =
        action.payload || {};
      if (!roomId || !message) return;

      const idStr = String(roomId);
      const room = state.rooms.find((r) => String(r._id) === idStr);
      if (!room) return;

      // превью
      const text = (message.text || "").trim();
      const preview =
        text ||
        (message.forward && message.forward.textSnippet) ||
        (message.attachments &&
          message.attachments[0] &&
          message.attachments[0].name) ||
        "Attachment";

      room.lastMessagePreview = preview;
      room.lastMessageAt = message.createdAt || new Date().toISOString();

      // считаем непрочитанные:
      // 1) есть currentUserId
      // 2) сообщение НЕ от меня
      // 3) комната НЕ активна
      if (
        currentUserId &&
        String(message.authorId) !== String(currentUserId) &&
        !isActive
      ) {
        room.myUnreadCount = (room.myUnreadCount || 0) + 1;
      }
    },

    // 🔵 обновляем lastRead для участника комнаты (при chat:message:read)
    // payload: { roomId, userId, messageId, lastReadAt, currentUserId? }
    updateRoomRead(state, action) {
      const { roomId, userId, messageId, lastReadAt, currentUserId } =
        action.payload || {};
      if (!roomId || !userId) return;

      const idStr = String(roomId);
      const room = state.rooms.find((r) => String(r._id) === idStr);
      if (!room || !Array.isArray(room.participants)) return;

      const p = room.participants.find(
        (x) => String(x.userId) === String(userId)
      );
      if (!p) return;

      if (messageId) {
        p.lastReadMessageId = messageId;
      }
      p.lastReadAt = lastReadAt || p.lastReadAt || new Date().toISOString();

      // если это Я прочитал — сбрасываем myUnreadCount
      if (currentUserId && String(userId) === String(currentUserId)) {
        room.myUnreadCount = 0;
      }
    },

    // удалить сообщения по id (для системных после unpin)
    // payload: { roomId, messageIds: [] }
    removeMessages(state, action) {
      const { roomId, messageIds } = action.payload || {};
      if (!roomId || !Array.isArray(messageIds) || !messageIds.length) return;

      const key = String(roomId);
      const idsSet = new Set(messageIds.map(String));

      if (Array.isArray(state.messages[key])) {
        state.messages[key] = state.messages[key].filter(
          (m) => !m._id || !idsSet.has(String(m._id))
        );
      }
    },

    // ================= ЧЕРНОВИКИ И КОНТЕКСТ ВВОДА =================

    // сохранить/обновить черновик для комнаты
    setComposerDraft(state, action) {
      const { roomId, text = "", context = null } = action.payload || {};
      if (!roomId) return;

      const key = String(roomId);

      // если вообще ничего нет — чистим
      if (!text && !context) {
        delete state.composerDrafts[key];
        return;
      }

      state.composerDrafts[key] = {
        text,
        context, // { type: 'reply' | null, id, authorId, authorName, text }
        updatedAt: new Date().toISOString(),
      };
    },

    // удалить черновик конкретной комнаты (после успешной отправки, например)
    clearComposerDraft(state, action) {
      const roomId = action.payload;
      if (!roomId) return;
      delete state.composerDrafts[String(roomId)];
    },

    // ================= ЧЕРНОВИК ПЕРЕСЫЛКИ МЕЖДУ ЧАТАМИ =============

    setForwardDraft(state, action) {
      // либо объект, либо null
      const payload = action.payload || null;
      if (!payload) {
        state.forwardDraft = null;
        return;
      }

      const {
        messageId,
        fromRoomId,
        toRoomId,
        authorId,
        authorName,
        text = "",
      } = payload;

      state.forwardDraft = {
        messageId,
        fromRoomId,
        toRoomId,
        authorId,
        authorName,
        text,
        createdAt: new Date().toISOString(),
      };
    },

    // на всякий — локальный ресет чата (если вдруг захочешь дергать)
    resetChat() {
      return initialState;
    },

    setPinned(state, action) {
      const { roomId, pinned } = action.payload || {};
      if (!roomId) return;
      state.pinned[String(roomId)] = pinned;
    },

    removePinned(state, action) {
      const { roomId } = action.payload || {};
      if (!roomId) return;
      delete state.pinned[String(roomId)];
    },

    setActivePinnedIndex(state, action) {
      const { roomId, index } = action.payload || {};
      if (!roomId || index == null) return;
      state.activePinnedIndexByRoomId[String(roomId)] = Math.max(0, index);
    },

    // обновление сообщения (edit/delete)
    updateMessage(state, action) {
      const { roomId, messageId, patch } = action.payload || {};
      if (!roomId || !messageId || !patch) return;

      const key = String(roomId);
      const list = state.messages[key];
      if (!Array.isArray(list)) return;

      const idx = list.findIndex(
        (m) => m && String(m._id) === String(messageId)
      );
      if (idx < 0) return;

      list[idx] = { ...list[idx], ...patch };
    },

    // обновление полей комнаты
    updateRoom(state, action) {
      const { roomId, patch } = action.payload || {};
      if (!roomId || !patch) return;

      const room = state.rooms.find((r) => String(r._id) === String(roomId));
      if (!room) return;

      Object.assign(room, patch);
    },
  },
});

export const {
  setRooms,
  setActiveRoom,
  setMessages,
  addMessage,
  prependMessages,
  updateRoomFromMessage,
  updateRoomRead,
  removeMessages,
  setComposerDraft,
  clearComposerDraft,
  setForwardDraft,
  resetChat,
  setPinned,
  removePinned,
  setActivePinnedIndex,
  updateMessage,
  updateRoom,
} = chatSlice.actions;

export default chatSlice.reducer;
