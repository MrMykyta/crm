import { WMS_INVENTORY_TABS, normalizeWmsTab } from '../navigation/wmsUiNavigation.js';

export const WMS_INVENTORY_DEFAULT_TAB = 'balances';

function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function lower(value) {
  return asText(value).toLowerCase();
}

export function getInventoryWorkspaceTab(value) {
  return normalizeWmsTab(value, WMS_INVENTORY_TABS, WMS_INVENTORY_DEFAULT_TAB);
}

export function getInventoryLegacyRoute(kind) {
  const normalized = lower(kind);
  if (normalized === 'stock-moves') return '/main/wms/inventory?tab=moves';
  if (normalized === 'reservations') return '/main/wms/inventory?tab=reservations';
  if (normalized === 'lots') return '/main/wms/inventory?tab=lots';
  if (normalized === 'serials') return '/main/wms/inventory?tab=serials';
  if (normalized === 'locations-stock') return '/main/wms/inventory?tab=locations';
  if (normalized === 'reports') return '/main/wms/inventory?tab=reports';
  return '/main/wms/inventory?tab=balances';
}

export function getWarehouseLabel(row = {}) {
  const code = asText(row.code || row.warehouseCode);
  const name = asText(row.name || row.warehouseName);
  if (code && name) return `${code} - ${name}`;
  return code || name || asText(row.id || row.warehouseId) || '-';
}

export function normalizeBalanceRow(row = {}) {
  return {
    ...row,
    productLabel: asText(row.productName || row.product?.name) || asText(row.productId) || '-',
    productSku: asText(row.productSku || row.product?.sku),
    variantLabel: asText(row.variantName || row.variant?.name || row.variantSku || row.variantId) || '-',
    warehouseLabel: getWarehouseLabel(row),
  };
}

export function getStockLevelStatus(row = {}) {
  const onHand = Number(row.onHand);
  const available = Number(row.available);
  const reserved = Number(row.reserved);
  if ((Number.isFinite(onHand) && onHand < 0) || (Number.isFinite(available) && available < 0)) return 'negative';
  if (Number.isFinite(available) && available === 0 && Number.isFinite(onHand) && onHand > 0) return 'reserved';
  if (Number.isFinite(reserved) && reserved > 0) return 'reserved';
  if (Number.isFinite(available) && available > 0) return 'active';
  return 'empty';
}

export function buildScopedInventoryQuery(row = {}, extra = {}) {
  const query = {
    page: 1,
    limit: 100,
    ...extra,
  };
  if (row.warehouseId) query.warehouseId = row.warehouseId;
  if (row.productId) query.productId = row.productId;
  if (row.variantId) query.variantId = row.variantId;
  return query;
}

export function filterInventoryRows(rows = [], search = '', fields = []) {
  const query = lower(search);
  const list = Array.isArray(rows) ? rows : [];
  if (!query) return list;
  return list.filter((row) => fields.some((field) => lower(row?.[field]).includes(query)));
}

export function hasLocations(rows = []) {
  return Array.isArray(rows) && rows.length > 0;
}
