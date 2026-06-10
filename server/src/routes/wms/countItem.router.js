
// countItemRouter.js (generated)
const countItemRouter = require('express').Router();
const controller = require('../../controllers/wms/countItem.controller');
const acl = require('./acl');

countItemRouter.get('/', acl.read, controller.list);
countItemRouter.get('/:id', acl.read, controller.getById);
countItemRouter.post('/', acl.inventoryCount, controller.create);
countItemRouter.put('/:id', acl.inventoryCount, controller.update);
countItemRouter.delete('/:id', acl.inventoryCount, controller.remove);

module.exports = countItemRouter;
