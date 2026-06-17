const FINAL_STATUSES = new Set([
  'received',
  'shipped',
  'posted',
  'reconciled',
  'completed',
  'cancelled',
  'canceled',
  'closed',
]);

const CANCELLED_STATUSES = new Set(['cancelled', 'canceled']);
const PROGRESS_STATUSES = new Set(['packing', 'picking', 'in_progress', 'in-progress', 'in_transit', 'partial', 'partially_received', 'partial_received']);

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeStatus(value) {
  return asText(value).toLowerCase();
}

function asNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function getDocumentDate(row) {
  return row?.date || row?.documentDate || row?.createdAt || row?.updatedAt || '';
}

function isToday(value, now = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.toDateString() === now.toDateString();
}

function isOlderThanDays(value, days, now = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return now.getTime() - date.getTime() > days * 24 * 60 * 60 * 1000;
}

function typeOfDocument(row) {
  return asText(row?.type || row?.documentType).toUpperCase();
}

function statusOf(row) {
  return normalizeStatus(row?.status);
}

function isOpenStatus(status) {
  return Boolean(status) && !FINAL_STATUSES.has(status);
}

function countRows(rows, predicate) {
  return rows.reduce((count, row) => (predicate(row) ? count + 1 : count), 0);
}

function hasVariance(row) {
  const direct = asNumber(row?.variance || row?.difference || row?.diff);
  if (direct !== 0) return true;
  const items = asArray(row?.items);
  return items.some((item) => {
    const counted = asNumber(item?.qtyCounted || item?.countedQty);
    const system = asNumber(item?.systemQty || item?.qtySystem);
    return counted - system !== 0;
  });
}

function stockQty(row, key) {
  return asNumber(row?.[key]);
}

export function buildWmsDashboardMetrics({
  documents = [],
  cycleCounts = [],
  stockBalances = [],
  now = new Date(),
} = {}) {
  const docRows = asArray(documents);
  const cycleRows = asArray(cycleCounts);
  const stockRows = asArray(stockBalances);

  const pzRows = docRows.filter((row) => typeOfDocument(row) === 'PZ');
  const wzRows = docRows.filter((row) => typeOfDocument(row) === 'WZ');
  const mmRows = docRows.filter((row) => typeOfDocument(row) === 'MM');
  const adjustmentRows = docRows.filter((row) => ['RW', 'PW'].includes(typeOfDocument(row)));

  const openCounts = cycleRows.filter((row) => {
    const status = statusOf(row);
    return !CANCELLED_STATUSES.has(status) && status !== 'reconciled';
  });

  const productIds = new Set(
    stockRows
      .map((row) => asText(row?.productId || row?.product?.id || row?.productSku || row?.productName))
      .filter(Boolean)
  );

  const lowStockRows = stockRows.filter((row) => {
    const available = stockQty(row, 'available');
    const lowThreshold = row?.lowStockThreshold ?? row?.reorderPoint ?? row?.minQty ?? row?.minStock;
    if (lowThreshold === null || lowThreshold === undefined || lowThreshold === '') return false;
    return available <= asNumber(lowThreshold);
  });

  const negativeStockRows = stockRows.filter((row) => (
    stockQty(row, 'onHand') < 0 || stockQty(row, 'available') < 0
  ));

  const stuckDrafts = docRows.filter((row) => {
    const status = statusOf(row);
    return status === 'draft' && isOlderThanDays(getDocumentDate(row), 2, now);
  });

  return {
    documents: {
      pz: {
        drafts: countRows(pzRows, (row) => statusOf(row) === 'draft'),
        toReceive: countRows(pzRows, (row) => isOpenStatus(statusOf(row))),
        late: countRows(pzRows, (row) => isOpenStatus(statusOf(row)) && isOlderThanDays(getDocumentDate(row), 2, now)),
      },
      wz: {
        packing: countRows(wzRows, (row) => statusOf(row) === 'packing'),
        toShip: countRows(wzRows, (row) => ['packing', 'picking'].includes(statusOf(row))),
        blocked: countRows(wzRows, (row) => ['blocked', 'blocking'].includes(statusOf(row))),
      },
      mm: {
        draft: countRows(mmRows, (row) => statusOf(row) === 'draft'),
        inProgress: countRows(mmRows, (row) => PROGRESS_STATUSES.has(statusOf(row))),
      },
      adjustments: {
        draft: countRows(adjustmentRows, (row) => statusOf(row) === 'draft'),
        postedToday: countRows(adjustmentRows, (row) => statusOf(row) === 'posted' && isToday(getDocumentDate(row), now)),
      },
      cc: {
        open: openCounts.length,
        variances: openCounts.filter(hasVariance).length,
      },
    },
    inventory: {
      totalSkus: productIds.size,
      totalRows: stockRows.length,
      lowStock: lowStockRows.length,
      negativeStock: negativeStockRows.length,
    },
    alerts: {
      lowStock: lowStockRows.length,
      negativeStock: negativeStockRows.length,
      openCounts: openCounts.length,
      stuckDrafts: stuckDrafts.length,
    },
  };
}

export function hasWmsDashboardAlerts(metrics = {}) {
  const alerts = metrics.alerts || {};
  return ['lowStock', 'negativeStock', 'openCounts', 'stuckDrafts']
    .some((key) => Number(alerts[key] || 0) > 0);
}
