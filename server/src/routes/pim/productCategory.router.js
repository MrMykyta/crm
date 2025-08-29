
// productCategoryRouter.js (generated)
const productCategoryRouter = require('express').Router();
const controller = require('../../controllers/pim/productCategory.controller');
productCategoryRouter.get('/', controller.list); 
productCategoryRouter.get('/:id', controller.getById); 
productCategoryRouter.post('/', controller.create); 
productCategoryRouter.put('/:id', controller.update); 
productCategoryRouter.delete('/:id', controller.remove);
module.exports = productCategoryRouter;
