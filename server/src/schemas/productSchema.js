'use strict';

const { Joi, uuid } = require('./_common');

const PRICE_TYPE_VALUES = ['purchase', 'sale'];

const decimal = Joi.number().precision(6);
const money = Joi.number().precision(2);

const baseFields = {
  // Core / identity
  name: Joi.string().trim().min(1).max(255),
  sku: Joi.string().trim().max(64).allow('', null),
  slug: Joi.string().trim().max(300).allow('', null),
  barcode: Joi.string().trim().max(64).allow('', null),
  ean: Joi.string().trim().max(32).allow('', null),
  description: Joi.string().allow('', null),

  // Codes / classification
  pkwiu: Joi.string().trim().max(32).allow('', null),
  cn: Joi.string().trim().max(32).allow('', null),
  gtu: Joi.string().trim().max(32).allow('', null),
  hsCode: Joi.string().trim().max(32).allow('', null),
  countryOfOrigin: Joi.string().trim().max(2).allow('', null),

  // Classification / relations
  brandId: uuid.allow(null, ''),
  primaryCategoryId: uuid.allow(null, ''),
  subcategoryId: uuid.allow(null, ''),
  supplierId: uuid.allow(null, ''),
  manufacturerId: uuid.allow(null, ''),
  uomId: uuid.allow(null, ''),
  productTypeId: uuid.allow(null, ''),
  taxCategoryId: uuid.allow(null, ''),
  shippingClassId: uuid.allow(null, ''),
  replacedByProductId: uuid.allow(null, ''),

  // Sales / lifecycle
  saleStartDate: Joi.date().iso().allow(null, ''),
  saleEndDate: Joi.date().iso().allow(null, ''),
  publishedAt: Joi.date().iso().allow(null, ''),
  discontinuedAt: Joi.date().iso().allow(null, ''),
  price: money.min(0).allow(null),
  oldPrice: money.min(0).allow(null),
  cost: money.min(0).allow(null),
  currency: Joi.string().trim().length(3),
  status: Joi.string().valid('draft', 'active', 'archived'),
  visibility: Joi.string().valid('public', 'private'),
  isSellable: Joi.boolean(),
  isService: Joi.boolean(),
  trackInventory: Joi.boolean(),

  // Transitional inventory counters (derived by inventory module; keep for compatibility)
  stockQuantity: decimal.min(0).allow(null),
  reservedQuantity: decimal.min(0).allow(null),
  orderedQuantity: decimal.min(0).allow(null),

  // Logistics / advanced
  weight: decimal.min(0).allow(null),
  length: decimal.min(0).allow(null),
  width: decimal.min(0).allow(null),
  height: decimal.min(0).allow(null),
  warrantyMonths: Joi.number().integer().min(0).allow(null),
  dangerousGoodsClass: Joi.string().trim().max(16).allow('', null),
  unNumber: Joi.string().trim().max(10).allow('', null),
  isSerialized: Joi.boolean(),
  isLotTracked: Joi.boolean(),
  shelfLifeDays: Joi.number().integer().min(0).allow(null),
};

module.exports.listQuery = Joi.object({
  q: Joi.string().trim().max(200).allow('', null),
  search: Joi.string().trim().max(200).allow('', null),

  brandId: uuid,
  categoryId: uuid,
  subcategoryId: uuid,
  supplierId: uuid,

  status: Joi.string().valid('draft', 'active', 'archived'),
  visibility: Joi.string().valid('public', 'private'),
  isSellable: Joi.boolean(),

  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25),
  sort: Joi.string()
    .valid('createdAt', 'updatedAt', 'name', 'sku', 'price', 'cost', 'stockQuantity')
    .default('createdAt'),
  dir: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('DESC'),
});

module.exports.pickerQuery = Joi.object({
  q: Joi.string().trim().max(200).allow('', null),
  warehouseId: uuid.allow('', null),
  limit: Joi.number().integer().min(1).max(50).default(20),
  includeInactive: Joi.boolean().default(false),
});

module.exports.create = Joi.object({
  companyId: Joi.forbidden(),
  id: Joi.forbidden(),
  ...baseFields,
  name: baseFields.name.required(),
});

module.exports.update = Joi.object({
  companyId: Joi.forbidden(),
  id: Joi.forbidden(),
  ...baseFields,
}).min(1);

module.exports.updateDescription = Joi.object({
  description: Joi.string().allow('', null).required(),
});

module.exports.priceListQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
});

module.exports.movementListQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
});

module.exports.createPrice = Joi.object({
  type: Joi.string().valid(...PRICE_TYPE_VALUES).required(),
  supplierId: uuid.allow(null, ''),
  priceListId: uuid.allow(null, ''),
  groupName: Joi.string().trim().max(160).allow('', null),

  netPrice: money.min(0).allow(null),
  grossPrice: money.min(0).allow(null),
  vatRate: Joi.number().precision(2).min(0).max(100).allow(null),

  currency: Joi.string().trim().length(3).allow('', null),
  unit: Joi.string().trim().max(32).allow('', null),
  minQty: Joi.number().integer().min(1).default(1),
}).custom((value, helpers) => {
  if (value.type === 'purchase' && !String(value.supplierId || '').trim()) {
    return helpers.error('any.custom', { message: 'supplierId is required for purchase price' });
  }

  if (value.type === 'sale') {
    const hasPriceList = String(value.priceListId || '').trim().length > 0;
    const hasGroupName = String(value.groupName || '').trim().length > 0;
    if (!hasPriceList && !hasGroupName) {
      return helpers.error('any.custom', { message: 'priceListId or groupName is required for sale price' });
    }
  }

  const hasNet = Number.isFinite(value.netPrice);
  const hasGross = Number.isFinite(value.grossPrice);
  if (!hasNet && !hasGross) {
    return helpers.error('any.custom', { message: 'netPrice or grossPrice is required' });
  }

  return value;
}, 'price payload validation');

module.exports.updatePrice = Joi.object({
  supplierId: uuid.allow(null, ''),
  priceListId: uuid.allow(null, ''),
  groupName: Joi.string().trim().max(160).allow('', null),

  netPrice: money.min(0).allow(null),
  grossPrice: money.min(0).allow(null),
  vatRate: Joi.number().precision(2).min(0).max(100).allow(null),

  currency: Joi.string().trim().length(3).allow('', null),
  unit: Joi.string().trim().max(32).allow('', null),
  minQty: Joi.number().integer().min(1),
}).min(1);

module.exports.createSpecification = Joi.object({
  attributeId: uuid.allow(null, ''),
  key: Joi.string().trim().max(160).allow('', null),
  value: Joi.alternatives().try(
    Joi.string().allow('', null),
    Joi.number(),
    Joi.boolean()
  ).required(),
}).custom((value, helpers) => {
  const hasAttributeId = String(value.attributeId || '').trim().length > 0;
  const hasKey = String(value.key || '').trim().length > 0;

  if (!hasAttributeId && !hasKey) {
    return helpers.error('any.custom', { message: 'attributeId or key is required' });
  }

  return value;
}, 'specification payload validation');

module.exports.updateSpecification = Joi.object({
  attributeId: uuid.allow(null, ''),
  key: Joi.string().trim().max(160).allow('', null),
  value: Joi.alternatives().try(
    Joi.string().allow('', null),
    Joi.number(),
    Joi.boolean()
  ),
}).min(1);
