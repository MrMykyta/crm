const express = require('express');
const { auth } = require('../../middleware/auth');
const userCompanyController = require('../../controllers/crm/UserCompany.controller');

const userCompanyRouter = express.Router();

// Все эти эндпоинты — приватные
userCompanyRouter.get('/:companyId/users', auth, userCompanyController.listUsers);
userCompanyRouter.post('/:companyId/users', auth, userCompanyController.addUser);
userCompanyRouter.put('/:companyId/users/:userId', auth, userCompanyController.updateMember);
userCompanyRouter.delete('/:companyId/users/:userId', auth, userCompanyController.removeUser);

module.exports = userCompanyRouter;