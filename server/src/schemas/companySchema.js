const { Joi, uuid, paging } = require('./_common');

const base = {
  name: Joi.string().min(2).max(200),
  legalName: Joi.string().max(255), // юр. название (если есть)
  taxNumber: Joi.string().max(50),  // NIP/ИНН — валидацию по формату можно добавить позже
  countryCode: Joi.string().uppercase().length(2), // ISO-2
  ownerUserId: uuid, // если есть владелец-компании пользователь
};

module.exports.create = Joi.object({
  name: base.name.required(),
  legalName: base.legalName.optional(),
  taxNumber: base.taxNumber.optional(),
  countryCode: base.countryCode.optional(),
  ownerUserId: base.ownerUserId.optional(),
});

module.exports.update = Joi.object({
  name: base.name.optional(),
  legalName: base.legalName.optional(),
  taxNumber: base.taxNumber.optional(),
  countryCode: base.countryCode.optional(),
  ownerUserId: base.ownerUserId.optional(),
}).min(1);

module.exports.listQuery = paging.keys({
  q: Joi.string().max(200),
  countryCode: base.countryCode,
});
