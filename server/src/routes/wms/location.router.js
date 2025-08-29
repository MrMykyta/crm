
// locationRouter.js (generated)
const locationRouter = require('express').Router();
const controller = require('../../controllers/wms/location.controller');

locationRouter.get('/', controller.list);
locationRouter.get('/:id', controller.getById);
locationRouter.post('/', controller.create);
locationRouter.put('/:id', controller.update);
locationRouter.delete('/:id', controller.remove);

module.exports = locationRouter;
