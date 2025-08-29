const { Joi, uuid, paging } = require('./_common');

module.exports.list = Joi.object({
  query: paging.keys({
    ownerType: Joi.string().valid('counterparty','deal','task','order','offer','product','contact','user','company','department').allow('', null),
    ownerId: uuid.allow('', null),
    q: Joi.string().max(400).allow('', null)
  })
});

module.exports.create = Joi.object({
  body: Joi.object({
    ownerType: Joi.string().valid('counterparty','deal','task','order','offer','product','contact','user','company','department').required(),
    ownerId: uuid.required(),
    content: Joi.string().min(1).required(),
    visibility: Joi.string().valid('private','company').default('company'),
    pinned: Joi.boolean().default(false)
  })
});

module.exports.update = Joi.object({
  body: Joi.object({
    content: Joi.string().min(1),
    visibility: Joi.string().valid('private','company'),
    pinned: Joi.boolean()
  })
});
