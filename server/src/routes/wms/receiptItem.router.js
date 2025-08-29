
// receiptItemRouter.js (generated)
const receiptItemRouter = require('express').Router();
const controller = require('../../controllers/wms/receiptItem.controller');

receiptItemRouter.get('/', controller.list);
receiptItemRouter.get('/:id', controller.getById);
receiptItemRouter.post('/', controller.create);
receiptItemRouter.put('/:id', controller.update);
receiptItemRouter.delete('/:id', controller.remove);

module.exports = receiptItemRouter;
