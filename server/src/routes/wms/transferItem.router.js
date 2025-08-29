
// transferItemRouter.js (generated)
const transferItemRouter = require('express').Router();
const controller = require('../../controllers/wms/transferItem.controller');

transferItemRouter.get('/', controller.list);
transferItemRouter.get('/:id', controller.getById);
transferItemRouter.post('/', controller.create);
transferItemRouter.put('/:id', controller.update);
transferItemRouter.delete('/:id', controller.remove);

module.exports = transferItemRouter;
