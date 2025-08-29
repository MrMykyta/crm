
// transferOrderRouter.js (generated)
const transferOrderRouter = require('express').Router();
const controller = require('../../controllers/wms/transferOrder.controller');

transferOrderRouter.get('/', controller.list);
transferOrderRouter.get('/:id', controller.getById);
transferOrderRouter.post('/', controller.create);
transferOrderRouter.put('/:id', controller.update);
transferOrderRouter.delete('/:id', controller.remove);

module.exports = transferOrderRouter;
