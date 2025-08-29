
// productVariantRouter.js (generated)
const productVariantRouter = require('express').Router();
const controller = require('../../controllers/pim/productVariant.controller');
productVariantRouter.get('/', controller.list); 
productVariantRouter.get('/:id', controller.getById); 
productVariantRouter.post('/', controller.create); 
productVariantRouter.put('/:id', controller.update); 
productVariantRouter.delete('/:id', controller.remove);
module.exports = productVariantRouter;
