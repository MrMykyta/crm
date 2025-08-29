
// cycleCountRouter.js (generated)
const cycleCountRouter = require('express').Router();
const controller = require('../../controllers/wms/cycleCount.controller');

cycleCountRouter.get('/', controller.list);
cycleCountRouter.get('/:id', controller.getById);
cycleCountRouter.post('/', controller.create);
cycleCountRouter.put('/:id', controller.update);
cycleCountRouter.delete('/:id', controller.remove);

module.exports = cycleCountRouter;
