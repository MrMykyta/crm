const express = require('express');
const userController = require('../../controllers/crm/User.controller');
const { auth } = require('../../middleware/auth');

const userRouter = express.Router();

userRouter.get('/me', userController.me);
userRouter.patch('/me', userController.updateMe);

userRouter.get('/lookup', auth, userController.lookupByEmail);

userRouter.get('/me/companies', userController.myCompanies);

module.exports = userRouter;
