'use strict';

const { Joi } = require('./_common');
const {
  WAREHOUSE_DOCUMENT_TYPE_KEYS,
} = require('../services/crm/warehouseDocumentSettingsConfig');

module.exports.update = Joi.object({
  defaultWarehouseId: Joi.string().uuid().allow(null, ''),
  warehouseDefaultDocumentType: Joi.string().valid(...WAREHOUSE_DOCUMENT_TYPE_KEYS),
  warehouseDocumentTypes: Joi.array().items(
    Joi.object({
      typeKey: Joi.string().valid(...WAREHOUSE_DOCUMENT_TYPE_KEYS).required(),
      enabled: Joi.boolean(),
      numberingType: Joi.string().max(64),
      numberPattern: Joi.string().allow('').max(80),
    }).min(2)
  ),
}).min(1);
