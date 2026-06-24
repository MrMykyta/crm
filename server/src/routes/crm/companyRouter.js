const express = require('express');
const companyController = require('../../controllers/crm/Company.controller');

const companyRouter = express.Router();

const authorize = require('../../middleware/authorize');


companyRouter.get('/', companyController.listForMe);

companyRouter.get('/:id', companyController.getOne);

companyRouter.post('/', companyController.create);

companyRouter.put('/:id', authorize('company:update'), companyController.update);

companyRouter.delete('/:id', authorize('company:delete'), companyController.remove);

module.exports = companyRouter;
