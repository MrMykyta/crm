const { Joi, uuid, paging } = require('./_common');

// Старайся, чтобы поля совпадали с твоей моделью User
const base = {
  email: Joi.string().email().max(254),
  password: Joi.string().min(6).max(100),
  firstName: Joi.string().max(100),
  lastName: Joi.string().max(100),
  companyId: uuid, // если при создании юзер сразу привязан к компании
  // role/locale/etc — добавишь при необходимости
};

module.exports.create = Joi.object({
  email: base.email.required(),
  password: base.password.required(),
  firstName: base.firstName.optional(),
  lastName: base.lastName.optional(),
  companyId: base.companyId.optional(),
});

module.exports.update = Joi.object({
  email: base.email.optional(),
  password: base.password.optional(),
  firstName: base.firstName.optional(),
  lastName: base.lastName.optional(),
  companyId: base.companyId.optional(),
}).min(1);

module.exports.listQuery = paging.keys({
  q: Joi.string().max(200),    // поиск по имени/почте (если реализуешь)
  companyId: uuid,
});
