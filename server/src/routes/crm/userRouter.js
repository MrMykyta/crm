// src/routes/crm/userRouter.js
const express = require('express');
const userController = require('../../controllers/crm/User.controller');
const { auth } = require('../../middleware/auth');
const authorize = require('../../middleware/authorize');

const userRouter = express.Router();

// ---- текущий пользователь
userRouter.get('/me', auth, userController.me);
userRouter.patch('/me', auth, userController.updateMe);
userRouter.get('/me/companies', auth, userController.myCompanies);

// ---- поиск
userRouter.get('/lookup', auth, userController.lookupByEmail);

// ---- управление конкретным пользователем (в контексте активной компании)
userRouter.get('/:companyId/:userId', auth, authorize('company:read'), userController.getById);
userRouter.patch('/:companyId/:userId', auth, authorize('company:update'), userController.updateById);

module.exports = userRouter;