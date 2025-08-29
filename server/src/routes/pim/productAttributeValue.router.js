
// productAttributeValueRouter.js (generated)
const productAttributeValueRouter = require('express').Router();
const controller = require('../../controllers/pim/productAttributeValue.controller');
productAttributeValueRouter.get('/', controller.list); 
productAttributeValueRouter.get('/:id', controller.getById); 
productAttributeValueRouter.post('/', controller.create); 
productAttributeValueRouter.put('/:id', controller.update); 
productAttributeValueRouter.delete('/:id', controller.remove);
module.exports = productAttributeValueRouter;
