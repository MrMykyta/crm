
// priceListItemRouter.js (generated)
const priceListItemRouter = require('express').Router();
const controller = require('../../controllers/pim/priceListItem.controller');
priceListItemRouter.get('/', controller.list); 
priceListItemRouter.get('/:id', controller.getById); 
priceListItemRouter.post('/', controller.create); 
priceListItemRouter.put('/:id', controller.update); 
priceListItemRouter.delete('/:id', controller.remove);
module.exports = priceListItemRouter;
