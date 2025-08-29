
// inventoryItemRouter.js (generated)
const inventoryItemRouter = require('express').Router();
const controller = require('../../controllers/wms/inventoryItem.controller');

inventoryItemRouter.get('/', controller.list);
inventoryItemRouter.get('/:id', controller.getById);
inventoryItemRouter.post('/', controller.create);
inventoryItemRouter.put('/:id', controller.update);
inventoryItemRouter.delete('/:id', controller.remove);

module.exports = inventoryItemRouter;
