const { Joi, uuid, paging } = require('./_common');

const status = Joi.string().valid('new', 'in_progress', 'won', 'lost');
const currency = Joi.string().max(8);

const base = {
  companyId: uuid,
  counterpartyId: uuid,
  title: Joi.string().min(1).max(256),
  description: Joi.string().allow('', null),
  status,
  value: Joi.number().precision(2).min(0).allow(null),
  currency,
  responsibleId: uuid.allow(null),
};

module.exports.create = Joi.object({
  companyId: Joi.forbidden(),
  counterpartyId: base.counterpartyId.required(),
  title: base.title.required(),
  description: base.description.optional(),
  status: base.status.default('new'),
  value: base.value.optional(),
  currency: base.currency.default('PLN'),
  responsibleId: base.responsibleId.optional(),
});

module.exports.update = Joi.object({
  companyId: Joi.forbidden(),
  counterpartyId: base.counterpartyId.optional(),
  title: base.title.optional(),
  description: base.description.optional(),
  status: base.status.optional(),
  value: base.value.optional(),
  currency: base.currency.optional(),
  responsibleId: base.responsibleId.optional(),
}).min(1);

module.exports.listQuery = paging.keys({
  companyId: Joi.forbidden(),
  counterpartyId: base.counterpartyId,
  responsibleId: base.responsibleId,
  status: base.status,
  q: Joi.string().max(200),
  dateFrom: Joi.date().iso(),
  dateTo: Joi.date().iso(),
});
