'use strict';

const Joi = require('joi');

const lookupQuery = Joi.object({
  country: Joi.string().trim().uppercase().required(),
  kind: Joi.string().trim().lowercase().required(),
  value: Joi.string().trim().required(),
  forceRefresh: Joi.boolean().truthy('true').falsy('false').default(false),
});

module.exports = {
  lookupQuery,
};
