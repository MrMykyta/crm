import assert from 'node:assert/strict';

import {
  buildScopedInventoryQuery,
  filterInventoryRows,
  getInventoryLegacyRoute,
  getInventoryWorkspaceTab,
  getStockLevelStatus,
  hasLocations,
  normalizeBalanceRow,
} from './wmsInventoryWorkspaceModel.js';

assert.equal(getInventoryWorkspaceTab('moves'), 'moves');
assert.equal(getInventoryWorkspaceTab('unknown'), 'balances');

assert.equal(getInventoryLegacyRoute('stock-moves'), '/main/wms/inventory?tab=moves');
assert.equal(getInventoryLegacyRoute('lots'), '/main/wms/inventory?tab=lots');
assert.equal(getInventoryLegacyRoute('serials'), '/main/wms/inventory?tab=serials');
assert.equal(getInventoryLegacyRoute('reservations'), '/main/wms/inventory?tab=reservations');

const balance = normalizeBalanceRow({
  warehouseCode: 'M1',
  warehouseName: 'Main',
  productName: 'Screwdriver',
  productSku: 'SKU-1',
  variantName: 'PH2',
  onHand: '5',
  reserved: '2',
  available: '3',
});
assert.equal(balance.warehouseLabel, 'M1 - Main');
assert.equal(balance.productLabel, 'Screwdriver');
assert.equal(getStockLevelStatus(balance), 'reserved');
assert.equal(getStockLevelStatus({ onHand: -1, available: -1 }), 'negative');
assert.equal(getStockLevelStatus({ onHand: 3, reserved: 0, available: 3 }), 'active');

assert.deepEqual(buildScopedInventoryQuery({
  warehouseId: 'wh-1',
  productId: 'prod-1',
  variantId: 'var-1',
}, { sort: 'createdAt', dir: 'DESC' }), {
  page: 1,
  limit: 100,
  sort: 'createdAt',
  dir: 'DESC',
  warehouseId: 'wh-1',
  productId: 'prod-1',
  variantId: 'var-1',
});

assert.deepEqual(filterInventoryRows([
  { productName: 'Screwdriver', productSku: 'A-1' },
  { productName: 'Hammer', productSku: 'B-1' },
], 'screw', ['productName', 'productSku']).map((row) => row.productName), ['Screwdriver']);

assert.equal(hasLocations([]), false);
assert.equal(hasLocations([{ id: 'loc-1' }]), true);

console.log('WMS inventory workspace model smoke passed');
