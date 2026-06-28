const { Joi, uuid, paging } = require('./_common');

const pesel = Joi.string().trim().pattern(/^\d{11}$/).allow('', null);
const birthDate = Joi.date().iso().allow('', null);

const base = {
  companyId: uuid,
  name: Joi.string().min(1).max(255),
  type: Joi.string().valid('lead', 'client', 'partner', 'supplier', 'manufacturer').default('lead'),
  // Контактные данные вынесены в contact_points, поэтому здесь минимализм
  taxNumber: Joi.string().max(50), // если хранишь NIP/ИНН контрагента
  notes: Joi.string().max(2000),
  firstName: Joi.string().trim().max(100).allow('', null),
  lastName: Joi.string().trim().max(100).allow('', null),
  shortName: Joi.string().trim().max(200),
  fullName: Joi.string().trim().max(200).allow('', null),
  pesel,
  birthDate,
  isCompany: Joi.boolean(),
};

module.exports.create = Joi.object({
  companyId: base.companyId.optional(),
  name: base.name.optional(),
  shortName: base.shortName.required(),
  fullName: base.fullName.optional(),
  firstName: base.firstName.optional(),
  lastName: base.lastName.optional(),
  pesel: base.pesel.optional(),
  birthDate: base.birthDate.optional(),
  isCompany: base.isCompany.optional(),
  type: base.type.optional(),
  taxNumber: base.taxNumber.optional(),
  notes: base.notes.optional(),
}).unknown(true);

module.exports.update = Joi.object({
  companyId: base.companyId.optional(),
  name: base.name.optional(),
  shortName: base.shortName.optional(),
  fullName: base.fullName.optional(),
  firstName: base.firstName.optional(),
  lastName: base.lastName.optional(),
  pesel: base.pesel.optional(),
  birthDate: base.birthDate.optional(),
  isCompany: base.isCompany.optional(),
  type: base.type.optional(),
  taxNumber: base.taxNumber.optional(),
  notes: base.notes.optional(),
}).unknown(true).min(1);

module.exports.listQuery = paging.keys({
  companyId: base.companyId,
  type: base.type,
  q: Joi.string().max(200), // поиск по имени
});
