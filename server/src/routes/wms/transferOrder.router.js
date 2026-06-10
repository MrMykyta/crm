
// transferOrderRouter.js (generated)
const transferOrderRouter = require('express').Router();
const controller = require('../../controllers/wms/transferOrder.controller');
const acl = require('./acl');

transferOrderRouter.get('/', acl.read, controller.list);
transferOrderRouter.get('/item/:itemId/stock-moves', acl.inventoryRead, controller.listItemStockMoves);
transferOrderRouter.get('/:id/stock-moves', acl.inventoryRead, controller.listStockMoves);
transferOrderRouter.get('/:id/print', acl.read, controller.getPrint);
transferOrderRouter.get('/:id', acl.read, controller.getById);
transferOrderRouter.post('/', acl.documentCreate, controller.create);
transferOrderRouter.put('/:id', acl.documentUpdate, controller.update);
transferOrderRouter.delete('/:id', acl.documentUpdate, controller.remove);

module.exports = transferOrderRouter;
