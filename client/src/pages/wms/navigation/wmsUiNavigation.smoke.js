import assert from 'node:assert/strict';

import {
  WMS_DOCUMENT_TYPES,
  getWmsDocumentCreateRoute,
  getWmsDocumentsLegacyRoute,
  getWmsInventoryLegacyRoute,
  getWmsSetupLegacyRoute,
  normalizeWmsTab,
} from './wmsUiNavigation.js';

assert.deepEqual(WMS_DOCUMENT_TYPES, ['PZ', 'WZ', 'MM', 'RW', 'PW', 'CC']);

assert.equal(getWmsDocumentCreateRoute('PZ'), '/main/wms/receipts/new');
assert.equal(getWmsDocumentCreateRoute('WZ'), '/main/wms/shipments/new');
assert.equal(getWmsDocumentCreateRoute('MM'), '/main/wms/transfers/new');
assert.equal(getWmsDocumentCreateRoute('RW'), '/main/wms/adjustments/new?type=RW');
assert.equal(getWmsDocumentCreateRoute('PW'), '/main/wms/adjustments/new?type=PW');
assert.equal(getWmsDocumentCreateRoute('CC'), '/main/wms/cycle-counts/new');

assert.equal(getWmsDocumentsLegacyRoute('receipts'), '/main/wms/documents?type=PZ');
assert.equal(getWmsDocumentsLegacyRoute('shipments'), '/main/wms/documents?type=WZ');
assert.equal(getWmsDocumentsLegacyRoute('transfers'), '/main/wms/documents?type=MM');
assert.equal(getWmsDocumentsLegacyRoute('adjustments'), '/main/wms/documents?type=RW,PW');
assert.equal(getWmsDocumentsLegacyRoute('cycle-counts'), '/main/wms/documents?type=CC');

assert.equal(getWmsInventoryLegacyRoute('stock-moves'), '/main/wms/inventory?tab=moves');
assert.equal(getWmsInventoryLegacyRoute('reservations'), '/main/wms/inventory?tab=reservations');
assert.equal(getWmsInventoryLegacyRoute('lots'), '/main/wms/inventory?tab=lots');
assert.equal(getWmsInventoryLegacyRoute('serials'), '/main/wms/inventory?tab=serials');
assert.equal(getWmsSetupLegacyRoute('warehouses'), '/main/wms/setup?tab=warehouses');
assert.equal(getWmsSetupLegacyRoute('locations'), '/main/wms/setup?tab=locations');

assert.equal(normalizeWmsTab('lots', [{ key: 'lots' }], 'balances'), 'lots');
assert.equal(normalizeWmsTab('bad', [{ key: 'lots' }], 'balances'), 'balances');

console.log('WMS UI navigation smoke passed');
