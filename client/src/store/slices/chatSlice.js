// src/store/slices/chatSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  activeRoomId: null,
  rooms: [],      // список комнат
  messages: {},   // messages[roomId] = []
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
  updateRoomRead,      // 👈 экспортируем новый редьюсер
  resetChat,
} = chatSlice.actions;

export default chatSlice.reducer;