
// parcelRouter.js (generated)
const parcelRouter = require('express').Router();
const controller = require('../../controllers/wms/parcel.controller');

parcelRouter.get('/', controller.list);
parcelRouter.get('/:id', controller.getById);
parcelRouter.post('/', controller.create);
parcelRouter.put('/:id', controller.update);
parcelRouter.delete('/:id', controller.remove);

module.exports = parcelRouter;
