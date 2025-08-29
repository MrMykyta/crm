
// warehouseRouter.js (generated)
const warehouseRouter = require('express').Router();
const controller = require('../../controllers/wms/warehouse.controller');

warehouseRouter.get('/', controller.list);
warehouseRouter.get('/:id', controller.getById);
warehouseRouter.post('/', controller.create);
warehouseRouter.put('/:id', controller.update);
warehouseRouter.delete('/:id', controller.remove);

module.exports = warehouseRouter;
