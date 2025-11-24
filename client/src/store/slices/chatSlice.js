// src/store/slices/chatSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  activeRoomId: null,
  rooms: [],          // список комнат
  messages: {},       // messages[roomId] = [] (можно будет ограничивать длину)
  composerDrafts: {}, // drafts[roomId] = { text, context }
  // context: { type: 'reply' | null, id, authorId, authorName, text }
  forwardDraft: null, // { messageId, fromRoomId, toRoomId, authorId, authorName, text }
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,

  reducers: {
    setRooms(state, action) {
      state.rooms = Array.isArray(action.payload) ? action.payload : [];
    },

    setActiveRoom(state, action) {
      state.activeRoomId = action.payload ? String(action.payload) : null;
    },

    // история сообщений для комнаты (после первоначальной загрузки)
    setMessages(state, action) {
      const { roomId, messages } = action.payload || {};
      if (!roomId) return;
      state.messages[String(roomId)] = Array.isArray(messages) ? messages : [];
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

    // обновляем превью и время последнего сообщения в списке комнат
    updateRoomFromMessage(state, action) {
      const { roomId, message } = action.payload || {};
      if (!roomId || !message) return;

      const idStr = String(roomId);
      const room = state.rooms.find((r) => String(r._id) === idStr);
      if (!room) return;

      room.lastMessagePreview = message.text || '';
      room.lastMessageAt = message.createdAt || new Date().toISOString();
    },

    // 🔵 обновляем lastRead для участника комнаты (при chat:message:read)
    updateRoomRead(state, action) {
      const { roomId, userId, messageId, lastReadAt } = action.payload || {};
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
    },

    // ================= ЧЕРНОВИКИ И КОНТЕКСТ ВВОДА =================

    // сохранить/обновить черновик для комнаты
    setComposerDraft(state, action) {
      const { roomId, text = '', context = null } = action.payload || {};
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
        text = '',
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
  },
});

export const {
  setRooms,
  setActiveRoom,
  setMessages,
  addMessage,
  updateRoomFromMessage,
  updateRoomRead,
  setComposerDraft,
  clearComposerDraft,
  setForwardDraft,
  resetChat,
} = chatSlice.actions;

export default chatSlice.reducer;