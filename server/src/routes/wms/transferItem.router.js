
// transferItemRouter.js (generated)
const transferItemRouter = require('express').Router();
const controller = require('../../controllers/wms/transferItem.controller');
const acl = require('./acl');

transferItemRouter.get('/', acl.read, controller.list);
transferItemRouter.get('/:id', acl.read, controller.getById);
transferItemRouter.post('/', acl.documentUpdate, controller.create);
transferItemRouter.put('/:id', acl.documentUpdate, controller.update);
transferItemRouter.delete('/:id', acl.documentUpdate, controller.remove);

module.exports = transferItemRouter;
