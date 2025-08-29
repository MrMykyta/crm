
// priceListRouter.js (generated)
const priceListRouter = require('express').Router();
const controller = require('../../controllers/pim/priceList.controller');
priceListRouter.get('/', controller.list); 
priceListRouter.get('/:id', controller.getById); 
priceListRouter.post('/', controller.create); 
priceListRouter.put('/:id', controller.update); 
priceListRouter.delete('/:id', controller.remove);
module.exports = priceListRouter;
