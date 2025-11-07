// routes/crm/userCompanyRouter.js
const express = require('express');
const authorize = require('../../middleware/authorize');
const userCompanyController = require('../../controllers/crm/UserCompany.controller');

const userCompanyRouter = express.Router();

userCompanyRouter.get(
  '/:companyId/users',
  authorize(['member:read', 'member:read:dept', 'member:read:own']),
  userCompanyController.listUsers
);

userCompanyRouter.post(
  '/:companyId/users',
  authorize(['member:create', 'member:create:dept']),
  userCompanyController.addUser
);

userCompanyRouter.put(
  '/:companyId/users/:userId',
  authorize(['member:update', 'member:update:dept', 'member:update:own']),
  userCompanyController.updateMember
);

userCompanyRouter.delete(
  '/:companyId/users/:userId',
  authorize(['member:delete', 'member:delete:dept']),
  userCompanyController.removeUser
);

module.exports = userCompanyRouter;