'use strict';

const { Joi, uuid } = require('./_common');

module.exports.listQuery = Joi.object({
  q: Joi.string().trim().max(160).allow('', null),
  search: Joi.string().trim().max(160).allow('', null),
  isActive: Joi.boolean(),
  includeUsage: Joi.boolean().default(false),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25),
  sort: Joi.string().valid('createdAt', 'updatedAt', 'name').default('name'),
  dir: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('ASC'),
});

module.exports.create = Joi.object({
  companyId: Joi.forbidden(),
  name: Joi.string().trim().min(1).max(128).required(),
  description: Joi.string().allow('', null),
  isActive: Joi.boolean(),
});

module.exports.update = Joi.object({
  companyId: Joi.forbidden(),
  name: Joi.string().trim().min(1).max(128),
  description: Joi.string().allow('', null),
  isActive: Joi.boolean(),
}).min(1);

module.exports.remove = Joi.object({
  reassignToId: uuid.allow('', null),
  unassign: Joi.boolean().default(false),
});

module.exports.merge = Joi.object({
  targetId: uuid.required(),
});
