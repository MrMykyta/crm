const { Joi, paging } = require('./_common');

module.exports.create = Joi.object({
  name: Joi.string().min(2).max(128).required(),
  description: Joi.string().max(256).allow('', null),
});

module.exports.update = Joi.object({
  name: Joi.string().min(2).max(128),
  description: Joi.string().max(256).allow('', null),
}).min(1);

module.exports.listQuery = paging.keys({
  q: Joi.string().max(200)
});
