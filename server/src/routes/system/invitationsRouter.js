const express = require('express');
const invitationsRouter = express.Router();
const ctrl = require('../../controllers/system/Invitation.controller');
const { auth } = require('../../middleware/auth');

// создание инвайта
invitationsRouter.post('/companies/:companyId/invitations', auth, ctrl.createInvitation);

// список инвайтов компании
invitationsRouter.get('/companies/:companyId/invitations', auth, ctrl.listInvitations);

// ресенд
invitationsRouter.post('/:id/resend', auth, ctrl.resendInvitation);

// отзыв
invitationsRouter.post('/:id/revoke', auth, ctrl.revokeInvitation);

// 🔹 публичная проверка токена (для префилда формы)
invitationsRouter.get('/check', ctrl.checkInvitation);

// 🔹 акцепт по токену (публичный)
invitationsRouter.post('/accept', ctrl.acceptInvitation);

module.exports = invitationsRouter;