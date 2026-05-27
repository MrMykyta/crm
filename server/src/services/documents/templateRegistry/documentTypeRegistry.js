const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const { loadJsonSchema } = require('../schema/loadSchema');

const DOC_TYPES_DIR = path.join(__dirname, 'docTypes');

function createValidator() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const schema = loadJsonSchema('documentType.schema.json');
  return {
    ajv,
    validate: ajv.compile(schema),
  };
}

function loadRegistry() {
  const registry = new Map();
  const { ajv, validate } = createValidator();

  const files = fs
    .readdirSync(DOC_TYPES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();

  for (const fileName of files) {
    const filePath = path.join(DOC_TYPES_DIR, fileName);
    const raw = fs.readFileSync(filePath, 'utf8');
    const schema = JSON.parse(raw);

    const isValid = validate(schema);
    if (!isValid) {
      const errorText = ajv.errorsText(validate.errors, { separator: '; ' });
      throw new Error(`Invalid document type definition in "${fileName}": ${errorText}`);
    }

    if (registry.has(schema.key)) {
      throw new Error(`Duplicate document type key in registry: "${schema.key}"`);
    }

    registry.set(schema.key, schema);
  }

  return registry;
}

const registry = loadRegistry();

function getDocumentType(key) {
  return registry.get(key) || null;
}

function hasDocumentType(key) {
  return registry.has(key);
}

function listDocumentTypes() {
  return Array.from(registry.values());
}

module.exports = {
  getDocumentType,
  hasDocumentType,
  listDocumentTypes,
};
