
// lotRouter.js (generated)
const lotRouter = require('express').Router();
const controller = require('../../controllers/wms/lot.controller');
const acl = require('./acl');

lotRouter.get('/', acl.read, controller.list);
lotRouter.get('/:id', acl.read, controller.getById);
lotRouter.post('/', acl.documentUpdate, controller.create);
lotRouter.put('/:id', acl.documentUpdate, controller.update);
lotRouter.delete('/:id', acl.documentUpdate, controller.remove);

module.exports = lotRouter;
