
// priceListItemRouter.js (generated)
const priceListItemRouter = require('express').Router();
const authorize = require('../../middleware/authorize');
const controller = require('../../controllers/pim/priceListItem.controller');
priceListItemRouter.get('/', authorize('price_list:read'), controller.list);
priceListItemRouter.get('/:id', authorize('price_list:read'), controller.getById);
priceListItemRouter.post('/', authorize('price_list:create'), controller.create);
priceListItemRouter.put('/:id', authorize('price_list:update'), controller.update);
priceListItemRouter.delete('/:id', authorize('price_list:delete'), controller.remove);
module.exports = priceListItemRouter;
