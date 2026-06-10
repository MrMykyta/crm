'use strict';

const warehouseRouter = require('express').Router();
const validate = require('../../middleware/validate');
const controller = require('../../controllers/wms/warehouse.controller');
const warehouseSchema = require('../../wms/schemas/warehouse.schema');
const acl = require('./acl');

warehouseRouter.get('/', acl.read, validate(warehouseSchema.listQuery, 'query'), controller.list);
warehouseRouter.get('/:id', acl.read, validate(warehouseSchema.idParam, 'params'), controller.getById);
warehouseRouter.post('/', acl.warehouseManage, validate(warehouseSchema.create), controller.create);
warehouseRouter.put(
  '/:id',
  acl.warehouseManage,
  validate(warehouseSchema.idParam, 'params'),
  validate(warehouseSchema.update),
  controller.update
);
warehouseRouter.delete('/:id', acl.warehouseManage, validate(warehouseSchema.idParam, 'params'), controller.remove);

module.exports = warehouseRouter;
