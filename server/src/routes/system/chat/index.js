'use strict';

const express = require('express');
const { auth } = require('../../../middleware/auth');
const validate = require('../../../middleware/validate');
const requirePermission = require('../../../middleware/requirePermission');
const chatController = require('../../../controllers/system/chat/Chat.controller');
const chatSchema = require('../../../system/chat/schemas/chat.schema');

const router = express.Router();

router.use(auth);

router.get('/rooms', requirePermission('chat.read'), chatController.listRooms);
router.post('/direct', chatController.getOrCreateDirect);
router.post('/group', chatController.createGroup);
router.get('/rooms/:roomId/messages', requirePermission('chat.read'), chatController.listMessages);
router.get('/messages/:messageId/reactions', chatController.listMessageReactions);
router.post('/messages/:messageId/reactions', chatController.toggleReaction);
router.delete('/messages/:messageId/reactions/:emoji', chatController.removeReaction);
router.get('/rooms/:roomId/pins', chatController.listPinnedMessages);
router.post('/rooms/:roomId/messages', requirePermission('chat.write'), validate(chatSchema.sendMessage), chatController.sendMessage);
router.patch('/rooms/:roomId/messages/:messageId', chatController.editMessage);
router.delete('/rooms/:roomId/messages/:messageId', chatController.deleteMessage);
router.post('/rooms/:roomId/read', chatController.markRead);
router.post('/rooms/:roomId/pin/:messageId', chatController.pinMessage);
router.post('/rooms/:roomId/unpin/:messageId', chatController.unpinMessage);
router.patch('/rooms/:roomId', chatController.updateRoom);

module.exports = router;
