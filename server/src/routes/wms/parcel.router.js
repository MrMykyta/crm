
// parcelRouter.js (generated)
const parcelRouter = require('express').Router();
const controller = require('../../controllers/wms/parcel.controller');
const acl = require('./acl');

parcelRouter.get('/', acl.read, controller.list);
parcelRouter.get('/:id', acl.read, controller.getById);
parcelRouter.post('/', acl.documentUpdate, controller.create);
parcelRouter.put('/:id', acl.documentUpdate, controller.update);
parcelRouter.delete('/:id', acl.documentUpdate, controller.remove);

module.exports = parcelRouter;
