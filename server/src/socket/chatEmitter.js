'use strict';

// Возвращает активный экземпляр Socket.IO из глобального контекста.
function getIo() {
  return global.io || null;
}

// Формирует имя room-канала компании и чата.
function buildRoomKey(companyId, roomId) {
  return `room:${String(companyId)}:${String(roomId)}`;
}

// Формирует имя персонального room-канала пользователя.
function buildUserKey(companyId, userId) {
  return `user:${String(companyId)}:${String(userId)}`;
}

// Публикует событие всем участникам указанной комнаты.
function emitToRoom(companyId, roomId, event, payload) {
  const io = getIo();
  if (!io || !companyId || !roomId) {
    return;
  }
  io.to(buildRoomKey(companyId, roomId)).emit(event, payload);
}

// Публикует событие в комнату, исключая текущий socket-источник.
function emitToRoomExcept(socket, companyId, roomId, event, payload) {
  if (!socket || !companyId || !roomId) {
    return;
  }
  socket.to(buildRoomKey(companyId, roomId)).emit(event, payload);
}

// Публикует событие набору пользователей в рамках компании.
function emitToUsers(companyId, userIds = [], event, payload) {
  const io = getIo();
  if (!io || !companyId) {
    return;
  }

  userIds
    .map((id) => String(id))
    .filter(Boolean)
    .forEach((userId) => {
      io.to(buildUserKey(companyId, userId)).emit(event, payload);
    });
}

// Публикует событие и в комнату, и в персональные каналы пользователей.
function emitToRoomAndUsers({ companyId, roomId, userIds = [], event, payload }) {
  emitToUsers(companyId, userIds, event, payload);
  emitToRoom(companyId, roomId, event, payload);
}

module.exports = {
  buildRoomKey,
  buildUserKey,
  emitToRoom,
  emitToRoomExcept,
  emitToUsers,
  emitToRoomAndUsers,
};
