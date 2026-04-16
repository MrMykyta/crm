'use strict';

const Joi = require('joi');

const fileRefSchema = Joi.alternatives().try(
  Joi.string().trim().min(1),
  Joi.object({
    fileId: Joi.string().trim().min(1),
    id: Joi.string().trim().min(1),
  }).unknown(true)
);

const sendMessage = Joi.object({
  text: Joi.string().allow('').default(''),
  attachments: Joi.array().items(fileRefSchema).default([]),
  replyTo: Joi.string().trim().optional(),
  forwardFrom: Joi.string().trim().optional(),
  forwardBatchId: Joi.string().trim().optional(),
  forwardBatchSeq: Joi.number().integer().min(0).optional(),
}).custom((value, helpers) => {
  const hasText = Boolean(String(value.text || '').trim());
  const hasAttachments = Array.isArray(value.attachments) && value.attachments.length > 0;
  const hasForward = Boolean(value.forwardFrom);

  if (!hasText && !hasAttachments && !hasForward) {
    return helpers.error('any.invalid');
  }

  return value;
}, 'chat send payload validation').messages({
  'any.invalid': 'text, attachments or forwardFrom is required',
});

module.exports = {
  sendMessage,
};
