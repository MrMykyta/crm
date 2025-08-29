
// productSupplierRouter.js (generated)
const productSupplierRouter = require('express').Router();
const controller = require('../../controllers/pim/productSupplier.controller');
productSupplierRouter.get('/', controller.list); 
productSupplierRouter.get('/:id', controller.getById); 
productSupplierRouter.post('/', controller.create); 
productSupplierRouter.put('/:id', controller.update); 
productSupplierRouter.delete('/:id', controller.remove);
module.exports = productSupplierRouter;
