/**
 * Returns the fieldsConfig entry for a single field key, or {} if absent.
 */
export function getFieldConfig(props, fieldKey) {
  if (!props || typeof props !== "object") return {};
  const cfg = props.fieldsConfig;
  if (!cfg || typeof cfg !== "object") return {};
  return cfg[fieldKey] || {};
}

/**
 * Is a field/column visible?
 *   - fieldsConfig[key].enabled === false → always hidden
 *   - fieldsConfig[key].enabled === true  → always visible
 *   - not set                             → fall back to legacyVisible
 */
export function isFieldEnabled(props, fieldKey, legacyVisible = true) {
  const cfg = getFieldConfig(props, fieldKey);
  if (cfg.enabled === false) return false;
  if (cfg.enabled === true) return true;
  return Boolean(legacyVisible);
}

/**
 * Returns the display label for a field.
 *   - fieldsConfig[key].label (non-empty) → custom label
 *   - otherwise → fallbackLabel
 */
export function getFieldLabel(props, fieldKey, fallbackLabel) {
  const cfg = getFieldConfig(props, fieldKey);
  if (typeof cfg.label === "string" && cfg.label.trim()) return cfg.label.trim();
  return fallbackLabel;
}

/**
 * Stable-sort an array of field/column descriptors by their configured order.
 * Each item must have a `.key` string property.
 * Items without an explicit order retain their original relative position.
 */
export function sortFieldsByConfig(fields, props) {
  if (!Array.isArray(fields) || fields.length === 0) return fields;
  const indexed = fields.map((f, i) => ({ f, i }));
  indexed.sort((a, b) => {
    const cfgA = getFieldConfig(props, a.f.key);
    const cfgB = getFieldConfig(props, b.f.key);
    const orderA = typeof cfgA.order === "number" ? cfgA.order : Infinity;
    const orderB = typeof cfgB.order === "number" ? cfgB.order : Infinity;
    return orderA !== orderB ? orderA - orderB : a.i - b.i;
  });
  return indexed.map(({ f }) => f);
}
