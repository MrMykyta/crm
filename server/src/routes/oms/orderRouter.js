const orderRouter = require('express').Router();
const OrderController = require('../../controllers/oms/Order.controller');
const validateBody = require('../../middleware/validateBody');
const validateQuery = require('../../middleware/validateQuery');
const authorize = require('../../middleware/authorize');
const orderSchema = require('../../schemas/orderSchema');

orderRouter.get('/meta', authorize('order:read'), OrderController.meta);

orderRouter.get('/', validateQuery(orderSchema.listQuery), authorize('order:read'), OrderController.list);
orderRouter.post('/', validateBody(orderSchema.create), authorize('order:create'), OrderController.create);

orderRouter.get('/:id', authorize('order:read'), OrderController.getById);
orderRouter.put('/:id', validateBody(orderSchema.update), authorize('order:update'), OrderController.update);
orderRouter.patch('/:id', validateBody(orderSchema.update), authorize('order:update'), OrderController.update);
orderRouter.delete('/:id', authorize('order:delete'), OrderController.remove);

orderRouter.get('/:id/items', authorize('order:read'), OrderController.getById);
orderRouter.put('/:id/items', validateBody(orderSchema.saveItems), authorize('order:update'), OrderController.saveItems);
orderRouter.patch('/:id/items', validateBody(orderSchema.saveItems), authorize('order:update'), OrderController.saveItems);

orderRouter.post(
  '/from-offer/:id',
  validateBody(orderSchema.fromOfferPayload),
  authorize('order:from_offer'),
  OrderController.fromOffer
);
orderRouter.post(
  '/:id/actions/confirm',
  validateBody(orderSchema.actionPayload),
  authorize('order:update'),
  OrderController.confirm
);
orderRouter.post(
  '/:id/actions/reserve',
  validateBody(orderSchema.actionPayload),
  authorize('order:update'),
  OrderController.reserve
);
orderRouter.post(
  '/:id/actions/cancel',
  validateBody(orderSchema.actionPayload),
  authorize('order:update'),
  OrderController.cancel
);
orderRouter.post(
  '/:id/actions/ship',
  validateBody(orderSchema.actionPayload),
  authorize('order:update'),
  OrderController.ship
);
orderRouter.post(
  '/:id/actions/complete',
  validateBody(orderSchema.actionPayload),
  authorize('order:update'),
  OrderController.complete
);
orderRouter.post(
  '/:id/actions/return',
  validateBody(orderSchema.actionPayload),
  authorize('order:update'),
  OrderController.markReturned
);
orderRouter.post(
  '/:id/actions/convert-to-invoice',
  validateBody(orderSchema.convertPayload),
  authorize('order:convert'),
  OrderController.convertToInvoice
);

module.exports = orderRouter;
