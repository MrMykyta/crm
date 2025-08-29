
// shipmentItemRouter.js (generated)
const shipmentItemRouter = require('express').Router();
const controller = require('../../controllers/wms/shipmentItem.controller');

shipmentItemRouter.get('/', controller.list);
shipmentItemRouter.get('/:id', controller.getById);
shipmentItemRouter.post('/', controller.create);
shipmentItemRouter.put('/:id', controller.update);
shipmentItemRouter.delete('/:id', controller.remove);

module.exports = shipmentItemRouter;
