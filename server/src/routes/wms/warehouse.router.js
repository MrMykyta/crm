'use strict';

const warehouseRouter = require('express').Router();
const validate = require('../../middleware/validate');
const controller = require('../../controllers/wms/warehouse.controller');
const warehouseSchema = require('../../wms/schemas/warehouse.schema');

warehouseRouter.get('/', validate(warehouseSchema.listQuery, 'query'), controller.list);
warehouseRouter.get('/:id', validate(warehouseSchema.idParam, 'params'), controller.getById);
warehouseRouter.post('/', validate(warehouseSchema.create), controller.create);
warehouseRouter.put(
  '/:id',
  validate(warehouseSchema.idParam, 'params'),
  validate(warehouseSchema.update),
  controller.update
);
warehouseRouter.delete('/:id', validate(warehouseSchema.idParam, 'params'), controller.remove);

module.exports = warehouseRouter;
