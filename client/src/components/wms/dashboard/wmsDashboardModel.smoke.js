import assert from 'node:assert/strict';
import { buildWmsDashboardMetrics, hasWmsDashboardAlerts } from './wmsDashboardModel.js';

const now = new Date('2026-06-17T12:00:00Z');

const metrics = buildWmsDashboardMetrics({
  now,
  documents: [
    { type: 'PZ', status: 'draft', createdAt: '2026-06-10T09:00:00Z' },
    { type: 'PZ', status: 'received', createdAt: '2026-06-17T09:00:00Z' },
    { type: 'WZ', status: 'packing', createdAt: '2026-06-17T09:00:00Z' },
    { type: 'WZ', status: 'blocked', createdAt: '2026-06-17T09:00:00Z' },
    { type: 'MM', status: 'draft', createdAt: '2026-06-17T09:00:00Z' },
    { type: 'MM', status: 'in_transit', createdAt: '2026-06-17T09:00:00Z' },
    { type: 'RW', status: 'draft', createdAt: '2026-06-12T09:00:00Z' },
    { type: 'PW', status: 'posted', createdAt: '2026-06-17T09:00:00Z' },
  ],
  cycleCounts: [
    { status: 'counting', items: [{ qtyCounted: '5', systemQty: '4' }] },
    { status: 'reconciled', items: [{ qtyCounted: '4', systemQty: '4' }] },
  ],
  stockBalances: [
    { productId: 'sku-1', onHand: '5', available: '2', reorderPoint: '3' },
    { productId: 'sku-2', onHand: '-1', available: '-1' },
    { productId: 'sku-1', onHand: '4', available: '4' },
  ],
});

assert.equal(metrics.documents.pz.drafts, 1);
assert.equal(metrics.documents.pz.toReceive, 1);
assert.equal(metrics.documents.pz.late, 1);
assert.equal(metrics.documents.wz.packing, 1);
assert.equal(metrics.documents.wz.toShip, 1);
assert.equal(metrics.documents.wz.blocked, 1);
assert.equal(metrics.documents.mm.draft, 1);
assert.equal(metrics.documents.mm.inProgress, 1);
assert.equal(metrics.documents.adjustments.draft, 1);
assert.equal(metrics.documents.adjustments.postedToday, 1);
assert.equal(metrics.documents.cc.open, 1);
assert.equal(metrics.documents.cc.variances, 1);
assert.equal(metrics.inventory.totalSkus, 2);
assert.equal(metrics.inventory.totalRows, 3);
assert.equal(metrics.inventory.lowStock, 1);
assert.equal(metrics.inventory.negativeStock, 1);
assert.equal(metrics.alerts.stuckDrafts, 2);
assert.equal(hasWmsDashboardAlerts(metrics), true);

console.log('WMS dashboard metrics smoke passed');
