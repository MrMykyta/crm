const { Joi, uuid, paging } = require('./_common');

const item = Joi.object({
  productId: uuid.allow(null),
  name: Joi.string().min(1).max(256).required(),
  sku: Joi.string().allow('', null),
  qty: Joi.number().precision(3).min(0.001).required(),
  unit: Joi.string().valid('pcs','kg','hour','service').required(),
  priceNet: Joi.number().precision(2).min(0).required(),
  vatRate: Joi.number().precision(2).min(0).max(99.99).required(),
  discountPct: Joi.number().precision(2).min(0).max(99.99).default(0),
  position: Joi.number().integer().min(1)
});

module.exports.list = Joi.object({
  query: paging.keys({
    q: Joi.string().max(200).allow('', null),
    status: Joi.string().valid('new','confirmed','in_progress','fulfilled','cancelled').allow('', null),
    counterpartyId: uuid.allow(null)
  })
});

module.exports.create = Joi.object({
  body: Joi.object({
    number: Joi.string().allow('', null),
    status: Joi.string().valid('new','confirmed','in_progress','fulfilled','cancelled').default('new'),
    currency: Joi.string().length(3).default('PLN'),
    notes: Joi.string().allow('', null),
    counterpartyId: uuid.required(),
    offerId: uuid.allow(null),
    items: Joi.array().items(item).min(1).required()
  })
});

module.exports.update = Joi.object({
  body: Joi.object({
    status: Joi.string().valid('new','confirmed','in_progress','fulfilled','cancelled'),
    currency: Joi.string().length(3),
    notes: Joi.string().allow('', null),
    counterpartyId: uuid.allow(null),
    items: Joi.array().items(item).min(1)
  })
});
