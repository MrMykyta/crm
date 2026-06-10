
// shipmentItemRouter.js (generated)
const shipmentItemRouter = require('express').Router();
const controller = require('../../controllers/wms/shipmentItem.controller');
const acl = require('./acl');

shipmentItemRouter.get('/', acl.read, controller.list);
shipmentItemRouter.get('/:id', acl.read, controller.getById);
shipmentItemRouter.post('/', acl.documentUpdate, controller.create);
shipmentItemRouter.put('/:id', acl.documentUpdate, controller.update);
shipmentItemRouter.delete('/:id', acl.documentUpdate, controller.remove);

module.exports = shipmentItemRouter;
