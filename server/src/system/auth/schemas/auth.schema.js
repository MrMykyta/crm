'use strict';

const Joi = require('joi');

const login = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(1).required(),
  companyId: Joi.string().uuid().allow(null, '').optional(),
});

const refresh = Joi.object({
  refreshToken: Joi.string().min(1).required(),
  companyId: Joi.string().uuid().allow(null, '').optional(),
});

module.exports = {
  login,
  refresh,
};
