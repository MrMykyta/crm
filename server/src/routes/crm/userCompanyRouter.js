const express = require('express');
const userCompanyController = require('../../controllers/crm/UserCompany.controller');

const userCompanyRouter = express.Router();

userCompanyRouter.get('/:companyId/users', userCompanyController.listUsers);

userCompanyRouter.post('/:companyId/users', userCompanyController.addUser);

userCompanyRouter.put('/:companyId/users/:userId', userCompanyController.updateRole);

userCompanyRouter.delete('/:companyId/users/:userId', userCompanyController.removeUser);

module.exports = userCompanyRouter;