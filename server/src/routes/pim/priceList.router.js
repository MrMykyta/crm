
// priceListRouter.js (generated)
const priceListRouter = require('express').Router();
const authorize = require('../../middleware/authorize');
const controller = require('../../controllers/pim/priceList.controller');
priceListRouter.get('/', authorize('price_list:read'), controller.list);
priceListRouter.get('/:id', authorize('price_list:read'), controller.getById);
priceListRouter.post('/', authorize('price_list:create'), controller.create);
priceListRouter.put('/:id', authorize('price_list:update'), controller.update);
priceListRouter.delete('/:id', authorize('price_list:delete'), controller.remove);
module.exports = priceListRouter;
