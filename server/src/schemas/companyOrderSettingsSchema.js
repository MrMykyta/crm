'use strict';

const { Joi } = require('./_common');
const {
  ORDER_PRODUCT_RESERVATION_MODES,
  ORDER_ANNOTATION_MODES,
} = require('../services/crm/orderSettingsConfig');

const MAX_TEMPLATE_HTML_LENGTH = 20000;

module.exports.update = Joi.object({
  orderProductReservationMode: Joi.string()
    .valid(...ORDER_PRODUCT_RESERVATION_MODES),
  orderAnnotationMode: Joi.string()
    .valid(...ORDER_ANNOTATION_MODES),
  orderAnnotationTemplateHtml: Joi.alternatives().try(
    Joi.string().allow('').max(MAX_TEMPLATE_HTML_LENGTH),
    Joi.valid(null)
  ),
  orderNumbering: Joi.object({
    numberingType: Joi.string().valid('ORDER'),
    numberPattern: Joi.string().allow('').max(80).required(),
  }),
}).min(1);
