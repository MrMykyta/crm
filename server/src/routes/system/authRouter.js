const express = require('express');
const authRouter = express.Router();
const { auth } = require('../../middleware/auth');
const authController = require('../../controllers/system/Auth.controller');

authRouter.post('/register', authController.register);    
authRouter.get('/verify', authController.verify);
authRouter.post('/resend-verification', authController.resendVerification);
authRouter.post('/login', authController.login);
authRouter.post('/login-from-company', auth, authController.loginFromCompany);          
authRouter.post('/refresh', authController.refresh); 
authRouter.post('/password/forgot', authController.forgot);
authRouter.post('/password/reset',  authController.reset);
authRouter.post('/logout', authController.logout);        
authRouter.post('/logout-all', auth, authController.logoutAll);

module.exports = authRouter;
