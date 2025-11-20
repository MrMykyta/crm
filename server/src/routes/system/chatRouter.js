// src/routes/chat/chatRouter.js
const express = require('express');
const router = express.Router();

const chatController = require('../../controllers/system/chat/Chat.controller');

// список комнат текущего пользователя
router.get('/rooms', chatController.listRooms);

// direct-чат (user <-> otherUserId)
router.post('/direct', chatController.getOrCreateDirect);

router.post('/group', chatController.createGroup);

// сообщения комнаты
router.get('/rooms/:roomId/messages', chatController.listMessages);

// отправка сообщения
router.post('/rooms/:roomId/messages', chatController.sendMessage);

// отметить как прочитанное
router.post('/rooms/:roomId/read', chatController.markRead);

module.exports = router;