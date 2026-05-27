'use strict';

const { Joi, uuid } = require('./_common');

const sortBy = Joi.string().valid(
  'createdAt',
  'updatedAt',
  'firstName',
  'lastName',
  'email',
  'phone',
  'position',
  'isMain'
);

const sortOrder = Joi.string().valid('ASC', 'DESC', 'asc', 'desc');

const base = {
  counterpartyId: uuid,
  firstName: Joi.string().trim().max(100),
  lastName: Joi.string().trim().max(100).allow('', null),
  email: Joi.string().trim().email().max(255).allow('', null),
  phone: Joi.string().trim().max(64).allow('', null),
  avatarUrl: Joi.alternatives().try(
    uuid,
    Joi.string().trim().uri({ scheme: ['http', 'https'] })
  ).allow('', null),
  position: Joi.string().trim().max(120).allow('', null),
  department: Joi.string().trim().max(120).allow('', null),
  note: Joi.string().trim().max(5000).allow('', null),
  isMain: Joi.boolean(),
};

module.exports.listQuery = Joi.object({
  companyId: Joi.forbidden(),
  search: Joi.string().trim().max(200).allow('', null),
  counterpartyId: base.counterpartyId.optional(),
  isMain: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(25),
  sortBy: sortBy.optional(),
  sortOrder: sortOrder.optional(),
  sort: sortBy.optional(),
  dir: sortOrder.optional(),
});

module.exports.byCounterpartyQuery = Joi.object({
  companyId: Joi.forbidden(),
  search: Joi.string().trim().max(200).allow('', null),
  isMain: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(25),
  sortBy: sortBy.optional(),
  sortOrder: sortOrder.optional(),
  sort: sortBy.optional(),
  dir: sortOrder.optional(),
});

module.exports.create = Joi.object({
  companyId: Joi.forbidden(),
  counterpartyId: base.counterpartyId.required(),
  firstName: base.firstName.required(),
  lastName: base.lastName.optional(),
  email: base.email.optional(),
  phone: base.phone.optional(),
  avatarUrl: base.avatarUrl.optional(),
  position: base.position.optional(),
  department: base.department.optional(),
  note: base.note.optional(),
  isMain: base.isMain.default(false),
});

module.exports.update = Joi.object({
  companyId: Joi.forbidden(),
  counterpartyId: base.counterpartyId.optional(),
  firstName: base.firstName.optional(),
  lastName: base.lastName.optional(),
  email: base.email.optional(),
  phone: base.phone.optional(),
  avatarUrl: base.avatarUrl.optional(),
  position: base.position.optional(),
  department: base.department.optional(),
  note: base.note.optional(),
  isMain: base.isMain.optional(),
}).min(1);
