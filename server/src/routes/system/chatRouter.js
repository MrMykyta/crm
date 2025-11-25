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

// список закреплённых сообщений комнаты
router.get("/rooms/:roomId/pins", chatController.listPinnedMessages);

// отправка сообщения
router.post("/rooms/:roomId/messages", chatController.sendMessage);

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

module.exports = router;