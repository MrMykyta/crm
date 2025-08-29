const express = require('express');
const companyController = require('../../controllers/crm/Company.controller');

const companyRouter = express.Router();

const authorize = require('../../middleware/authorize');


companyRouter.get('/', authorize('compamy:read'), companyController.listForMe);

companyRouter.get('/:id', authorize('compamy:read'), companyController.getOne);

companyRouter.post('/', companyController.create);

companyRouter.put('/:id', authorize('compamy:update'), companyController.update);

companyRouter.delete('/:id', authorize('compamy:delete'), companyController.remove);

module.exports = companyRouter;