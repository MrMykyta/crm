const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const BLOCKS_DIR = path.join(__dirname, 'blocks');
const BLOCK_SCHEMA_PATH = path.resolve(
  __dirname,
  '../../../../../',
  'shared',
  'template',
  'schema',
  'block.schema.json'
);

function loadSchema(schemaPath) {
  const raw = fs.readFileSync(schemaPath, 'utf8');
  return JSON.parse(raw);
}

function createValidator() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const schema = loadSchema(BLOCK_SCHEMA_PATH);
  return {
    ajv,
    validate: ajv.compile(schema),
  };
}

function loadRegistry() {
  const registry = new Map();
  const { ajv, validate } = createValidator();

  const files = fs
    .readdirSync(BLOCKS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();

  for (const fileName of files) {
    const filePath = path.join(BLOCKS_DIR, fileName);
    const raw = fs.readFileSync(filePath, 'utf8');
    const block = JSON.parse(raw);

    const isValid = validate(block);
    if (!isValid) {
      const errorText = ajv.errorsText(validate.errors, { separator: '; ' });
      throw new Error(`Invalid block definition in "${fileName}": ${errorText}`);
    }

    if (registry.has(block.type)) {
      throw new Error(`Duplicate block type in registry: "${block.type}"`);
    }

    registry.set(block.type, block);
  }

  return registry;
}

const registry = loadRegistry();

function getBlock(type) {
  return registry.get(type) || null;
}

function hasBlock(type) {
  return registry.has(type);
}

function listBlocks() {
  return Array.from(registry.values());
}

module.exports = {
  getBlock,
  hasBlock,
  listBlocks,
};
