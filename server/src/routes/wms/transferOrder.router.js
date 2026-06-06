
// transferOrderRouter.js (generated)
const transferOrderRouter = require('express').Router();
const controller = require('../../controllers/wms/transferOrder.controller');

transferOrderRouter.get('/', controller.list);
transferOrderRouter.get('/item/:itemId/stock-moves', controller.listItemStockMoves);
transferOrderRouter.get('/:id/stock-moves', controller.listStockMoves);
transferOrderRouter.get('/:id/print', controller.getPrint);
transferOrderRouter.get('/:id', controller.getById);
transferOrderRouter.post('/', controller.create);
transferOrderRouter.put('/:id', controller.update);
transferOrderRouter.delete('/:id', controller.remove);

module.exports = transferOrderRouter;
