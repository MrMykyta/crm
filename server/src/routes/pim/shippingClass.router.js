
// shippingClassRouter.js (generated)
const shippingClassRouter = require('express').Router();
const controller = require('../../controllers/pim/shippingClass.controller');
shippingClassRouter.get('/', controller.list); 
shippingClassRouter.get('/:id', controller.getById); 
shippingClassRouter.post('/', controller.create); 
shippingClassRouter.put('/:id', controller.update); 
shippingClassRouter.delete('/:id', controller.remove);
module.exports = shippingClassRouter;
