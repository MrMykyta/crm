
// stockMoveRouter.js (generated)
const stockMoveRouter = require('express').Router();
const controller = require('../../controllers/wms/stockMove.controller');
const acl = require('./acl');

stockMoveRouter.get('/history/document', acl.inventoryRead, controller.historyByDocument);
stockMoveRouter.get('/history/product', acl.inventoryRead, controller.historyByProduct);
stockMoveRouter.get('/', acl.inventoryRead, controller.list);
stockMoveRouter.get('/:id', acl.inventoryRead, controller.getById);
stockMoveRouter.post('/', acl.documentUpdate, controller.create);
stockMoveRouter.put('/:id', acl.documentUpdate, controller.update);
stockMoveRouter.delete('/:id', acl.documentUpdate, controller.remove);

module.exports = stockMoveRouter;
