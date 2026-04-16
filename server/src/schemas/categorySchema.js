'use strict';

const { Joi, uuid } = require('./_common');

module.exports.listQuery = Joi.object({
  q: Joi.string().trim().max(160).allow('', null),
  search: Joi.string().trim().max(160).allow('', null),
  parentId: Joi.alternatives().try(uuid, Joi.valid(null), Joi.valid('')),
  isActive: Joi.boolean(),
  includeUsage: Joi.boolean().default(false),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25),
  sort: Joi.string().valid('createdAt', 'updatedAt', 'name', 'sortOrder').default('name'),
  dir: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('ASC'),
});

module.exports.create = Joi.object({
  companyId: Joi.forbidden(),
  parentId: uuid.allow('', null),
  name: Joi.string().trim().min(1).max(160).required(),
  description: Joi.string().allow('', null),
  isActive: Joi.boolean(),
  sortOrder: Joi.number().integer().min(0).max(100000).default(0),
});

module.exports.update = Joi.object({
  companyId: Joi.forbidden(),
  parentId: uuid.allow('', null),
  name: Joi.string().trim().min(1).max(160),
  description: Joi.string().allow('', null),
  isActive: Joi.boolean(),
  sortOrder: Joi.number().integer().min(0).max(100000),
}).min(1);

module.exports.remove = Joi.object({
  reassignToId: uuid.allow('', null),
  unassign: Joi.boolean().default(false),
});

module.exports.merge = Joi.object({
  targetId: uuid.required(),
});
