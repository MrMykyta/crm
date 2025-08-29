const express = require('express');
const authRouter = express.Router();
const { auth } = require('../../middleware/auth');
const authController = require('../../controllers/system/Auth.controller');

authRouter.post('/register', authController.register);     // выдаёт access+refresh
authRouter.post('/login', authController.login);           // выдаёт access+refresh
authRouter.post('/refresh', authController.refresh);       // rotate refresh → новые токены
authRouter.post('/logout', authController.logout);         // revoke конкретный refresh
authRouter.post('/logout-all', auth, authController.logoutAll); // revoke все refresh юзера

module.exports = authRouter;
