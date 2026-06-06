const { Joi, uuid, dateISO, paging } = require('./_common');

const ORDER_STATUSES = [
  'draft',
  'new',
  'confirmed',
  'paid',
  'shipped',
  'completed',
  'cancelled',
  'returned',
];
const PAYMENT_STATUSES = ['pending', 'paid', 'refunded', 'partially_refunded'];
const FULFILLMENT_STATUSES = ['unfulfilled', 'partial', 'fulfilled'];
const DISCOUNT_TYPES = ['none', 'fixed', 'percent'];
const LINE_TYPES = ['product', 'service', 'custom', 'fee', 'discount'];

const itemSchema = Joi.object({
  id: uuid.optional(),
  sortOrder: Joi.number().integer().min(0).optional(),
  productId: uuid.allow(null),
  variantId: uuid.allow(null),
  unitId: uuid.allow(null),
  uomId: uuid.allow(null),
  nameSnapshot: Joi.string().max(512).allow('', null),
  name: Joi.string().max(512).allow('', null),
  skuSnapshot: Joi.string().max(128).allow('', null),
  sku: Joi.string().max(128).allow('', null),
  descriptionSnapshot: Joi.string().allow('', null),
  description: Joi.string().allow('', null),
  unitSnapshot: Joi.string().max(64).allow('', null),
  unit: Joi.string().max(64).allow('', null),
  vatRateSnapshot: Joi.number().min(0).max(999.9999).optional(),
  vatRate: Joi.number().min(0).max(999.9999).optional(),
  taxRate: Joi.number().min(0).max(999.9999).optional(),
  productTypeSnapshot: Joi.string().max(32).allow('', null),
  metadataSnapshot: Joi.object().unknown(true).allow(null),
  lineType: Joi.string().valid(...LINE_TYPES).optional(),
  affectsInventory: Joi.boolean().optional(),
  isStockTrackedSnapshot: Joi.boolean().optional(),
  taxCategoryId: uuid.allow(null),
  parentLineItemId: uuid.allow(null),
  quantity: Joi.number().greater(0).required(),
  qty: Joi.number().greater(0).optional(),
  unitPriceNet: Joi.number().min(0).required(),
  priceNet: Joi.number().min(0).optional(),
  discountType: Joi.string().valid(...DISCOUNT_TYPES).default('none'),
  discountValue: Joi.number().min(0).default(0),
  isCustomLine: Joi.boolean().optional(),
  notes: Joi.string().allow('', null),
})
  .custom((value, helpers) => {
    const hasProduct = Boolean(value.productId);
    const nameCandidate = String(value.nameSnapshot || value.name || '').trim();
    if (!hasProduct && !nameCandidate) {
      return helpers.error('any.invalid', {
        message: 'Custom line requires nameSnapshot or name',
      });
    }

    const discountType = String(value.discountType || 'none').toLowerCase();
    const discountValue = Number(value.discountValue || 0);
    if (discountType === 'percent' && discountValue > 100) {
      return helpers.error('any.invalid', {
        message: 'Percent discount must be in range 0..100',
      });
    }

    return value;
  })
  .messages({
    'any.invalid': '{{#message}}',
  });

const headerCreateSchema = Joi.object({
  number: Joi.string().max(128).allow('', null),
  status: Joi.string().valid('draft', 'new').default('draft'),

  customerId: uuid.optional(),
  counterpartyId: uuid.optional(),
  contactId: uuid.allow(null),
  ownerId: uuid.allow(null),
  offerId: uuid.allow(null),
  sourceOfferId: uuid.allow(null),
  sourceType: Joi.string().max(32).allow('', null),
  sourceId: uuid.allow(null),

  currencyCode: Joi.string().length(3).uppercase().optional(),
  currency: Joi.string().length(3).uppercase().optional(),
  placedAt: dateISO.optional(),
  issueDate: dateISO.optional(),
  paymentTerms: Joi.string().allow('', null),
  deliveryTerms: Joi.string().allow('', null),
  leadTime: Joi.string().max(128).allow('', null),
  notes: Joi.string().allow('', null),
  salesChannelId: uuid.allow(null),
  shippingClassId: uuid.allow(null),

  items: Joi.array().items(itemSchema).default([]),
})
  .custom((value, helpers) => {
    const customerId = value.customerId || value.counterpartyId;
    if (!customerId) {
      return helpers.error('any.invalid', {
        message: 'customerId or counterpartyId is required',
      });
    }
    if (!(value.currencyCode || value.currency)) {
      return helpers.error('any.invalid', {
        message: 'currencyCode or currency is required',
      });
    }
    return value;
  })
  .messages({
    'any.invalid': '{{#message}}',
  });

const headerUpdateSchema = Joi.object({
  number: Joi.forbidden(),
  status: Joi.forbidden(),

  customerId: uuid,
  counterpartyId: uuid,
  contactId: uuid.allow(null),
  ownerId: uuid.allow(null),
  offerId: uuid.allow(null),
  sourceOfferId: uuid.allow(null),
  sourceType: Joi.string().max(32).allow('', null),
  sourceId: uuid.allow(null),

  currencyCode: Joi.string().length(3).uppercase(),
  currency: Joi.string().length(3).uppercase(),
  placedAt: dateISO.optional(),
  issueDate: dateISO.optional(),
  paymentTerms: Joi.string().allow('', null),
  deliveryTerms: Joi.string().allow('', null),
  leadTime: Joi.string().max(128).allow('', null),
  notes: Joi.string().allow('', null),
  salesChannelId: uuid.allow(null),
  shippingClassId: uuid.allow(null),
  paymentStatus: Joi.string().valid(...PAYMENT_STATUSES),
  fulfillmentStatus: Joi.string().valid(...FULFILLMENT_STATUSES),

  items: Joi.array().items(itemSchema),
}).min(1);

module.exports.listQuery = paging.keys({
  sortBy: Joi.string().max(64),
  sortOrder: Joi.string().valid('ASC', 'DESC', 'asc', 'desc'),
  search: Joi.string().max(200).allow('', null),
  q: Joi.string().max(200).allow('', null),
  status: Joi.alternatives().try(
    Joi.string().max(200),
    Joi.array().items(Joi.string().valid(...ORDER_STATUSES))
  ),
  paymentStatus: Joi.alternatives().try(
    Joi.string().max(200),
    Joi.array().items(Joi.string().valid(...PAYMENT_STATUSES))
  ),
  fulfillmentStatus: Joi.alternatives().try(
    Joi.string().max(200),
    Joi.array().items(Joi.string().valid(...FULFILLMENT_STATUSES))
  ),
  counterpartyId: uuid,
  customerId: uuid,
  contactId: uuid,
  ownerId: uuid,
  sourceOfferId: uuid,
  hasInvoice: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false', '1', '0')),
  placedAtFrom: dateISO,
  placedAtTo: dateISO,
  amountFrom: Joi.number().min(0),
  amountTo: Joi.number().min(0),
});

module.exports.create = headerCreateSchema;
module.exports.update = headerUpdateSchema;

module.exports.saveItems = Joi.object({
  items: Joi.array().items(itemSchema).required(),
});

module.exports.actionPayload = Joi.object({
  internalNotesAppend: Joi.string().max(4000).allow('', null),
});

module.exports.fromOfferPayload = Joi.object({
  number: Joi.string().max(128).allow('', null),
  issueDate: dateISO.optional(),
  notes: Joi.string().allow('', null),
});

module.exports.convertPayload = Joi.object({
  number: Joi.string().max(128).allow('', null),
  issueDate: dateISO.optional(),
  notes: Joi.string().allow('', null),
  invoiceType: Joi.string().valid('INVOICE', 'PROFORMA', 'ADVANCE_INVOICE').default('INVOICE'),
});
