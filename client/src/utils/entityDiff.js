const DEFAULT_IGNORED_KEYS = new Set([
  'createdAt',
  'updatedAt',
  'deletedAt',
  'createdBy',
  'updatedBy',
  'createdById',
  'updatedById',
  'lastViewedAt',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeEntityValue(value, options = {}) {
  const ignoredKeys = options.ignoredKeys || DEFAULT_IGNORED_KEYS;
  if (value === undefined || value === null) return '';
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => normalizeEntityValue(item, options));
  if (isPlainObject(value)) {
    return Object.keys(value)
      .filter((key) => !ignoredKeys.has(key) && typeof value[key] !== 'function')
      .sort()
      .reduce((acc, key) => {
        acc[key] = normalizeEntityValue(value[key], options);
        return acc;
      }, {});
  }
  return value;
}

export function stableEntityStringify(value, options = {}) {
  return JSON.stringify(normalizeEntityValue(value, options));
}

export function isEntitySnapshotEqual(left, right, options = {}) {
  return stableEntityStringify(left, options) === stableEntityStringify(right, options);
}

export function getEntityDiff(initial = {}, current = {}, options = {}) {
  const fields = options.fields || Array.from(new Set([
    ...Object.keys(initial || {}),
    ...Object.keys(current || {}),
  ]));
  const diff = {};
  fields.forEach((field) => {
    const initialValue = initial?.[field];
    const currentValue = current?.[field];
    if (!isEntitySnapshotEqual(initialValue, currentValue, options)) {
      diff[field] = currentValue === undefined ? null : currentValue;
    }
  });
  return diff;
}

export function hasEntityDiff(initial = {}, current = {}, options = {}) {
  return Object.keys(getEntityDiff(initial, current, options)).length > 0;
}
