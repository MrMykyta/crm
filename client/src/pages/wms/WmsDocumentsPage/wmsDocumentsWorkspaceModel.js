import {
  WMS_DOCUMENT_TYPES,
  getWmsDocumentCreateRoute,
} from '../navigation/wmsUiNavigation.js';

export const WMS_WORKFLOW_VIEWS = ['all', 'drafts', 'needs-action', 'posted-today'];
export const WMS_DOCUMENTS_COLUMNS_STORAGE_KEY = 'wms.documents.columns.v1';

export const WMS_DOCUMENTS_DEFAULT_COLUMNS = [
  { key: 'type', labelKey: 'wms.documents.columns.type', fallbackLabel: 'Type', width: 76, minWidth: 64, maxWidth: 120, category: 'core' },
  { key: 'number', labelKey: 'wms.documents.columns.number', fallbackLabel: 'Number', width: 240, minWidth: 160, maxWidth: 420, required: true, category: 'core' },
  { key: 'status', labelKey: 'wms.documents.columns.status', fallbackLabel: 'Status', width: 150, minWidth: 120, maxWidth: 240, category: 'core' },
  { key: 'date', labelKey: 'wms.documents.columns.date', fallbackLabel: 'Date', width: 130, minWidth: 110, maxWidth: 180, category: 'core' },
  { key: 'warehouse', labelKey: 'wms.documents.columns.warehouse', fallbackLabel: 'Warehouse', width: 180, minWidth: 130, maxWidth: 320, category: 'core' },
  { key: 'lines', labelKey: 'wms.documents.columns.itemsCount', fallbackLabel: 'Lines', width: 90, minWidth: 72, maxWidth: 140, numeric: true, category: 'core' },
  { key: 'quantity', labelKey: 'wms.documents.columns.totalQty', fallbackLabel: 'Quantity', width: 130, minWidth: 100, maxWidth: 220, numeric: true, category: 'core' },
  { key: 'createdAt', labelKey: 'wms.documents.columns.createdAt', fallbackLabel: 'Created', width: 130, minWidth: 110, maxWidth: 180, defaultVisible: false, category: 'operational' },
  { key: 'sourceWarehouse', labelKey: 'wms.documents.columns.sourceWarehouse', fallbackLabel: 'Source warehouse', width: 160, minWidth: 130, maxWidth: 280, defaultVisible: false, category: 'context', contextLabelKey: 'wms.documents.workspace.mmOnly', helperKey: 'wms.documents.workspace.mayBeEmpty' },
  { key: 'targetWarehouse', labelKey: 'wms.documents.columns.targetWarehouse', fallbackLabel: 'Target warehouse', width: 160, minWidth: 130, maxWidth: 280, defaultVisible: false, category: 'context', contextLabelKey: 'wms.documents.workspace.mmOnly', helperKey: 'wms.documents.workspace.mayBeEmpty' },
  { key: 'documentRelation', labelKey: 'wms.documents.columns.documentRelation', fallbackLabel: 'Relation', width: 120, minWidth: 100, maxWidth: 200, defaultVisible: false, category: 'context', contextLabelKey: 'wms.documents.workspace.correctionsOnly', helperKey: 'wms.documents.workspace.mayBeEmpty' },
  { key: 'documentId', labelKey: 'wms.documents.columns.technicalId', fallbackLabel: 'Technical ID', width: 240, minWidth: 180, maxWidth: 420, defaultVisible: false, category: 'technical', helperKey: 'wms.documents.workspace.technicalColumnHelp' },
  { key: 'parentDocumentId', labelKey: 'wms.documents.columns.parentTechnicalId', fallbackLabel: 'Parent technical ID', width: 240, minWidth: 180, maxWidth: 420, defaultVisible: false, category: 'technical', contextLabelKey: 'wms.documents.workspace.correctionsOnly', helperKey: 'wms.documents.workspace.technicalColumnHelp' },
  { key: 'correctedById', labelKey: 'wms.documents.columns.correctedByTechnicalId', fallbackLabel: 'Corrected by technical ID', width: 240, minWidth: 180, maxWidth: 420, defaultVisible: false, category: 'technical', contextLabelKey: 'wms.documents.workspace.correctionsOnly', helperKey: 'wms.documents.workspace.technicalColumnHelp' },
];

const CYCLE_COUNT_STATUS_FILTERS = new Set(['open', 'counting', 'reconciled']);

function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function lower(value) {
  return asText(value).toLowerCase();
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatQuantityNumber(value) {
  const number = asNumber(value);
  if (number === null) return '';
  return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(4)));
}

function pickUnitText(source = {}) {
  const candidates = [
    source.unit,
    source.uom,
    source.unitName,
    source.unitCode,
    source.product?.uom,
    source.variant?.uom,
    source.item?.uom,
  ];
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined || candidate === '') continue;
    if (typeof candidate === 'object') {
      const text = asText(candidate.symbol || candidate.code || candidate.name || candidate.label);
      if (text) return text;
      continue;
    }
    const text = asText(candidate);
    if (text) return text;
  }
  return '';
}

function pickQuantityValue(source = {}) {
  const fields = ['qty', 'quantity', 'qtyExpected', 'qtyReceived', 'qtyShipped', 'movedQty', 'qtyDelta', 'countedQty'];
  for (const field of fields) {
    const number = asNumber(source[field]);
    if (number !== null) return field === 'qtyDelta' ? Math.abs(number) : number;
  }
  return null;
}

function getQuantityLines(row = {}) {
  if (Array.isArray(row.quantityByUom)) return row.quantityByUom;
  if (Array.isArray(row.quantityGroups)) return row.quantityGroups;
  if (Array.isArray(row.items)) return row.items;
  if (Array.isArray(row.linesData)) return row.linesData;
  return [];
}

export function formatQuantityByUom(row = {}, maxGroups = 2) {
  // The current unified `/wms/documents` API returns aggregate `totalQty` only.
  // Keep this formatter ready for future grouped/line payloads without inventing UOM.
  const lines = getQuantityLines(row);
  if (!lines.length) {
    const fallback = asNumber(row.totalQty ?? row.quantity);
    return fallback === null ? '-' : formatQuantityNumber(fallback);
  }

  const groups = new Map();
  for (const line of lines) {
    const qty = pickQuantityValue(line);
    if (qty === null) continue;
    const unit = pickUnitText(line);
    const key = unit || '__no_unit__';
    const current = groups.get(key) || { unit, qty: 0 };
    current.qty += qty;
    groups.set(key, current);
  }

  const rendered = [...groups.values()]
    .filter((group) => group.qty !== 0)
    .map((group) => {
      const qty = formatQuantityNumber(group.qty);
      return group.unit ? `${qty} ${group.unit}` : qty;
    });

  if (!rendered.length) {
    const fallback = asNumber(row.totalQty ?? row.quantity);
    return fallback === null ? '-' : formatQuantityNumber(fallback);
  }

  if (rendered.length <= maxGroups) return rendered.join(' · ');
  return `${rendered.slice(0, maxGroups).join(' · ')} · +${rendered.length - maxGroups}`;
}

export function normalizeDocumentsColumnState(saved = {}, baseColumns = WMS_DOCUMENTS_DEFAULT_COLUMNS) {
  const base = Array.isArray(baseColumns) ? baseColumns : WMS_DOCUMENTS_DEFAULT_COLUMNS;
  const byKey = new Map(base.map((column) => [column.key, column]));
  const order = Array.isArray(saved?.order)
    ? saved.order.filter((key) => byKey.has(key))
    : [];
  const completeOrder = [
    ...order,
    ...base.map((column) => column.key).filter((key) => !order.includes(key)),
  ];
  const widths = saved?.widths && typeof saved.widths === 'object' ? saved.widths : {};
  const visibility = saved?.visibility && typeof saved.visibility === 'object' ? saved.visibility : {};

  return {
    order: completeOrder,
    widths: Object.fromEntries(base.map((column) => [
      column.key,
      clampNumber(widths[column.key], column.minWidth, column.maxWidth, column.width),
    ])),
    visibility: Object.fromEntries(base.map((column) => [
      column.key,
      column.required ? true : visibility[column.key] ?? column.defaultVisible !== false,
    ])),
  };
}

export function getDocumentsTableColumns(state = {}, baseColumns = WMS_DOCUMENTS_DEFAULT_COLUMNS) {
  const normalized = normalizeDocumentsColumnState(state, baseColumns);
  const byKey = new Map(baseColumns.map((column) => [column.key, column]));
  return normalized.order
    .map((key) => byKey.get(key))
    .filter(Boolean)
    .filter((column) => normalized.visibility[column.key] !== false)
    .map((column) => ({ ...column, width: normalized.widths[column.key] || column.width }));
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
  if (view === 'drafts') return { key: 'drafts', status: 'draft' };
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
  const warehouseId = asText(searchParams.get('warehouseId'));
  if (CYCLE_COUNT_STATUS_FILTERS.has(status)) {
    query.status = status;
  }
  if (warehouseId) query.warehouseId = warehouseId;
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
    createdAt: row.createdAt,
    documentId: row.id,
    warehouse: type === 'MM'
      ? [row.sourceWarehouseCode || row.sourceWarehouseId, row.targetWarehouseCode || row.targetWarehouseId].filter(Boolean).join(' -> ')
      : row.warehouseCode || row.warehouseId,
    sourceWarehouse: row.sourceWarehouseCode || row.sourceWarehouseId || '',
    targetWarehouse: row.targetWarehouseCode || row.targetWarehouseId || '',
    documentRelation: row.documentRelation || '',
    parentDocumentId: row.parentDocumentId || '',
    correctedById: row.correctedById || '',
    lines: row.itemsCount ?? 0,
    quantity: formatQuantityByUom(row),
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
    createdAt: row.createdAt,
    documentId: row.id,
    warehouse: row.warehouseCode || row.warehouseId,
    sourceWarehouse: '',
    targetWarehouse: '',
    documentRelation: '',
    parentDocumentId: '',
    correctedById: '',
    lines: row.itemsCount ?? items.length,
    quantity: formatQuantityByUom(row),
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
    row.sourceWarehouse,
    row.targetWarehouse,
    row.documentRelation,
    row.parentDocumentId,
    row.correctedById,
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
