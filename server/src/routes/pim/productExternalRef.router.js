
// productExternalRefRouter.js (generated)
const productExternalRefRouter = require('express').Router();
const controller = require('../../controllers/pim/productExternalRef.controller');
productExternalRefRouter.get('/', controller.list); 
productExternalRefRouter.get('/:id', controller.getById); 
productExternalRefRouter.post('/', controller.create); 
productExternalRefRouter.put('/:id', controller.update); 
productExternalRefRouter.delete('/:id', controller.remove);
module.exports = productExternalRefRouter;
