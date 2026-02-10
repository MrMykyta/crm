// src/routes/chat/chatRouter.js
const express = require('express');
const router = express.Router();

const chatController = require('../../controllers/system/chat/Chat.controller');

// список комнат текущего пользователя
router.get("/rooms", chatController.listRooms);

// direct-чат (user <-> otherUserId)
router.post("/direct", chatController.getOrCreateDirect);

// группа
router.post("/group", chatController.createGroup);

// сообщения комнаты
router.get("/rooms/:roomId/messages", chatController.listMessages);

// реакции на сообщение
router.get("/messages/:messageId/reactions", chatController.listMessageReactions);
router.post("/messages/:messageId/reactions", chatController.toggleReaction);
router.delete(
  "/messages/:messageId/reactions/:emoji",
  chatController.removeReaction
);

// список закреплённых сообщений комнаты
router.get("/rooms/:roomId/pins", chatController.listPinnedMessages);

// отправка сообщения
router.post("/rooms/:roomId/messages", chatController.sendMessage);

// редактирование сообщения
router.patch("/rooms/:roomId/messages/:messageId", chatController.editMessage);

// удаление сообщения (soft delete)
router.delete(
  "/rooms/:roomId/messages/:messageId",
  chatController.deleteMessage
);

// отметить как прочитанное
router.post("/rooms/:roomId/read", chatController.markRead);

// закрепить сообщение
router.post(
  "/rooms/:roomId/pin/:messageId",
  chatController.pinMessage
);

// открепить сообщение
router.post(
  "/rooms/:roomId/unpin/:messageId",
  chatController.unpinMessage
);

// обновление комнаты (archive/unarchive, title, avatar)
router.patch("/rooms/:roomId", chatController.updateRoom);

module.exports = router;
