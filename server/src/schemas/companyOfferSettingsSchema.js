'use strict';

const { Joi } = require('./_common');
const { OFFER_ANNOTATION_MODES } = require('../services/crm/offerSettingsConfig');

const MAX_TEMPLATE_HTML_LENGTH = 20000;

module.exports.update = Joi.object({
  offerAnnotationMode: Joi.string().valid(...OFFER_ANNOTATION_MODES),
  offerAnnotationTemplateHtml: Joi.alternatives().try(
    Joi.string().allow('').max(MAX_TEMPLATE_HTML_LENGTH),
    Joi.valid(null)
  ),
  offerNumbering: Joi.object({
    numberingType: Joi.string().valid('OFFER'),
    numberPattern: Joi.string().allow('').max(80).required(),
  }),
}).min(1);
