const express = require('express');
const authRouter = express.Router();
const { auth } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const authController = require('../../controllers/system/Auth.controller');
const authSchema = require('../../system/auth/schemas/auth.schema');

authRouter.post('/register', authController.register);    
authRouter.get('/verify', authController.verify);
authRouter.post('/resend-verification', authController.resendVerification);
authRouter.post('/login', validate(authSchema.login), authController.login);
authRouter.post('/login-from-company', auth, authController.loginFromCompany);          
authRouter.post('/refresh', validate(authSchema.refresh), authController.refresh); 
authRouter.post('/password/forgot', authController.forgot);
authRouter.post('/password/reset',  authController.reset);
authRouter.post('/logout', authController.logout);        
authRouter.post('/logout-all', auth, authController.logoutAll);

module.exports = authRouter;
