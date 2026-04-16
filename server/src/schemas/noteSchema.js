'use strict';

const { Joi, uuid, paging } = require('./_common');

const ownerType = Joi.string().valid(
  'counterparty',
  'deal',
  'task',
  'order',
  'offer',
  'product',
  'contact',
  'user',
  'company',
  'department'
);

const visibility = Joi.string().valid('private', 'company');

module.exports.listQuery = paging.keys({
  companyId: Joi.forbidden(),
  ownerType: ownerType.optional(),
  ownerId: uuid.optional(),
  search: Joi.string().max(1000).allow('', null),
  q: Joi.string().max(1000).allow('', null),
  visibility: visibility.optional(),
  pinned: Joi.boolean().optional(),
  sort: Joi.string()
    .valid('createdAt', 'updatedAt', 'pinned', 'created_at', 'updated_at')
    .optional(),
  dir: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').optional(),
});

module.exports.ownerLookupQuery = Joi.object({
  ownerType: ownerType.required(),
  search: Joi.string().max(200).allow('', null),
  limit: Joi.number().integer().min(1).max(50).default(20),
});

module.exports.create = Joi.object({
  companyId: Joi.forbidden(),
  ownerType: ownerType.required(),
  ownerId: uuid.required(),
  content: Joi.string().trim().min(1).max(10000).required(),
  visibility: visibility.default('company'),
  pinned: Joi.boolean().default(false),
});

module.exports.update = Joi.object({
  companyId: Joi.forbidden(),
  ownerType: ownerType.optional(),
  ownerId: uuid.optional(),
  content: Joi.string().trim().min(1).max(10000).optional(),
  visibility: visibility.optional(),
  pinned: Joi.boolean().optional(),
}).min(1);
