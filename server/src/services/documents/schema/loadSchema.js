'use strict';

const fs = require('fs');
const path = require('path');

function resolveSchemaPath(fileName) {
  const candidates = [
    path.resolve(__dirname, fileName),
    path.resolve(__dirname, '../../../../shared/template/schema', fileName),
    path.resolve(__dirname, '../../../../../shared/template/schema', fileName),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const error = new Error(`Schema file not found: ${fileName}`);
  error.code = 'SCHEMA_NOT_FOUND';
  error.candidates = candidates;
  throw error;
}

function loadJsonSchema(fileName) {
  const schemaPath = resolveSchemaPath(fileName);
  return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
}

module.exports = {
  loadJsonSchema,
  resolveSchemaPath,
};
