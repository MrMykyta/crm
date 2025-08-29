
// productTagRouter.js (generated)
const productTagRouter = require('express').Router();
const controller = require('../../controllers/pim/productTag.controller');
productTagRouter.get('/', controller.list); 
productTagRouter.get('/:id', controller.getById); 
productTagRouter.post('/', controller.create); 
productTagRouter.put('/:id', controller.update); 
productTagRouter.delete('/:id', controller.remove);
module.exports = productTagRouter;
