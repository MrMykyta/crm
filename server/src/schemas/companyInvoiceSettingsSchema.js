'use strict';

const { Joi } = require('./_common');
const {
  INVOICE_DEFAULT_TYPE_KEYS,
  INVOICE_PAYMENT_METHODS,
  INVOICE_PAYMENT_TERM_DAYS,
  INVOICE_CURRENCIES,
  INVOICE_STOCK_UPDATE_MODES,
  INVOICE_ANNOTATION_MODES,
} = require('../services/crm/invoiceSettingsConfig');

const MAX_TEMPLATE_HTML_LENGTH = 20000;

module.exports.update = Joi.object({
  invoiceDefaultType: Joi.string().valid(...INVOICE_DEFAULT_TYPE_KEYS),
  invoiceDefaultPaymentMethod: Joi.string().valid(...INVOICE_PAYMENT_METHODS),
  invoiceDefaultPaymentTermDays: Joi.number().integer().valid(...INVOICE_PAYMENT_TERM_DAYS),
  invoiceDefaultCurrency: Joi.string().uppercase().valid(...INVOICE_CURRENCIES),
  invoiceStockUpdateMode: Joi.string().valid(...INVOICE_STOCK_UPDATE_MODES),
  invoiceAnnotationMode: Joi.string().valid(...INVOICE_ANNOTATION_MODES),
  invoiceAnnotationTemplateHtml: Joi.alternatives().try(
    Joi.string().allow('').max(MAX_TEMPLATE_HTML_LENGTH),
    Joi.valid(null)
  ),
  invoiceTypes: Joi.array().items(
    Joi.object({
      typeKey: Joi.string().valid(...INVOICE_DEFAULT_TYPE_KEYS).required(),
      enabled: Joi.boolean().required(),
      numberingType: Joi.string().max(64),
      numberPattern: Joi.string().allow('').max(80),
    })
  ),
}).min(1);
