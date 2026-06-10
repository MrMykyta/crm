
// adjustmentItemRouter.js (generated)
const adjustmentItemRouter = require('express').Router();
const controller = require('../../controllers/wms/adjustmentItem.controller');
const acl = require('./acl');

adjustmentItemRouter.get('/', acl.read, controller.list);
adjustmentItemRouter.get('/:id', acl.read, controller.getById);
adjustmentItemRouter.post('/', acl.documentUpdate, controller.create);
adjustmentItemRouter.put('/:id', acl.documentUpdate, controller.update);
adjustmentItemRouter.delete('/:id', acl.documentUpdate, controller.remove);

module.exports = adjustmentItemRouter;
