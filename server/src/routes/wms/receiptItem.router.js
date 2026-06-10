
// receiptItemRouter.js (generated)
const receiptItemRouter = require('express').Router();
const controller = require('../../controllers/wms/receiptItem.controller');
const acl = require('./acl');

receiptItemRouter.get('/', acl.read, controller.list);
receiptItemRouter.get('/:id', acl.read, controller.getById);
receiptItemRouter.post('/', acl.documentUpdate, controller.create);
receiptItemRouter.put('/:id', acl.documentUpdate, controller.update);
receiptItemRouter.delete('/:id', acl.documentUpdate, controller.remove);

module.exports = receiptItemRouter;
