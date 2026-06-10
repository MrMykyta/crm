
// inventoryItemRouter.js (generated)
const inventoryItemRouter = require('express').Router();
const controller = require('../../controllers/wms/inventoryItem.controller');
const acl = require('./acl');

inventoryItemRouter.get('/', acl.inventoryRead, controller.list);
inventoryItemRouter.get('/:id', acl.inventoryRead, controller.getById);
inventoryItemRouter.post('/', acl.documentUpdate, controller.create);
inventoryItemRouter.put('/:id', acl.documentUpdate, controller.update);
inventoryItemRouter.delete('/:id', acl.documentUpdate, controller.remove);

module.exports = inventoryItemRouter;
