
// adjustmentItemRouter.js (generated)
const adjustmentItemRouter = require('express').Router();
const controller = require('../../controllers/wms/adjustmentItem.controller');

adjustmentItemRouter.get('/', controller.list);
adjustmentItemRouter.get('/:id', controller.getById);
adjustmentItemRouter.post('/', controller.create);
adjustmentItemRouter.put('/:id', controller.update);
adjustmentItemRouter.delete('/:id', controller.remove);

module.exports = adjustmentItemRouter;
