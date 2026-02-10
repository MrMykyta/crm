// src/store/slices/chatSlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  activeRoomId: null,
  pinned: {}, // pinned[roomId] = {message}
  activePinnedIndexByRoomId: {}, // activePinnedIndexByRoomId[roomId] = number
  rooms: [], // список комнат
  messages: {}, // messages[roomId] = []
  reactions: {}, // reactions[messageId][emoji] = { count, reacted }
  composerDrafts: {}, // drafts[roomId] = { text, context }
  composerMode: "new", // 'new' | 'edit'
  editTarget: null, // { roomId, messageId, originalText, authorName, createdAt }
  activeAudioFileId: null,
  infoPanelOpenByRoomId: {},
  infoPanelActiveTabByRoomId: {},
  // context: { type: 'reply' | null, id, authorId, authorName, text }
  forwardDraft: null, // { messageId, fromRoomId, toRoomId, authorId, authorName, text }
};

// Normalize server reaction payload into map form for the store.
function normalizeReactionsMap(raw) {
  if (!raw || typeof raw !== "object") return {};
  const next = {};
  Object.entries(raw).forEach(([emoji, value]) => {
    if (!emoji) return;
    if (typeof value === "number") {
      if (value > 0) next[emoji] = { count: value, reacted: false };
      return;
    }
    if (value && typeof value === "object") {
      const count = Number(value.count || 0);
      if (!count) return;
      next[emoji] = { count, reacted: Boolean(value.reacted) };
    }
  });
  return next;
}

// Hydrate reaction state from a single message payload.
function applyMessageReactions(state, message) {
  if (!message || !message._id) return;
  const key = String(message._id);
  const raw = message.reactions || message?.meta?.reactions || null;
  if (!raw || typeof raw !== "object") return;
  state.reactions[key] = normalizeReactionsMap(raw);
}

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
      state.activeAudioFileId = null;
    },

    // история сообщений для комнаты (после первоначальной загрузки)
    setMessages(state, action) {
      const { roomId, messages } = action.payload || {};
      if (!roomId) return;
      const list = Array.isArray(messages) ? messages : [];
      state.messages[String(roomId)] = list;
      list.forEach((m) => applyMessageReactions(state, m));
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
      applyMessageReactions(state, message);
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
      toAdd.forEach((m) => applyMessageReactions(state, m));
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
      const metaAttachments = message?.meta?.attachments;
      const preview =
        text ||
        (message.forward && message.forward.textSnippet) ||
        (metaAttachments &&
          metaAttachments[0] &&
          (metaAttachments[0].filename || metaAttachments[0].name)) ||
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

      idsSet.forEach((id) => {
        delete state.reactions[id];
      });
    },

    setActiveAudio(state, action) {
      state.activeAudioFileId = action.payload || null;
    },

    clearActiveAudio(state) {
      state.activeAudioFileId = null;
    },

    openInfoPanel(state, action) {
      const { roomId, tab } = action.payload || {};
      if (!roomId) return;
      const key = String(roomId);
      state.infoPanelOpenByRoomId[key] = true;
      if (tab) state.infoPanelActiveTabByRoomId[key] = tab;
    },

    closeInfoPanel(state, action) {
      const roomId = action.payload;
      if (!roomId) return;
      const key = String(roomId);
      delete state.infoPanelOpenByRoomId[key];
      delete state.infoPanelActiveTabByRoomId[key];
    },

    setInfoPanelTab(state, action) {
      const { roomId, tab } = action.payload || {};
      if (!roomId || !tab) return;
      state.infoPanelActiveTabByRoomId[String(roomId)] = tab;
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

    setEditTarget(state, action) {
      const payload = action.payload || null;
      if (!payload || !payload.messageId || !payload.roomId) return;
      state.editTarget = payload;
      state.composerMode = "edit";
    },

    clearEditTarget(state) {
      state.editTarget = null;
      state.composerMode = "new";
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

      const prev = list[idx] || {};
      const next = { ...prev, ...patch };
      if (patch.meta && typeof patch.meta === "object") {
        next.meta = { ...(prev.meta || {}), ...patch.meta };
      }
      list[idx] = next;

      if (patch.reactions && typeof patch.reactions === "object") {
        state.reactions[String(messageId)] = normalizeReactionsMap(
          patch.reactions
        );
      }
    },

    // Apply reaction delta for a single message/emoji.
    updateReaction(state, action) {
      const { messageId, emoji, count, reacted } = action.payload || {};
      if (!messageId || !emoji) return;
      const key = String(messageId);
      if (!state.reactions[key]) state.reactions[key] = {};

      const prev = state.reactions[key][emoji] || {
        count: 0,
        reacted: false,
      };

      const nextCount =
        typeof count === "number" ? Math.max(0, count) : prev.count;
      const nextReacted =
        typeof reacted === "boolean" ? reacted : prev.reacted;

      if (!nextCount) {
        delete state.reactions[key][emoji];
      } else {
        state.reactions[key][emoji] = {
          count: nextCount,
          reacted: nextReacted,
        };
      }

      if (!Object.keys(state.reactions[key]).length) {
        delete state.reactions[key];
      }
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
  updateReaction,
  updateRoom,
  setEditTarget,
  clearEditTarget,
  setActiveAudio,
  clearActiveAudio,
  openInfoPanel,
  closeInfoPanel,
  setInfoPanelTab,
} = chatSlice.actions;

export default chatSlice.reducer;
