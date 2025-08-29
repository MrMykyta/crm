const orderRouter = require('express').Router();
const OrderController = require('../../controllers/oms/Order.controller');


orderRouter.get('/', OrderController.list);
orderRouter.post('/', OrderController.create);
orderRouter.get('/:id', OrderController.get);
orderRouter.put('/:id', OrderController.update);

orderRouter.post('/from-offer/:id', OrderController.fromOffer);
orderRouter.delete('/:id', OrderController.remove);

module.exports = orderRouter;
