
// productLocalizationRouter.js (generated)
const productLocalizationRouter = require('express').Router();
const controller = require('../../controllers/pim/productLocalization.controller');
productLocalizationRouter.get('/', controller.list); 
productLocalizationRouter.get('/:id', controller.getById); 
productLocalizationRouter.post('/', controller.create); 
productLocalizationRouter.put('/:id', controller.update); 
productLocalizationRouter.delete('/:id', controller.remove);
module.exports = productLocalizationRouter;
