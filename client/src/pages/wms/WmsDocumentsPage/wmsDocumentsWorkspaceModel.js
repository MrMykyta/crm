import {
  WMS_DOCUMENT_TYPES,
  getWmsDocumentCreateRoute,
} from '../navigation/wmsUiNavigation.js';

export const WMS_WORKFLOW_VIEWS = ['all', 'drafts', 'needs-action', 'posted-today'];

const CYCLE_COUNT_STATUS_FILTERS = new Set(['open', 'counting', 'reconciled']);

function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function lower(value) {
  return asText(value).toLowerCase();
}

export function getTodayIso(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function getDocumentsWorkspaceView(searchParams, now = new Date()) {
  const type = asText(searchParams.get('type')).toUpperCase();
  if (WMS_DOCUMENT_TYPES.includes(type)) {
    return { key: type, type, createRoute: getWmsDocumentCreateRoute(type) };
  }

  const view = lower(searchParams.get('view'));
  const explicitStatus = lower(searchParams.get('status'));
  if (view === 'needs-action') return { key: 'needs-action', status: 'packing' };
  if (view === 'posted-today') {
    const today = getTodayIso(now);
    return { key: 'posted-today', dateFrom: today, dateTo: today };
  }
  if (explicitStatus === 'draft') return { key: 'drafts', status: 'draft', explicitStatus };
  return { key: 'all', explicitStatus: explicitStatus || undefined };
}

export function getWarehouseDocumentsQuery(view, searchParams) {
  const query = {
    page: 1,
    limit: 100,
    sort: 'date',
    dir: 'DESC',
  };
  const search = asText(searchParams.get('search') || searchParams.get('q'));
  const status = asText(searchParams.get('status') || view?.status);
  const warehouseId = asText(searchParams.get('warehouseId'));
  const dateFrom = asText(searchParams.get('dateFrom') || view?.dateFrom);
  const dateTo = asText(searchParams.get('dateTo') || view?.dateTo);
  if (search) query.search = search;
  if (status) query.status = status;
  if (warehouseId) query.warehouseId = warehouseId;
  if (dateFrom) query.dateFrom = dateFrom;
  if (dateTo) query.dateTo = dateTo;
  if (view?.type && view.type !== 'CC') query.type = view.type;
  return query;
}

export function getCycleCountsQuery(view, searchParams) {
  const query = {
    page: 1,
    limit: 100,
    sort: 'createdAt',
    dir: 'DESC',
  };
  const status = lower(searchParams.get('status') || view?.status);
  if (CYCLE_COUNT_STATUS_FILTERS.has(status)) {
    query.status = status;
  }
  return query;
}

export function shouldFetchCycleCounts(view) {
  return !view?.type || view.type === 'CC' || view.key === 'drafts' || view.key === 'needs-action' || view.key === 'posted-today';
}

export function shouldFetchWarehouseDocuments(view) {
  return view?.type !== 'CC';
}

export function normalizeWarehouseDocument(row = {}) {
  const type = asText(row.type).toUpperCase();
  return {
    id: row.id,
    source: 'document',
    type,
    number: row.number || row.id,
    date: row.date || row.createdAt,
    status: row.status,
    warehouse: type === 'MM'
      ? [row.sourceWarehouseCode || row.sourceWarehouseId, row.targetWarehouseCode || row.targetWarehouseId].filter(Boolean).join(' -> ')
      : row.warehouseCode || row.warehouseId,
    lines: row.itemsCount ?? 0,
    quantity: row.totalQty ?? '',
    route: row.route,
  };
}

export function normalizeCycleCount(row = {}) {
  const items = Array.isArray(row.items) ? row.items : [];
  return {
    id: row.id,
    source: 'cycle-count',
    type: 'CC',
    number: row.number || asText(row.id).slice(0, 8) || row.id,
    date: row.date || row.createdAt,
    status: row.status,
    warehouse: row.warehouseCode || row.warehouseId,
    lines: row.itemsCount ?? items.length,
    quantity: '',
    route: row.id ? `/main/wms/cycle-counts/${row.id}` : '',
  };
}

function isPostedToday(row, today) {
  const status = lower(row.status);
  const date = asText(row.date || row.createdAt).slice(0, 10);
  return date === today && ['posted', 'received', 'shipped', 'reconciled'].includes(status);
}

function matchesWorkflow(row, view, today) {
  if (view?.explicitStatus) return lower(row.status) === view.explicitStatus;
  if (!view || view.key === 'all') return true;
  const status = lower(row.status);
  if (view.key === 'drafts') return ['draft', 'planned'].includes(status);
  if (view.key === 'needs-action') return ['packing', 'counting'].includes(status);
  if (view.key === 'posted-today') return isPostedToday(row, today);
  return true;
}

function matchesSearch(row, search) {
  const query = lower(search);
  if (!query) return true;
  return [
    row.type,
    row.number,
    row.status,
    row.warehouse,
    row.id,
  ].some((value) => lower(value).includes(query));
}

export function buildDocumentsWorkspaceRows({
  documents = [],
  cycleCounts = [],
  view,
  search = '',
  now = new Date(),
}) {
  const today = getTodayIso(now);
  const rows = [
    ...documents.map(normalizeWarehouseDocument),
    ...cycleCounts.map(normalizeCycleCount),
  ].filter((row) => {
    if (view?.type && row.type !== view.type) return false;
    if (!matchesWorkflow(row, view, today)) return false;
    if (!matchesSearch(row, search)) return false;
    return true;
  });

  return rows.sort((a, b) => {
    const aTime = new Date(a.date || 0).getTime() || 0;
    const bTime = new Date(b.date || 0).getTime() || 0;
    return bTime - aTime;
  });
}
