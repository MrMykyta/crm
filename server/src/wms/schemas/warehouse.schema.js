'use strict';

const Joi = require('joi');

const idParam = Joi.object({
  id: Joi.string().uuid().required(),
});

const listQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(20),
  sort: Joi.string().trim().optional(),
  q: Joi.string().trim().allow('').optional(),
  isActive: Joi.boolean().optional(),
});

const create = Joi.object({
  code: Joi.string().trim().max(32).required(),
  name: Joi.string().trim().max(160).required(),
  isActive: Joi.boolean().optional(),
  companyId: Joi.forbidden(),
});

const update = Joi.object({
  code: Joi.string().trim().max(32).optional(),
  name: Joi.string().trim().max(160).optional(),
  isActive: Joi.boolean().optional(),
  companyId: Joi.forbidden(),
}).min(1);

module.exports = {
  idParam,
  listQuery,
  create,
  update,
};
