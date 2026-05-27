'use strict';

const Ajv = require('ajv');
const { loadJsonSchema } = require('../schema/loadSchema');

const ajv = new Ajv({ allErrors: true, strict: false });
const templateSchema = loadJsonSchema('template.schema.json');
const validateTemplateSchema = ajv.compile(templateSchema);

function normalizeInput(content) {
  if (typeof content === 'string') {
    return JSON.parse(content);
  }

  const isObject = content !== null && typeof content === 'object';
  if (isObject && Array.isArray(content) === false) {
    return JSON.parse(JSON.stringify(content));
  }

  throw new Error('Template version content must be a JSON object or JSON string.');
}

function migrateToCurrentSchema(content) {
  // Schema migrations are intentionally not implemented in M2.
  // This function is the future extension point for explicit version migrations.
  return content;
}

function assertValidTemplateVersionContent(content) {
  const isValid = validateTemplateSchema(content);
  if (isValid === false) {
    const errorText = ajv.errorsText(validateTemplateSchema.errors, { separator: '; ' });
    const error = new Error(`Invalid template version content: ${errorText}`);
    error.validationErrors = validateTemplateSchema.errors || [];
    throw error;
  }
}

function parseTemplateVersionContent(content) {
  const normalized = normalizeInput(content);
  const migrated = migrateToCurrentSchema(normalized);
  assertValidTemplateVersionContent(migrated);
  return migrated;
}

module.exports = {
  parseTemplateVersionContent,
  assertValidTemplateVersionContent,
};
