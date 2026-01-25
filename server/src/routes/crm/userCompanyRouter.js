// routes/crm/userCompanyRouter.js
const express = require('express');
const authorize = require('../../middleware/authorize');
const userCompanyController = require('../../controllers/crm/UserCompany.controller');

const userCompanyRouter = express.Router();

userCompanyRouter.get(
  '/users',
  authorize(['member:read', 'member:read:dept', 'member:read:own']),
  userCompanyController.listUsers
);

userCompanyRouter.post(
  '/users',
  authorize(['member:create', 'member:create:dept']),
  userCompanyController.addUser
);

userCompanyRouter.put(
  '/users/:userId',
  authorize(['member:update', 'member:update:dept', 'member:update:own']),
  userCompanyController.updateMember
);

userCompanyRouter.delete(
  '/users/:userId',
  authorize(['member:delete', 'member:delete:dept']),
  userCompanyController.removeUser
);

module.exports = userCompanyRouter;
