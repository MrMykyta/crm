import assert from 'node:assert/strict';

import {
  buildDocumentsWorkspaceRows,
  getCycleCountsQuery,
  getDocumentsWorkspaceView,
  getWarehouseDocumentsQuery,
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

console.log('WMS documents workspace model smoke passed');
