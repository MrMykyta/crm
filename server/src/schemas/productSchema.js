const { Joi, paging } = require('./_common');

module.exports.list = Joi.object({
  query: paging.keys({
    q: Joi.string().max(200).allow('', null)
  })
});

module.exports.create = Joi.object({
  body: Joi.object({
    sku: Joi.string().allow(null,''),
    name: Joi.string().min(1).max(256).required(),
    description: Joi.string().allow('', null),
    unit: Joi.string().valid('pcs','kg','hour','service').default('pcs'),
    priceNet: Joi.number().precision(2).min(0).default(0),
    currency: Joi.string().length(3).default('PLN'),
    vatRate: Joi.number().precision(2).min(0).max(99.99).default(23),
    isActive: Joi.boolean().default(true),
    trackStock: Joi.boolean().default(false),
  })
});

module.exports.update = Joi.object({
  body: Joi.object({
    sku: Joi.string().allow(null,''),
    name: Joi.string().min(1).max(256),
    description: Joi.string().allow('', null),
    unit: Joi.string().valid('pcs','kg','hour','service'),
    priceNet: Joi.number().precision(2).min(0),
    currency: Joi.string().length(3),
    vatRate: Joi.number().precision(2).min(0).max(99.99),
    isActive: Joi.boolean(),
    trackStock: Joi.boolean(),
  })
});
