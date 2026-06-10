
// locationRouter.js (generated)
const locationRouter = require('express').Router();
const controller = require('../../controllers/wms/location.controller');
const acl = require('./acl');

locationRouter.get('/', acl.read, controller.list);
locationRouter.get('/:id', acl.read, controller.getById);
locationRouter.post('/', acl.locationManage, controller.create);
locationRouter.put('/:id', acl.locationManage, controller.update);
locationRouter.delete('/:id', acl.locationManage, controller.remove);

module.exports = locationRouter;
