function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function getId(value) {
  if (!value) return '';
  if (typeof value === 'object') return asText(value.id);
  return asText(value);
}

function resolveEntity(value, byId) {
  if (value && typeof value === 'object') return value;
  const id = getId(value);
  return byId?.get?.(id) || null;
}

function joinParts(parts) {
  const clean = parts.map(asText).filter(Boolean);
  if (!clean.length) return '';
  return [...new Set(clean)].join(' — ');
}

export function buildLookupMap(rows = []) {
  const map = new Map();
  rows.forEach((row) => {
    const id = getId(row);
    if (id) map.set(id, row);
  });
  return map;
}

export function formatWarehouseLabel(warehouseOrId, warehousesById) {
  const warehouse = resolveEntity(warehouseOrId, warehousesById);
  if (!warehouse) return getId(warehouseOrId) || '—';
  return joinParts([warehouse.code, warehouse.name]) || getId(warehouseOrId) || '—';
}

export function formatLocationLabel(locationOrId, locationsById) {
  const location = resolveEntity(locationOrId, locationsById);
  if (!location) return getId(locationOrId) || '—';
  return joinParts([location.code, location.name || location.type]) || getId(locationOrId) || '—';
}

export function formatProductLabel(productOrId, productsById) {
  const product = resolveEntity(productOrId, productsById);
  if (!product) return getId(productOrId) || '—';
  return joinParts([product.sku || product.skuSnapshot, product.name || product.nameSnapshot || product.productName]) || getId(productOrId) || '—';
}

export function formatVariantLabel(variantOrId, variantsById) {
  const variant = resolveEntity(variantOrId, variantsById);
  if (!variant) return getId(variantOrId) || '—';
  return joinParts([variant.sku || variant.skuSnapshot, variant.name || variant.nameSnapshot]) || getId(variantOrId) || '—';
}

export function formatDocumentRelationLabel(docOrId) {
  if (docOrId && typeof docOrId === 'object') {
    return asText(docOrId.number) || getId(docOrId) || '—';
  }
  return getId(docOrId) || '—';
}

export function formatOrderLabel(orderOrId) {
  if (orderOrId && typeof orderOrId === 'object') {
    return asText(orderOrId.number) || getId(orderOrId) || '—';
  }
  return getId(orderOrId) || '—';
}
