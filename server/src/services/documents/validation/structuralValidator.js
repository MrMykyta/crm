'use strict';

const Ajv = require('ajv');
const { loadJsonSchema } = require('../schema/loadSchema');

const ajv = new Ajv({ allErrors: true, strict: false });
const templateSchema = loadJsonSchema('template.schema.json');
const validateTemplateSchema = ajv.compile(templateSchema);

function validateStructural(templateDraft) {
  const isValid = validateTemplateSchema(templateDraft);
  if (isValid) {
    return [];
  }

  return (validateTemplateSchema.errors || []).map((err) => {
    const instancePath = err.instancePath || '/';
    return {
      severity: 'BLOCKING',
      code: 'TEMPLATE_SCHEMA_INVALID',
      message: `${instancePath} ${err.message || 'is invalid'}`.trim(),
      target: {
        fieldKey: instancePath,
      },
    };
  });
}

module.exports = {
  validateStructural,
};
