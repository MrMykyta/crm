function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function getWarehouseLocationRows(locations = [], warehouseId = '') {
  const rows = Array.isArray(locations) ? locations : [];
  const selectedWarehouseId = asText(warehouseId);
  if (!selectedWarehouseId) return rows;
  return rows.filter((row) => asText(row?.warehouseId) === selectedWarehouseId);
}

export function getWmsLocationMode({ locations = [], warehouseId = '', enabled } = {}) {
  if (enabled === false) return 'simple';
  return getWarehouseLocationRows(locations, warehouseId).length > 0 ? 'advanced' : 'simple';
}

export function isAdvancedLocationMode(mode = '') {
  return mode === 'advanced';
}

export function getWmsLocationModeLabel(mode = '') {
  return isAdvancedLocationMode(mode) ? 'Advanced Mode' : 'Simple Mode';
}

export function getWmsLocationModeDescription(mode = '') {
  return isAdvancedLocationMode(mode)
    ? 'Location management is active for this warehouse.'
    : 'Location management is disabled. Warehouse-level stock is used.';
}

export function isLocationFieldKey(key = '') {
  return [
    'locationId',
    'inboundLocationId',
    'sourceLocationId',
    'targetLocationId',
    'fromLocationId',
    'toLocationId',
    'putAwayLocationId',
  ].includes(String(key || ''));
}
