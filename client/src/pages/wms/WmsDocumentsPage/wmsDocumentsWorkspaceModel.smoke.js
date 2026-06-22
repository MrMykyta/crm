import assert from 'node:assert/strict';

import {
  buildDocumentsWorkspaceRows,
  formatQuantityByUom,
  getDocumentsTableColumns,
  getCycleCountsQuery,
  getDocumentsWorkspaceView,
  getWarehouseDocumentsQuery,
  normalizeDocumentsColumnState,
  shouldFetchCycleCounts,
  shouldFetchWarehouseDocuments,
} from './wmsDocumentsWorkspaceModel.js';

const params = new URLSearchParams('type=PZ&search=abc');
const pzView = getDocumentsWorkspaceView(params, new Date('2026-06-17T12:00:00Z'));
assert.equal(pzView.key, 'PZ');
assert.equal(pzView.createRoute, '/main/wms/receipts/new');
assert.equal(shouldFetchWarehouseDocuments(pzView), true);
assert.equal(shouldFetchCycleCounts(pzView), false);
assert.deepEqual(getWarehouseDocumentsQuery(pzView, params), {
  page: 1,
  limit: 100,
  sort: 'date',
  dir: 'DESC',
  search: 'abc',
  type: 'PZ',
});

const ccView = getDocumentsWorkspaceView(new URLSearchParams('type=CC'));
assert.equal(ccView.createRoute, '/main/wms/cycle-counts/new');
assert.equal(shouldFetchWarehouseDocuments(ccView), false);
assert.equal(shouldFetchCycleCounts(ccView), true);

const draftView = getDocumentsWorkspaceView(new URLSearchParams('status=draft'));
assert.equal(draftView.key, 'drafts');
assert.deepEqual(getCycleCountsQuery(draftView, new URLSearchParams('status=draft')), {
  page: 1,
  limit: 100,
  sort: 'createdAt',
  dir: 'DESC',
});

const countingView = getDocumentsWorkspaceView(new URLSearchParams('status=counting'));
assert.deepEqual(getCycleCountsQuery(countingView, new URLSearchParams('status=counting')), {
  page: 1,
  limit: 100,
  sort: 'createdAt',
  dir: 'DESC',
  status: 'counting',
});

const rows = buildDocumentsWorkspaceRows({
  view: getDocumentsWorkspaceView(new URLSearchParams('view=needs-action')),
  documents: [
    { id: 'wz-1', type: 'WZ', number: 'WZ/1', status: 'packing', createdAt: '2026-06-17T08:00:00Z' },
    { id: 'pz-1', type: 'PZ', number: 'PZ/1', status: 'received', createdAt: '2026-06-17T07:00:00Z' },
  ],
  cycleCounts: [
    { id: 'cc-1', status: 'counting', createdAt: '2026-06-17T09:00:00Z' },
  ],
  now: new Date('2026-06-17T12:00:00Z'),
});
assert.deepEqual(rows.map((row) => row.type), ['CC', 'WZ']);

const columnState = normalizeDocumentsColumnState({
  order: ['status', 'number', 'missing'],
  widths: { number: 9999, status: 80 },
  visibility: { warehouse: false, number: false },
});
assert.deepEqual(columnState.order.slice(0, 2), ['status', 'number']);
assert.equal(columnState.widths.number, 420);
assert.equal(columnState.widths.status, 120);
assert.equal(columnState.visibility.warehouse, false);
assert.equal(columnState.visibility.number, true);
assert.equal(getDocumentsTableColumns(columnState)[0].key, 'status');
assert.equal(getDocumentsTableColumns(columnState).some((column) => column.key === 'warehouse'), false);
assert.equal(getDocumentsTableColumns(columnState).some((column) => column.key === 'documentId'), false);

const legacyColumnState = normalizeDocumentsColumnState({ order: ['number'], widths: { type: 80 } });
assert.equal(legacyColumnState.visibility.type, true);
assert.equal(legacyColumnState.visibility.quantity, true);
assert.equal(legacyColumnState.visibility.documentId, false);
assert.equal(legacyColumnState.visibility.createdAt, false);

const allColumnsState = normalizeDocumentsColumnState({
  visibility: { documentId: true, createdAt: true, sourceWarehouse: true },
});
assert.equal(getDocumentsTableColumns(allColumnsState).some((column) => column.key === 'documentId'), true);
assert.equal(getDocumentsTableColumns(allColumnsState).some((column) => column.key === 'createdAt'), true);

assert.equal(formatQuantityByUom({ totalQty: 6 }), '6');
assert.equal(formatQuantityByUom({ totalQty: null }), '-');
assert.equal(formatQuantityByUom({
  items: [
    { qtyExpected: 2, unitCode: 'szt' },
    { qtyExpected: 3, unit: { symbol: 'kg' } },
  ],
}), '2 szt · 3 kg');
assert.equal(formatQuantityByUom({
  items: [
    { qty: 2, unitCode: 'szt' },
    { qty: 3, unitCode: 'kg' },
    { qty: 5, unitCode: 'm' },
    { qty: 1, unitCode: 'box' },
  ],
}), '2 szt · 3 kg · +2');
assert.equal(formatQuantityByUom({ items: [{ qtyDelta: -4 }, { qtyDelta: -2 }] }), '6');

console.log('WMS documents workspace model smoke passed');
