
// productComponentRouter.js (generated)
const productComponentRouter = require('express').Router();
const controller = require('../../controllers/pim/productComponent.controller');
productComponentRouter.get('/', controller.list); 
productComponentRouter.get('/:id', controller.getById); 
productComponentRouter.post('/', controller.create); 
productComponentRouter.put('/:id', controller.update); 
productComponentRouter.delete('/:id', controller.remove);
module.exports = productComponentRouter;
