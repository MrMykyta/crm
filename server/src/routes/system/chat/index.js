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
router.post('/direct', requirePermission('chat.write'), chatController.getOrCreateDirect);
router.post('/group', requirePermission('chat.write'), chatController.createGroup);
router.get('/rooms/:roomId/messages', requirePermission('chat.read'), chatController.listMessages);
router.get('/messages/:messageId/reactions', requirePermission('chat.read'), chatController.listMessageReactions);
router.post('/messages/:messageId/reactions', requirePermission('chat.write'), chatController.toggleReaction);
router.delete('/messages/:messageId/reactions/:emoji', requirePermission('chat.write'), chatController.removeReaction);
router.get('/rooms/:roomId/pins', requirePermission('chat.read'), chatController.listPinnedMessages);
router.post('/rooms/:roomId/messages', requirePermission('chat.write'), validate(chatSchema.sendMessage), chatController.sendMessage);
router.patch('/rooms/:roomId/messages/:messageId', requirePermission('chat.write'), chatController.editMessage);
router.delete('/rooms/:roomId/messages/:messageId', requirePermission('chat.write'), chatController.deleteMessage);
router.post('/rooms/:roomId/read', chatController.markRead);
router.post('/rooms/:roomId/pin/:messageId', requirePermission('chat.write'), chatController.pinMessage);
router.post('/rooms/:roomId/unpin/:messageId', requirePermission('chat.write'), chatController.unpinMessage);
router.patch('/rooms/:roomId', requirePermission('chat.write'), chatController.updateRoom);

module.exports = router;
