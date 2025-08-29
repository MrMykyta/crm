
// serialRouter.js (generated)
const serialRouter = require('express').Router();
const controller = require('../../controllers/wms/serial.controller');

serialRouter.get('/', controller.list);
serialRouter.get('/:id', controller.getById);
serialRouter.post('/', controller.create);
serialRouter.put('/:id', controller.update);
serialRouter.delete('/:id', controller.remove);

module.exports = serialRouter;
