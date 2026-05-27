const { Joi, uuid, dateISO, paging } = require('./_common');

const OFFER_STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'cancelled'];
const DISCOUNT_TYPES = ['none', 'fixed', 'percent'];

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

const headerSchema = Joi.object({
  number: Joi.string().max(128).allow('', null),
  status: Joi.string().valid(...OFFER_STATUSES),
  title: Joi.string().max(255).allow('', null),
  subject: Joi.string().max(255).allow('', null),
  issueDate: dateISO.optional(),
  validUntil: dateISO.allow(null),
  currency: Joi.string().length(3).uppercase().required(),
  exchangeRate: Joi.number().min(0).allow(null),
  sourceType: Joi.string().max(32).allow('', null),
  sourceId: uuid.allow(null),

  counterpartyId: uuid.required(),
  contactId: uuid.allow(null),
  ownerId: uuid.allow(null),
  dealId: uuid.allow(null),

  paymentTerms: Joi.string().allow('', null),
  deliveryTerms: Joi.string().allow('', null),
  leadTime: Joi.string().max(128).allow('', null),
  incoterms: Joi.string().max(64).allow('', null),
  notes: Joi.string().allow('', null),
  internalNotes: Joi.string().allow('', null),
  billingAddressSnapshot: Joi.object().unknown(true).allow(null),
  shippingAddressSnapshot: Joi.object().unknown(true).allow(null),
  meta: Joi.object().unknown(true).allow(null),
});

const updateHeaderSchema = Joi.object({
  number: Joi.forbidden(),
  status: Joi.forbidden(),
  title: Joi.string().max(255).allow('', null),
  subject: Joi.string().max(255).allow('', null),
  issueDate: dateISO.optional(),
  validUntil: dateISO.allow(null),
  currency: Joi.string().length(3).uppercase(),
  exchangeRate: Joi.number().min(0).allow(null),
  sourceType: Joi.string().max(32).allow('', null),
  sourceId: uuid.allow(null),

  counterpartyId: uuid,
  contactId: uuid.allow(null),
  ownerId: uuid.allow(null),
  dealId: uuid.allow(null),

  paymentTerms: Joi.string().allow('', null),
  deliveryTerms: Joi.string().allow('', null),
  leadTime: Joi.string().max(128).allow('', null),
  incoterms: Joi.string().max(64).allow('', null),
  notes: Joi.string().allow('', null),
  internalNotes: Joi.string().allow('', null),
  billingAddressSnapshot: Joi.object().unknown(true).allow(null),
  shippingAddressSnapshot: Joi.object().unknown(true).allow(null),
  meta: Joi.object().unknown(true).allow(null),
  items: Joi.array().items(itemSchema),
}).min(1);

function ensureValidDateRange(value, helpers) {
  const issueDate = value?.issueDate ? new Date(value.issueDate) : null;
  const validUntil = value?.validUntil ? new Date(value.validUntil) : null;
  if (issueDate && validUntil && validUntil < issueDate) {
    return helpers.error('any.invalid', {
      message: 'validUntil cannot be earlier than issueDate',
    });
  }
  return value;
}

module.exports.listQuery = paging.keys({
  sortBy: Joi.string().max(64),
  sortOrder: Joi.string().valid('ASC', 'DESC', 'asc', 'desc'),
  search: Joi.string().max(200).allow('', null),
  q: Joi.string().max(200).allow('', null),
  status: Joi.alternatives().try(
    Joi.string().max(200),
    Joi.array().items(Joi.string().valid(...OFFER_STATUSES))
  ),
  ownerId: uuid,
  counterpartyId: uuid,
  contactId: uuid,
  dealId: uuid,
  issueDateFrom: dateISO,
  issueDateTo: dateISO,
  validUntilFrom: dateISO,
  validUntilTo: dateISO,
  amountFrom: Joi.number().min(0),
  amountTo: Joi.number().min(0),
  converted: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false', '1', '0')),
});

module.exports.create = headerSchema
  .keys({
    items: Joi.array().items(itemSchema).default([]),
  })
  .custom(ensureValidDateRange)
  .messages({
    'any.invalid': '{{#message}}',
  });

module.exports.update = updateHeaderSchema
  .custom(ensureValidDateRange)
  .messages({
    'any.invalid': '{{#message}}',
  });

module.exports.saveItems = Joi.object({
  items: Joi.array().items(itemSchema).required(),
});

module.exports.actionPayload = Joi.object({
  internalNotesAppend: Joi.string().max(4000).allow('', null),
});

module.exports.duplicatePayload = Joi.object({
  number: Joi.string().max(128).allow('', null),
  issueDate: dateISO.optional(),
  title: Joi.string().max(255).allow('', null),
  subject: Joi.string().max(255).allow('', null),
});

module.exports.convertPayload = Joi.object({
  number: Joi.string().max(128).allow('', null),
  issueDate: dateISO.optional(),
  notes: Joi.string().allow('', null),
});
