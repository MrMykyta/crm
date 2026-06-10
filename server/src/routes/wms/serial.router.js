
// serialRouter.js (generated)
const serialRouter = require('express').Router();
const controller = require('../../controllers/wms/serial.controller');
const acl = require('./acl');

serialRouter.get('/', acl.read, controller.list);
serialRouter.get('/:id', acl.read, controller.getById);
serialRouter.post('/', acl.documentUpdate, controller.create);
serialRouter.put('/:id', acl.documentUpdate, controller.update);
serialRouter.delete('/:id', acl.documentUpdate, controller.remove);

module.exports = serialRouter;
