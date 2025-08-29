const { Joi, uuid, paging } = require('./_common');

const base = {
  companyId: uuid,
  name: Joi.string().min(1).max(255),
  type: Joi.string().valid('person', 'company').default('company'),
  // Контактные данные вынесены в contact_points, поэтому здесь минимализм
  taxNumber: Joi.string().max(50), // если хранишь NIP/ИНН контрагента
  notes: Joi.string().max(2000),
};

module.exports.create = Joi.object({
  companyId: base.companyId.required(),
  name: base.name.required(),
  type: base.type.optional(),
  taxNumber: base.taxNumber.optional(),
  notes: base.notes.optional(),
});

module.exports.update = Joi.object({
  companyId: base.companyId.optional(),
  name: base.name.optional(),
  type: base.type.optional(),
  taxNumber: base.taxNumber.optional(),
  notes: base.notes.optional(),
}).min(1);

module.exports.listQuery = paging.keys({
  companyId: base.companyId,
  type: base.type,
  q: Joi.string().max(200), // поиск по имени
});
