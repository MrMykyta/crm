
// productTypeRouter.js (generated)
const productTypeRouter = require('express').Router();
const controller = require('../../controllers/pim/productType.controller');
productTypeRouter.get('/', controller.list); 
productTypeRouter.get('/:id', controller.getById); 
productTypeRouter.post('/', controller.create); 
productTypeRouter.put('/:id', controller.update); 
productTypeRouter.delete('/:id', controller.remove);
module.exports = productTypeRouter;
