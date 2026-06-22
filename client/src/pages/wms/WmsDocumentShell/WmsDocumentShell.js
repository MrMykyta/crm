import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Maximize2, ScanLine, X } from 'lucide-react';
import ThemedSelect from '../../../components/inputs/RadixSelect';
import { WmsStatusChip } from '../../../components/wms/ui';
import RowControllerV0 from './RowControllerV0';
import { computeSummary } from './summaryEngine';
import { runValidationRules } from './validationEngine';
import {
  areDraftItemSnapshotsEqual,
  getPersistableRows,
  getQtyField,
  mapReceiptToShellDraft,
  normalizeRows as normalizePzRows,
} from './rowControllerModel';
import {
  getWmsLocationMode,
  getWmsLocationModeDescription,
  getWmsLocationModeLabel,
  isAdvancedLocationMode,
  isLocationFieldKey,
} from '../locationsMode';
import useScannerModule from './useScannerModule';
import './WmsDocumentShell.css';

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function asNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatWarehouseLabel(row) {
  if (!row) return '';
  return [asText(row.code), asText(row.name)].filter(Boolean).join(' - ') || asText(row.id);
}

function formatLocationLabel(row) {
  if (!row) return '';
  return [asText(row.code), asText(row.name)].filter(Boolean).join(' - ') || asText(row.id);
}

function normalizeInitialRows(rows, config, mode = '') {
  if (mode === 'posted' || mode === 'correction') return Array.isArray(rows) ? rows : [];
  return normalizePzRows(Array.isArray(rows) ? rows : [], config);
}

function getDocumentError(result) {
  const first = Array.isArray(result?.errors) ? result.errors[0] : null;
  return first?.message || first?.messageKey || '';
}

function getConfigHeaderFields(config = {}) {
  return Array.isArray(config?.header?.fields) ? config.header.fields : [];
}

function getShellHeaderKeys(config = {}) {
  return Array.isArray(config?.header?.shellFields) ? config.header.shellFields : null;
}

function isRowControllerEnabled(config = {}) {
  return config?.rowController?.enabled !== false;
}

function getShellHeaderFields(config = {}, mode = '') {
  const fields = getConfigHeaderFields(config);
  const shellKeys = getShellHeaderKeys(config);
  if (mode === 'posted' && config?.kindKey === 'receipt') {
    const postedKeys = ['warehouseId', 'inboundLocationId', 'counterpartyId', 'sourceRef', 'issueDate'];
    return fields.filter((field) => postedKeys.includes(field?.key));
  }
  if (mode === 'posted') return fields;
  if (shellKeys) return fields.filter((field) => shellKeys.includes(field?.key));
  const hasTransferWarehouses = fields.some((field) => field?.key === 'fromWarehouseId')
    && fields.some((field) => field?.key === 'toWarehouseId');
  const hasAdjustmentHeader = fields.some((field) => field?.key === 'documentType')
    && fields.some((field) => field?.key === 'reason');
  const supportedKeys = hasTransferWarehouses
    ? ['fromWarehouseId', 'toWarehouseId', 'sourceLocationId', 'targetLocationId', 'fromLocationId', 'toLocationId', 'issueDate']
    : hasAdjustmentHeader
      ? ['documentType', 'warehouseId', 'locationId', 'reason', 'issueDate']
    : ['warehouseId', 'inboundLocationId', 'issueDate'];
  return fields.filter((field) => supportedKeys.includes(field?.key));
}

function buildInitialHeader(config = {}, initialHeader = {}) {
  const next = {
    warehouseId: '',
    inboundLocationId: '',
    issueDate: '',
  };
  getConfigHeaderFields(config).forEach((field) => {
    if (field?.key) next[field.key] = field.fixedValue || '';
  });
  return { ...next, ...(initialHeader || {}) };
}

function isHeaderFieldRequired(field = {}, mode = '') {
  return Array.isArray(field.requiredFor) && field.requiredFor.includes(mode);
}

function translate(t, key, fallback, options) {
  return typeof t === 'function' && key ? t(key, fallback, options) : fallback;
}

function getHeaderFieldLabel(field = {}, mode = '', t) {
  const labels = {
    warehouseId: 'Warehouse',
    fromWarehouseId: 'From warehouse',
    toWarehouseId: 'To warehouse',
    inboundLocationId: 'Inbound location optional',
    sourceLocationId: 'Source location optional',
    targetLocationId: 'Target location optional',
    fromLocationId: 'Source location optional',
    toLocationId: 'Target location optional',
    documentType: 'Type',
    locationId: 'Location optional',
    reason: 'Reason',
    issueDate: 'Date',
  };
  const fallback = field.label || labels[field.key] || field.key;
  const base = field.labelKey ? translate(t, field.labelKey, fallback) : fallback;
  return isHeaderFieldRequired(field, mode)
    ? translate(t, 'wms.shell.requiredLabel', '{{label}} *', { label: base })
    : base;
}

function getHeaderFieldPlaceholder(field = {}, t) {
  const placeholders = {
    warehouseId: ['wms.shell.placeholders.selectWarehouse', 'Select warehouse'],
    fromWarehouseId: ['wms.shell.placeholders.selectSourceWarehouse', 'Select source warehouse'],
    toWarehouseId: ['wms.shell.placeholders.selectTargetWarehouse', 'Select target warehouse'],
    inboundLocationId: ['wms.shell.placeholders.warehouseLevelStock', 'Warehouse-level stock'],
    sourceLocationId: ['wms.shell.placeholders.sourceWarehouseLevelStock', 'Source warehouse-level stock'],
    targetLocationId: ['wms.shell.placeholders.targetWarehouseLevelStock', 'Target warehouse-level stock'],
    fromLocationId: ['wms.shell.placeholders.sourceWarehouseLevelStock', 'Source warehouse-level stock'],
    toLocationId: ['wms.shell.placeholders.targetWarehouseLevelStock', 'Target warehouse-level stock'],
    locationId: ['wms.shell.placeholders.warehouseLevelStock', 'Warehouse-level stock'],
    reason: ['wms.shell.placeholders.enterReason', 'Enter reason'],
  };
  const entry = placeholders[field.key];
  return entry ? translate(t, entry[0], entry[1]) : '';
}

function getLocationWarehouseId(fieldKey = '', header = {}) {
  if (fieldKey === 'sourceLocationId' || fieldKey === 'fromLocationId') return header.fromWarehouseId || '';
  if (fieldKey === 'targetLocationId' || fieldKey === 'toLocationId') return header.toWarehouseId || '';
  return header.warehouseId || '';
}

function getHeaderLocationMode(header = {}, locations = []) {
  const warehouseIds = [
    header.warehouseId,
    header.fromWarehouseId,
    header.toWarehouseId,
  ].map(asText).filter(Boolean);

  if (!warehouseIds.length) {
    return getWmsLocationMode({ locations });
  }

  return warehouseIds.some((warehouseId) => isAdvancedLocationMode(getWmsLocationMode({ locations, warehouseId })))
    ? 'advanced'
    : 'simple';
}

function getDeferredActionLabel(config = {}, t) {
  if (config.kindKey === 'cycleCount') return translate(t, 'wms.shell.deferred.reconcile', 'Reconcile deferred');
  if (config.kindKey === 'transfer') return translate(t, 'wms.shell.deferred.execute', 'Execute deferred');
  if (config.kindKey === 'shipment') return translate(t, 'wms.shell.deferred.ship', 'Ship deferred');
  if (config.kindKey === 'adjustment') return translate(t, 'wms.shell.deferred.post', 'Post deferred');
  return translate(t, 'wms.shell.deferred.receive', 'Receive deferred');
}

function getOperationLabel(mode = '', t) {
  if (mode === 'reconcile') return translate(t, 'wms.shell.operations.reconcile.label', 'Reconcile');
  if (mode === 'post') return translate(t, 'wms.shell.operations.post.label', 'Post');
  if (mode === 'execute') return translate(t, 'wms.shell.operations.execute.label', 'Execute all');
  if (mode === 'ship') return translate(t, 'wms.shell.operations.ship.label', 'Ship all');
  return translate(t, 'wms.shell.operations.receive.label', 'Receive all');
}

function getOperationProgressLabel(mode = '', t) {
  if (mode === 'reconcile') return translate(t, 'wms.shell.operations.reconcile.progress', 'Reconciling...');
  if (mode === 'post') return translate(t, 'wms.shell.operations.post.progress', 'Posting...');
  if (mode === 'execute') return translate(t, 'wms.shell.operations.execute.progress', 'Executing...');
  if (mode === 'ship') return translate(t, 'wms.shell.operations.ship.progress', 'Shipping...');
  return translate(t, 'wms.shell.operations.receive.progress', 'Receiving...');
}

function getOperationAction(mode = '') {
  if (mode === 'reconcile') return 'reconcileExisting';
  if (mode === 'post') return 'postExisting';
  if (mode === 'execute') return 'executeExisting';
  if (mode === 'ship') return 'shipExisting';
  return 'receiveExisting';
}

function getOperationErrorMessage(mode = '', t) {
  if (mode === 'reconcile') return translate(t, 'wms.shell.operations.reconcile.error', 'Failed to reconcile cycle count.');
  if (mode === 'post') return translate(t, 'wms.shell.operations.post.error', 'Failed to post adjustment.');
  if (mode === 'execute') return translate(t, 'wms.shell.operations.execute.error', 'Failed to execute transfer.');
  if (mode === 'ship') return translate(t, 'wms.shell.operations.ship.error', 'Failed to ship shipment.');
  return translate(t, 'wms.shell.operations.receive.error', 'Failed to receive receipt.');
}

function getOperationEmptyMessage(mode = '', t) {
  if (mode === 'execute') return translate(t, 'wms.shell.operations.execute.empty', 'No remaining rows to execute.');
  if (mode === 'ship') return translate(t, 'wms.shell.operations.ship.empty', 'No remaining rows to ship.');
  return translate(t, 'wms.shell.operations.receive.empty', 'No remaining rows to receive.');
}

function getOperationNotice(mode = '', t) {
  if (mode === 'reconcile') return translate(t, 'wms.shell.operations.reconcile.notice', 'Cycle count was reconciled. Opening the latest document view...');
  if (mode === 'post') return translate(t, 'wms.shell.operations.post.notice', 'Adjustment was posted. Opening the latest document view...');
  if (mode === 'execute') return translate(t, 'wms.shell.operations.execute.notice', 'Transfer was executed. Opening the latest document view...');
  if (mode === 'ship') return translate(t, 'wms.shell.operations.ship.notice', 'Shipment was shipped. Opening the latest document view...');
  return translate(t, 'wms.shell.operations.receive.notice', 'Receipt was received. Opening the latest document view...');
}

function getModeTitle(mode = '', t) {
  if (mode === 'draft') return translate(t, 'wms.shell.modes.draft', 'draft');
  if (mode === 'posted') return translate(t, 'wms.shell.modes.posted', 'posted');
  if (mode === 'correction') return translate(t, 'wms.shell.modes.correction', 'correction');
  if (mode === 'reconcile') return translate(t, 'wms.shell.modes.reconcile', 'reconcile');
  if (mode === 'post') return translate(t, 'wms.shell.modes.post', 'post');
  if (mode === 'ship') return translate(t, 'wms.shell.modes.ship', 'ship');
  if (mode === 'execute') return translate(t, 'wms.shell.modes.execute', 'execute');
  return translate(t, 'wms.shell.modes.create', 'create');
}

function getModeSubtitle(mode = '', badge = '', t) {
  const options = { badge };
  if (mode === 'draft') return translate(t, 'wms.shell.subtitles.draft', 'WMS Shell MVP - {{badge}} draft edit', options);
  if (mode === 'posted') return translate(t, 'wms.shell.subtitles.posted', 'WMS Shell - {{badge}} posted read-only view', options);
  if (mode === 'correction') return translate(t, 'wms.shell.subtitles.correction', 'WMS Shell - {{badge}} correction', options);
  if (mode === 'reconcile') return translate(t, 'wms.shell.subtitles.reconcile', 'WMS Shell MVP - {{badge}} reconcile existing', options);
  if (mode === 'post') return translate(t, 'wms.shell.subtitles.post', 'WMS Shell MVP - {{badge}} post existing', options);
  if (mode === 'ship') return translate(t, 'wms.shell.subtitles.ship', 'WMS Shell MVP - {{badge}} ship existing', options);
  if (mode === 'execute') return translate(t, 'wms.shell.subtitles.execute', 'WMS Shell MVP - {{badge}} execute existing', options);
  return translate(t, 'wms.shell.subtitles.create', 'WMS Shell MVP - {{badge}} create only', options);
}

function isOperationMode(mode = '') {
  return mode === 'draft' || mode === 'post' || mode === 'reconcile' || mode === 'ship' || mode === 'execute';
}

function isDocumentOperationMode(mode = '') {
  return mode === 'post' || mode === 'reconcile';
}

function getCorrectionQty(row = {}, config = {}) {
  if (config?.kindKey === 'receipt') {
    return asNumber(row.qtyReceived ?? row.qty ?? row[getQtyField(config)], 0);
  }
  return asNumber(row.qty ?? row.qtyShipped ?? row[getQtyField(config)], 0);
}

function getScanStatus(scanner = {}, feedback = {}) {
  if (scanner.isScanning) return 'scanning';
  if (scanner.scanError) return 'unknown';
  if (Array.isArray(scanner.scanResults) && scanner.scanResults.length) return 'multiple';
  if (scanner.scanQuery) return 'ready';
  if (feedback.status === 'found') return 'found';
  if (feedback.status === 'unknown') return 'unknown';
  if (feedback.status === 'multiple') return 'multiple';
  return 'ready';
}

function getScanStatusLabel(status = '', t) {
  if (status === 'scanning') return translate(t, 'wms.shell.scanner.status.scanning', 'Scanning');
  if (status === 'found') return translate(t, 'wms.shell.scanner.status.found', 'Found');
  if (status === 'multiple') return translate(t, 'wms.shell.scanner.status.multiple', 'Multiple');
  if (status === 'unknown') return translate(t, 'wms.shell.scanner.status.unknown', 'Unknown');
  return translate(t, 'wms.shell.scanner.status.ready', 'Ready');
}

function getScanChipStatus(status = '') {
  if (status === 'scanning') return 'counting';
  if (status === 'found') return 'active';
  if (status === 'multiple') return 'warning';
  if (status === 'unknown') return 'error';
  return 'draft';
}

function getDocumentScanLabel(config = {}, mode = '', documentId = '') {
  const badge = config.badge || config.type || 'WMS';
  const suffix = documentId ? documentId.slice(0, 8) : getModeTitle(mode);
  return `${badge}-${suffix}`;
}

function getRemainingQty(row = {}, mode = '', qtyField = 'qty') {
  if (mode === 'execute') return asNumber(row[qtyField], 0) - asNumber(row.movedQty, 0);
  if (mode === 'ship') return asNumber(row[qtyField], 0) - asNumber(row.qtyShipped, 0);
  return asNumber(row[qtyField], 0) - asNumber(row.qtyReceived, 0);
}

function getMoveQty(move = {}) {
  return move.qty ?? move.quantity ?? move.qtyDelta ?? move.delta ?? '';
}

function getProductTitle(row = {}, fallback = '') {
  return asText(row.productName || row.pickerProductName || row.nameSnapshot || row.product?.name || fallback);
}

function getProductCode(row = {}) {
  return asText(row.sku || row.variantSku || row.product?.sku || row.variant?.sku);
}

function getLocationDisplay(row = {}, key = 'locationId') {
  return asText(
    row[`${key}Label`]
    || row[`${key}Name`]
    || row[`${key}Code`]
    || row.location?.label
    || row.location?.code
    || row.location?.name
    || row[key]
  );
}

function formatMoney(value, currency = '') {
  const number = asNumber(value, null);
  if (number === null) return asText(value) || '—';
  const suffix = asText(currency);
  return `${number.toFixed(2)}${suffix ? ` ${suffix}` : ''}`;
}

function formatQtyValue(value) {
  const text = asText(value);
  if (!text) return '—';
  return text;
}

function hasPostedValue(value) {
  const text = asText(value);
  return Boolean(text) && text !== '—';
}

function getPostedStatusLabel(status = '') {
  const value = asText(status);
  if (!value) return '';
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function shouldShowPostedHeaderField(field = {}, header = {}) {
  const key = field?.key || '';
  const raw = asText(header[key]);
  if (isLocationFieldKey(key)) return Boolean(raw);
  if (['counterpartyId', 'sourceRef', 'orderId', 'reason', 'notes', 'createdAt', 'issueDate', 'documentType', 'status'].includes(key)) {
    return hasPostedValue(raw);
  }
  return true;
}

function getReadonlyHeaderValue(field = {}, value = '', context = {}) {
  const { t, warehouseOptions = [], locations = [] } = context;
  const raw = asText(value);
  if (field.type === 'warehouseSelect') {
    return warehouseOptions.find((option) => option.value && option.value === raw)?.label || raw || '—';
  }
  if (field.type === 'locationSelect') {
    const location = locations.find((row) => row.id === raw);
    return location ? formatLocationLabel(location) : (raw || translate(t, 'wms.shell.placeholders.warehouseLevelStock', 'Warehouse-level stock'));
  }
  if (field.type === 'date') return raw || '—';
  return raw || '—';
}

export default function WmsDocumentShell({
  config,
  mode = 'create',
  documentId,
  adapter,
  initialHeader,
  initialRows,
  originalHeader,
  originalRows,
  resetKey,
  warehouses = [],
  locations = [],
  searchProducts,
  getOperationConfirm,
  postedMeta = {},
  printUrl,
  sourceUrl,
  correctionUrl,
  stockMoves = [],
  postedExtraSections = null,
  onSaveSuccess,
  onCancel,
}) {
  const { t } = useTranslation();
  const [header, setHeader] = useState(() => buildInitialHeader(config, initialHeader));
  const qtyField = getQtyField(config);
  const isPostedMode = mode === 'posted';
  const headerFields = useMemo(() => getShellHeaderFields(config, mode), [config, mode]);
  const rowControllerEnabled = useMemo(() => isRowControllerEnabled(config), [config]);
  const [rows, setRows] = useState(() => normalizeInitialRows(initialRows, config, mode));
  const [baselineHeader, setBaselineHeader] = useState(() => ({ ...(originalHeader || initialHeader || {}) }));
  const [baselineRows, setBaselineRows] = useState(() => normalizeInitialRows(originalRows || initialRows, config, mode));
  const [removedItemIds, setRemovedItemIds] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [rowErrors, setRowErrors] = useState({});
  const [rowWarnings, setRowWarnings] = useState({});
  const [documentError, setDocumentError] = useState('');
  const [documentNotice, setDocumentNotice] = useState('');
  const [operationConfirm, setOperationConfirm] = useState(null);
  const [correctionConfirm, setCorrectionConfirm] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');
  const [selectedCorrectionIds, setSelectedCorrectionIds] = useState([]);
  const [scanModeOpen, setScanModeOpen] = useState(false);
  const [scanFeedback, setScanFeedback] = useState({ status: 'ready', at: 0 });
  const [recentScans, setRecentScans] = useState([]);
  const [isSaving, setSaving] = useState(false);
  const [isReceiving, setReceiving] = useState(false);
  const rowControllerRef = useRef(null);
  const isCorrectionMode = mode === 'correction';
  const isReadonlyHeaderMode = isPostedMode || isCorrectionMode;
  const scannerEnabled = rowControllerEnabled
    && (mode === 'create' || mode === 'draft')
    && typeof searchProducts === 'function';
  const scannerRowApi = useMemo(() => ({
    addOrFillFromProductPicker: (row) => rowControllerRef.current?.addOrFillFromProductPicker?.(row),
    focusQty: (localId) => rowControllerRef.current?.focusQty?.(localId),
    focusFirstEmptyProduct: () => rowControllerRef.current?.focusFirstEmptyProduct?.(),
  }), []);
  const onScanFeedback = useCallback((feedback = {}) => {
    const status = feedback.status || 'ready';
    const query = asText(feedback.query);
    const title = feedback.title || feedback.message || query || getScanStatusLabel(status, t);
    const meta = feedback.meta || (feedback.count ? translate(t, 'wms.shell.scanner.matchesCount', '{{count}} matches', { count: feedback.count }) : '');
    const next = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status,
      query,
      title,
      meta,
      at: Date.now(),
    };
    setScanFeedback(next);
    setRecentScans((prev) => [next, ...prev].slice(0, 6));
  }, [t]);
  const scanner = useScannerModule({
    config,
    enabled: scannerEnabled,
    onScanFeedback,
    queryProductPicker: searchProducts,
    rowApi: scannerRowApi,
    resetKey,
  });
  const scanStatus = getScanStatus(scanner, scanFeedback);
  const scanDocumentLabel = getDocumentScanLabel(config, mode, documentId);
  const rowControllerLabels = useMemo(() => ({
    addLine: t('wms.create.addLine', 'Add line'),
    emptyRow: t('wms.shell.rows.emptyRow', 'New row'),
    lines: t('wms.shell.rows.lines', 'Lines'),
    manualRows: t('wms.shell.rows.manualRows', 'Manual rows'),
    noProducts: t('wms.shell.product.noProducts', 'No products found'),
    noSku: t('wms.shell.product.noSku', 'No SKU'),
    persistedRow: t('wms.shell.rows.persistedRow', 'Saved'),
    productHint: t('wms.shell.product.placeholder', 'Start typing product / SKU / EAN'),
    readyRow: t('wms.shell.rows.readyRow', 'Ready'),
    removeRow: t('wms.shell.rows.removeRow', 'Remove row'),
    searchFailed: t('wms.shell.product.searchFailed', 'Search failed'),
    searching: t('wms.shell.product.searching', 'Searching...'),
    startTyping: t('wms.shell.product.placeholder', 'Start typing product / SKU / EAN'),
    trailingEmpty: t('wms.shell.rows.trailingEmpty', 'New row is ready'),
    unnamedProduct: t('wms.shell.product.unnamed', 'Product'),
  }), [t]);

  useEffect(() => {
    const nextHeader = buildInitialHeader(config, initialHeader);
    setHeader(nextHeader);
    setRows(normalizeInitialRows(initialRows, config, mode));
    setBaselineHeader({ ...(originalHeader || initialHeader || {}) });
    setBaselineRows(normalizeInitialRows(originalRows || initialRows, config, mode));
    setRemovedItemIds([]);
    setFieldErrors({});
    setRowErrors({});
    setRowWarnings({});
    setDocumentError('');
    setDocumentNotice('');
    setOperationConfirm(null);
    setCorrectionConfirm(false);
    setCorrectionReason('');
    setSelectedCorrectionIds([]);
    setScanModeOpen(false);
    setScanFeedback({ status: 'ready', at: 0 });
    setRecentScans([]);
  }, [config, initialHeader, initialRows, mode, originalHeader, originalRows, resetKey]);

  const warehouseOptions = useMemo(() => [
    { value: '', label: t('wms.shell.placeholders.selectWarehouse', 'Select warehouse') },
    ...warehouses.map((row) => ({ value: row.id, label: formatWarehouseLabel(row) })),
  ], [t, warehouses]);

  const locationOptions = useMemo(() => {
    const filtered = locations.filter((row) => !header.warehouseId || row.warehouseId === header.warehouseId);
    return [
      { value: '', label: t('wms.shell.placeholders.warehouseLevelStock', 'Warehouse-level stock') },
      ...filtered.map((row) => ({ value: row.id, label: formatLocationLabel(row) })),
    ];
  }, [header.warehouseId, locations, t]);

  const getLocationOptions = (fieldKey) => {
    const warehouseId = getLocationWarehouseId(fieldKey, header);
    const filtered = locations.filter((row) => !warehouseId || row.warehouseId === warehouseId);
    const placeholder = fieldKey === 'targetLocationId' || fieldKey === 'toLocationId'
      ? t('wms.shell.placeholders.targetWarehouseLevelStock', 'Target warehouse-level stock')
      : fieldKey === 'sourceLocationId' || fieldKey === 'fromLocationId'
        ? t('wms.shell.placeholders.sourceWarehouseLevelStock', 'Source warehouse-level stock')
        : t('wms.shell.placeholders.warehouseLevelStock', 'Warehouse-level stock');
    return [
      { value: '', label: placeholder },
      ...filtered.map((row) => ({ value: row.id, label: formatLocationLabel(row) })),
    ];
  };

  const validation = useMemo(() => {
    const committableRows = getPersistableRows(rows, config);
    const result = runValidationRules(config, {
      header,
      rows,
      persistableRows: committableRows,
      mode,
      qtyField,
    });
    const nextRowErrors = {};
    const nextRowWarnings = {};

    Object.entries(result.byRow).forEach(([rowId, rowResult]) => {
      if (Object.keys(rowResult.blocking || {}).length) nextRowErrors[rowId] = rowResult.blocking;
      if (Object.keys(rowResult.warnings || {}).length) nextRowWarnings[rowId] = rowResult.warnings;
    });

    return {
      fieldErrors: result.byField,
      rowErrors: nextRowErrors,
      rowWarnings: nextRowWarnings,
      documentMessages: result.byDocument.blocking.map((issue) => issue.message).filter(Boolean),
      blockingCount: result.blocking.length,
      warningCount: result.warnings.length,
      committableRows,
    };
  }, [config, header, mode, qtyField, rows]);

  const summary = useMemo(() => {
    return computeSummary(config, {
      header,
      rows,
      persistableRows: validation.committableRows,
      mode,
      qtyField,
      warningCount: validation.warningCount,
      blockingCount: validation.blockingCount,
    });
  }, [config, header, mode, qtyField, rows, validation]);

  const postedSummary = useMemo(() => {
    const visibleRows = rows.filter((row) => row?.id || getProductTitle(row));
    const primaryField = config?.kindKey === 'cycleCount' ? 'systemQty' : qtyField;
    const primaryQty = visibleRows.reduce((acc, row) => acc + asNumber(row[primaryField], 0), 0);
    const secondaryField = config?.kindKey === 'shipment'
      ? 'qtyShipped'
      : config?.kindKey === 'transfer'
        ? 'movedQty'
        : config?.kindKey === 'cycleCount'
          ? 'qtyCounted'
          : config?.kindKey === 'receipt'
            ? 'qtyReceived'
            : '';
    const secondaryQty = secondaryField
      ? visibleRows.reduce((acc, row) => acc + asNumber(row[secondaryField], 0), 0)
      : visibleRows.reduce((acc, row) => acc + asNumber(row[qtyField], 0), 0);
    const varianceQty = visibleRows.reduce((acc, row) => acc + asNumber(row.difference, 0), 0);
    return {
      lines: visibleRows.length,
      primaryQty,
      secondaryQty,
      varianceQty,
      movementsCount: Array.isArray(stockMoves) ? stockMoves.length : 0,
    };
  }, [config?.kindKey, qtyField, rows, stockMoves]);

  const postedRows = useMemo(() => (
    rows.filter((row) => row?.id || getProductTitle(row))
  ), [rows]);

  const correctionRows = useMemo(() => (
    rows
      .filter((row) => row?.id && getCorrectionQty(row, config) > 0)
      .map((row) => ({ ...row, correctionQty: getCorrectionQty(row, config) }))
  ), [config, rows]);

  useEffect(() => {
    if (!isCorrectionMode) return;
    setSelectedCorrectionIds(correctionRows.map((row) => row.id));
  }, [correctionRows, isCorrectionMode, resetKey]);

  const postedItemColumns = useMemo(() => {
    const kindKey = config?.kindKey || '';
    const processedField = kindKey === 'shipment'
      ? 'qtyShipped'
      : kindKey === 'transfer'
        ? 'movedQty'
        : kindKey === 'receipt'
          ? 'qtyReceived'
          : '';
    const hasRemaining = processedField && postedRows.some((row) => (
      Math.max(0, asNumber(row[qtyField], 0) - asNumber(row[processedField], 0)) > 0
    ));
    const hasLot = postedRows.some((row) => hasPostedValue(row.lotNumber));
    const hasUnitCost = postedRows.some((row) => hasPostedValue(row.unitCost));
    const hasTotalCost = postedRows.some((row) => (
      hasPostedValue(row.unitCost) && asNumber(row.qtyReceived ?? row[qtyField], 0) > 0
    ));
    const hasLocation = postedRows.some((row) => hasPostedValue(getLocationDisplay(row, 'locationId')));
    const hasFromLocation = postedRows.some((row) => hasPostedValue(getLocationDisplay(row, 'fromLocationId')));
    const hasToLocation = postedRows.some((row) => hasPostedValue(getLocationDisplay(row, 'toLocationId')));
    const hasStatus = postedRows.some((row) => hasPostedValue(row.status));
    const hasReason = postedRows.some((row) => hasPostedValue(row.reason));
    const hasSystemQty = postedRows.some((row) => hasPostedValue(row.systemQty));
    const hasCountedQty = postedRows.some((row) => hasPostedValue(row.qtyCounted));
    const hasDifference = postedRows.some((row) => hasPostedValue(row.difference));

    const baseColumns = [
      { key: 'product', label: t('wms.columns.product', 'Product') },
      { key: 'sku', label: t('wms.columns.sku', 'SKU'), mono: true },
    ];
    if (kindKey === 'cycleCount') {
      return [
        ...baseColumns,
        hasSystemQty ? { key: 'systemQty', label: t('wms.cycleCounts.columns.system', 'System'), numeric: true } : null,
        hasCountedQty ? { key: 'qtyCounted', label: t('wms.cycleCounts.columns.counted', 'Counted'), numeric: true } : null,
        hasDifference ? { key: 'difference', label: t('wms.cycleCounts.columns.diff', 'Difference'), numeric: true } : null,
        hasLocation ? { key: 'location', label: t('wms.print.location', 'Location') } : null,
        hasStatus ? { key: 'status', label: t('wms.columns.status', 'Status') } : null,
      ].filter(Boolean);
    }
    if (kindKey === 'adjustment') {
      return [
        ...baseColumns,
        { key: 'qtyDelta', label: t('wms.create.qtyDelta', 'Qty delta'), numeric: true },
        hasReason ? { key: 'reason', label: t('wms.fields.reason', 'Reason') } : null,
        hasLocation ? { key: 'location', label: t('wms.print.location', 'Location') } : null,
        hasStatus ? { key: 'status', label: t('wms.columns.status', 'Status') } : null,
      ].filter(Boolean);
    }
    if (kindKey === 'shipment') {
      return [
        ...baseColumns,
        { key: 'qty', label: t('wms.columns.qty', 'Qty'), numeric: true },
        { key: 'qtyShipped', label: t('wms.shell.posted.shipped', 'Shipped'), numeric: true },
        hasRemaining ? { key: 'remaining', label: t('wms.shell.posted.remaining', 'Remaining'), numeric: true } : null,
        hasFromLocation ? { key: 'fromLocation', label: t('wms.history.columns.from', 'From') } : null,
        hasStatus ? { key: 'status', label: t('wms.columns.status', 'Status') } : null,
      ].filter(Boolean);
    }
    if (kindKey === 'transfer') {
      return [
        ...baseColumns,
        { key: 'qty', label: t('wms.columns.qty', 'Qty'), numeric: true },
        { key: 'movedQty', label: t('wms.shell.posted.moved', 'Moved'), numeric: true },
        hasRemaining ? { key: 'remaining', label: t('wms.shell.posted.remaining', 'Remaining'), numeric: true } : null,
        hasFromLocation ? { key: 'fromLocation', label: t('wms.history.columns.from', 'From') } : null,
        hasToLocation ? { key: 'toLocation', label: t('wms.history.columns.to', 'To') } : null,
        hasStatus ? { key: 'status', label: t('wms.columns.status', 'Status') } : null,
      ].filter(Boolean);
    }
    return [
      ...baseColumns,
      { key: 'expected', label: t('wms.shell.posted.expected', 'Expected'), numeric: true },
      { key: 'received', label: t('wms.shell.posted.received', 'Received'), numeric: true },
      hasRemaining ? { key: 'remaining', label: t('wms.shell.posted.remaining', 'Remaining'), numeric: true } : null,
      hasLot ? { key: 'lot', label: t('wms.receipts.draftEdit.details.lot', 'Lot') } : null,
      hasUnitCost ? { key: 'unitCost', label: t('wms.columns.unitCost', 'Unit cost'), numeric: true } : null,
      hasTotalCost ? { key: 'totalCost', label: t('wms.shell.posted.totalCost', 'Total cost'), numeric: true } : null,
    ].filter(Boolean);
  }, [config?.kindKey, postedRows, qtyField, t]);

  const hasOperationCandidates = useMemo(() => (
    isDocumentOperationMode(mode)
    || (isOperationMode(mode)
    && validation.committableRows.some((row) => getRemainingQty(row, mode, qtyField) > 0)
    )
  ), [mode, qtyField, validation.committableRows]);

  const setHeaderField = (key, value) => {
    setHeader((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'warehouseId' && prev.warehouseId !== value) {
        next.inboundLocationId = '';
        next.locationId = '';
      }
      if (key === 'fromWarehouseId' && prev.fromWarehouseId !== value) {
        next.sourceLocationId = '';
        next.fromLocationId = '';
      }
      if (key === 'toWarehouseId' && prev.toWarehouseId !== value) {
        next.targetLocationId = '';
        next.toLocationId = '';
      }
      return next;
    });
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const renderHeaderField = (field) => {
    const label = getHeaderFieldLabel(field, mode, t);
    const value = header[field.key] || '';
    const disabled = isSaving
      || isReceiving
      || isReadonlyHeaderMode
      || mode === 'post'
      || mode === 'reconcile'
      || ((mode === 'ship' || mode === 'execute') && field.type !== 'locationSelect');
    if (isReadonlyHeaderMode) {
      return (
        <div key={field.key} className="wmsShellField wmsShellFieldReadonly">
          <span>{label}</span>
          <strong>{getReadonlyHeaderValue(field, value, { t, warehouseOptions, locations })}</strong>
        </div>
      );
    }
    if (field.type === 'documentTypeSelect') {
      return (
        <label key={field.key} className="wmsShellField">
          <span>{label}</span>
          <input
            className="wmsShellInput"
            value={value || field.fixedValue || ''}
            disabled
            readOnly
          />
          {fieldErrors[field.key] ? <span className="wmsShellFieldError">{fieldErrors[field.key]}</span> : null}
        </label>
      );
    }
    if (field.type === 'warehouseSelect') {
      return (
        <label key={field.key} className="wmsShellField">
          <span>{label}</span>
          <ThemedSelect
            value={value}
            onChange={(nextValue) => setHeaderField(field.key, nextValue)}
            options={warehouseOptions}
            placeholder={getHeaderFieldPlaceholder(field, t) || t('wms.shell.placeholders.selectWarehouse', 'Select warehouse')}
            disabled={disabled}
          />
          {fieldErrors[field.key] ? <span className="wmsShellFieldError">{fieldErrors[field.key]}</span> : null}
        </label>
      );
    }
    if (field.type === 'locationSelect') {
      const options = field.key === 'inboundLocationId' ? locationOptions : getLocationOptions(field.key);
      return (
        <label key={field.key} className="wmsShellField">
          <span>{label}</span>
          <ThemedSelect
            value={value}
            onChange={(nextValue) => setHeaderField(field.key, nextValue)}
            options={options}
            placeholder={getHeaderFieldPlaceholder(field, t) || t('wms.shell.placeholders.warehouseLevelStock', 'Warehouse-level stock')}
            disabled={disabled}
          />
          {!value ? <span className="wmsShellHint">{getHeaderFieldPlaceholder(field, t) || t('wms.shell.placeholders.warehouseLevelStock', 'Warehouse-level stock')}</span> : null}
          {fieldErrors[field.key] ? <span className="wmsShellFieldError">{fieldErrors[field.key]}</span> : null}
        </label>
      );
    }
    if (field.type === 'date') {
      return (
        <label key={field.key} className="wmsShellField">
          <span>{label}</span>
          <input
            className="wmsShellInput"
            type="date"
            value={value}
            onChange={(event) => setHeaderField(field.key, event.target.value)}
            disabled={disabled || mode === 'draft'}
          />
          {mode === 'draft' ? <span className="wmsShellHint">{t('wms.shell.hints.dateReadOnly', 'Date is read-only in this mode.')}</span> : null}
          {fieldErrors[field.key] ? <span className="wmsShellFieldError">{fieldErrors[field.key]}</span> : null}
        </label>
      );
    }
    if (field.type === 'text') {
      return (
        <label key={field.key} className="wmsShellField">
          <span>{label}</span>
          <input
            className="wmsShellInput"
            value={value}
            onChange={(event) => setHeaderField(field.key, event.target.value)}
            placeholder={getHeaderFieldPlaceholder(field, t)}
            disabled={disabled}
          />
          {fieldErrors[field.key] ? <span className="wmsShellFieldError">{fieldErrors[field.key]}</span> : null}
        </label>
      );
    }
    return null;
  };

  const renderPostedRows = () => {
    if (!postedRows.length) {
      return (
        <div className="wmsShellPostedEmpty">
          {t('wms.shell.posted.noItems', 'No posted items found.')}
        </div>
      );
    }
    const renderCell = (column, row) => {
      if (column.key === 'product') {
        return (
          <div className="wmsShellPostedProduct">
            <strong>{getProductTitle(row, t('wms.shell.product.unnamed', 'Product'))}</strong>
            <span>{getProductCode(row) || t('wms.shell.product.noSku', 'No SKU')}</span>
          </div>
        );
      }
      if (column.key === 'sku') return getProductCode(row) || '—';
      if (column.key === 'expected') return formatQtyValue(row[qtyField]);
      if (column.key === 'received') return formatQtyValue(row.qtyReceived);
      if (column.key === 'qty') return formatQtyValue(row[qtyField] ?? row.qty);
      if (column.key === 'qtyShipped') return formatQtyValue(row.qtyShipped);
      if (column.key === 'movedQty') return formatQtyValue(row.movedQty);
      if (column.key === 'qtyDelta') return formatQtyValue(row.qtyDelta);
      if (column.key === 'systemQty') return formatQtyValue(row.systemQty);
      if (column.key === 'qtyCounted') return formatQtyValue(row.qtyCounted);
      if (column.key === 'difference') return formatQtyValue(row.difference);
      if (column.key === 'remaining') {
        const processed = row.qtyShipped ?? row.movedQty ?? row.qtyReceived ?? 0;
        const remaining = Math.max(0, asNumber(row[qtyField] ?? row.qty, 0) - asNumber(processed, 0));
        return remaining || '—';
      }
      if (column.key === 'lot') return asText(row.lotNumber) || '—';
      if (column.key === 'location') return getLocationDisplay(row, 'locationId') || '—';
      if (column.key === 'fromLocation') return getLocationDisplay(row, 'fromLocationId') || '—';
      if (column.key === 'toLocation') return getLocationDisplay(row, 'toLocationId') || '—';
      if (column.key === 'status') return getPostedStatusLabel(row.status) || '—';
      if (column.key === 'reason') return asText(row.reason) || '—';
      if (column.key === 'unitCost') return formatMoney(row.unitCost, row.currency);
      if (column.key === 'totalCost') {
        const unitCost = asNumber(row.unitCost, null);
        const totalCost = unitCost === null ? '' : unitCost * asNumber(row.qtyReceived, 0);
        return totalCost === '' ? '—' : formatMoney(totalCost, row.currency);
      }
      return '—';
    };
    return (
      <div className="wmsShellTableWrap wmsShellPostedTableWrap">
        <table className="wmsShellTable wmsShellPostedTable">
          <colgroup>
            {postedItemColumns.map((column) => (
              <col key={column.key} className={`wmsShellPostedCol-${column.key}`} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {postedItemColumns.map((column) => (
                <th key={column.key} className={column.numeric ? 'wmsShellPostedNumber' : undefined}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {postedRows.map((row, index) => (
              <tr key={row.id || row.localId || `posted-row-${index}`}>
                {postedItemColumns.map((column) => (
                  <td
                    key={column.key}
                    className={[
                      column.numeric ? 'wmsShellPostedNumber' : '',
                      column.mono ? 'wmsShellPostedMono' : '',
                    ].filter(Boolean).join(' ') || undefined}
                  >
                    {renderCell(column, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderPostedMovements = () => (
    <section className="wmsShellPostedMovements">
      <div className="wmsShellPostedSectionHeader">
        <h3>{t('wms.shell.posted.movements', 'Movements')}</h3>
        <span className="wmsShellPostedCountBadge">
          {t('wms.shell.posted.movementsCount', '{{count}} movements', { count: postedSummary.movementsCount })}
        </span>
      </div>
      {Array.isArray(stockMoves) && stockMoves.length ? (
        <div className="wmsShellTableWrap wmsShellPostedTableWrap wmsShellPostedMovesWrap">
          <table className="wmsShellTable wmsShellPostedMovesTable">
            <colgroup>
              <col className="wmsShellPostedMoveCol-date" />
              <col className="wmsShellPostedMoveCol-type" />
              <col className="wmsShellPostedMoveCol-product" />
              <col className="wmsShellPostedMoveCol-qty" />
              <col className="wmsShellPostedMoveCol-location" />
              <col className="wmsShellPostedMoveCol-location" />
            </colgroup>
            <thead>
              <tr>
                <th>{t('wms.history.columns.date', 'Date')}</th>
                <th>{t('wms.history.columns.type', 'Type')}</th>
                <th>{t('wms.history.columns.product', 'Product')}</th>
                <th>{t('wms.history.columns.qty', 'Qty')}</th>
                <th>{t('wms.history.columns.from', 'From')}</th>
                <th>{t('wms.history.columns.to', 'To')}</th>
              </tr>
            </thead>
            <tbody>
              {stockMoves.map((move, index) => (
                <tr key={move.id || `${move.refItemId || 'move'}-${index}`}>
                  <td>{asText(move.createdAt || move.date || move.updatedAt).slice(0, 10) || '—'}</td>
                  <td>{asText(move.type || move.movementType) || '—'}</td>
                  <td>
                    <div className="wmsShellPostedProduct">
                      <strong>{getProductTitle(move, asText(move.productId) || '—')}</strong>
                      <span>{getProductCode(move) || asText(move.variantId) || '—'}</span>
                    </div>
                  </td>
                  <td className="wmsShellPostedNumber">{formatQtyValue(getMoveQty(move))}</td>
                  <td>{asText(move.fromLocation?.code || move.fromLocation?.name || move.fromLocationId) || '—'}</td>
                  <td>{asText(move.toLocation?.code || move.toLocation?.name || move.toLocationId) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="wmsShellPostedEmpty">
          {t('wms.history.empty', 'No stock moves')}
        </div>
      )}
    </section>
  );

  const toggleCorrectionRow = (rowId) => {
    setSelectedCorrectionIds((prev) => (
      prev.includes(rowId)
        ? prev.filter((entry) => entry !== rowId)
        : [...prev, rowId]
    ));
    setCorrectionConfirm(false);
    setDocumentError('');
  };

  const renderCorrectionRows = () => {
    if (!correctionRows.length) {
      return (
        <div className="wmsShellPostedEmpty">
          {t('wms.corrections.noLines', 'No lines available for correction')}
        </div>
      );
    }
    const correctionQtyLabel = config?.kindKey === 'shipment'
      ? t('wms.shell.posted.shipped', 'Shipped')
      : t('wms.shell.posted.received', 'Received');
    return (
      <div className="wmsShellTableWrap wmsShellCorrectionTableWrap">
        <table className="wmsShellTable wmsShellCorrectionTable">
          <thead>
            <tr>
              <th className="wmsShellCorrectionSelectCol">{t('wms.corrections.select', 'Select')}</th>
              <th>{t('wms.columns.product', 'Product')}</th>
              <th>{t('wms.columns.sku', 'SKU')}</th>
              <th>{t('wms.receipts.draftEdit.details.lot', 'Lot')}</th>
              <th className="wmsShellPostedNumber">{correctionQtyLabel}</th>
            </tr>
          </thead>
          <tbody>
            {correctionRows.map((row, index) => {
              const checked = selectedCorrectionIds.includes(row.id);
              return (
                <tr key={row.id || row.localId || `correction-row-${index}`} className={checked ? 'wmsShellCorrectionRowSelected' : ''}>
                  <td className="wmsShellCorrectionSelectCol">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCorrectionRow(row.id)}
                      disabled={isSaving || isReceiving}
                      aria-label={t('wms.corrections.selectLine', 'Select line')}
                    />
                  </td>
                  <td>
                    <div className="wmsShellPostedProduct">
                      <strong>{getProductTitle(row, t('wms.shell.product.unnamed', 'Product'))}</strong>
                      <span>{row.variantLabel || row.pickerVariantLabel || t('wms.columns.variant', 'Variant')}</span>
                    </div>
                  </td>
                  <td className="wmsShellPostedMono">{getProductCode(row) || '—'}</td>
                  <td>{asText(row.lotNumber) || '—'}</td>
                  <td className="wmsShellPostedNumber">{formatQtyValue(row.correctionQty)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const applyValidation = () => {
    setFieldErrors(validation.fieldErrors);
    setRowErrors(validation.rowErrors);
    setRowWarnings(validation.rowWarnings);
    if (rowControllerEnabled && !validation.committableRows.length) {
      setDocumentError(validation.documentMessages[0] || t('wms.validation.rowsRequired', 'Add at least one product row before saving.'));
      return false;
    }
    setDocumentError('');
    return validation.blockingCount === 0;
  };

  const onSaveDraft = async () => {
    setDocumentError('');
    setDocumentNotice('');
    if (!applyValidation()) return;
    const action = mode === 'draft' ? 'updateDraftHeader' : 'save';
    if (!adapter?.supports?.(action)) {
      setDocumentError(t('wms.shell.errors.saveUnavailable', 'Save is not available for this document.'));
      return;
    }

    setSaving(true);
    try {
      let result;
      if (mode === 'draft') {
        result = await saveDraftDiff();
      } else {
        result = await adapter.run('save', {
          header,
          rows: validation.committableRows,
          options: { mode },
        });
      }
      if (result?.ok && result.documentId) {
        onSaveSuccess?.(result);
        return;
      }
      setDocumentError(getDocumentError(result) || t('wms.shell.errors.saveDraftFailed', 'Failed to save draft.'));
    } finally {
      setSaving(false);
    }
  };

  const runAdapterAction = async (action, input, fallback) => {
    const result = await adapter.run(action, input);
    if (!result?.ok) {
      throw new Error(getDocumentError(result) || fallback);
    }
    return result;
  };

  const loadLatestDraftRows = async () => {
    const loaded = await runAdapterAction('loadDraft', { id: documentId }, t('wms.shell.errors.reloadDraftFailed', 'Failed to reload receipt draft.'));
    const latestReceipt = loaded.raw?.data || loaded.raw || {};
    return {
      result: loaded,
      receipt: latestReceipt,
      draft: mapReceiptToShellDraft(latestReceipt, config),
    };
  };

  const saveDraftDiff = async () => {
    if (!documentId) throw new Error(t('wms.shell.errors.documentIdRequired', 'Document id is required.'));

    const baselineById = new Map(
      baselineRows
        .filter((row) => row.id)
        .map((row) => [row.id, row])
    );

    await runAdapterAction('updateDraftHeader', {
      id: documentId,
      header,
      baselineHeader,
    }, t('wms.shell.errors.updateHeaderFailed', 'Failed to update receipt header.'));

    for (const itemId of removedItemIds) {
      // eslint-disable-next-line no-await-in-loop
      await runAdapterAction('removeItem', { id: documentId, itemId }, t('wms.shell.errors.removeLineFailed', 'Failed to remove receipt line.'));
    }

    for (const row of validation.committableRows) {
      if (row.id) {
        const baselineRow = baselineById.get(row.id);
        if (baselineRow && areDraftItemSnapshotsEqual(row, baselineRow, config)) continue;
        // eslint-disable-next-line no-await-in-loop
        await runAdapterAction('updateItem', {
          id: documentId,
          itemId: row.id,
          row,
        }, t('wms.shell.errors.updateLineFailed', 'Failed to update receipt line.'));
      } else {
        // eslint-disable-next-line no-await-in-loop
        await runAdapterAction('addItem', {
          id: documentId,
          row,
        }, t('wms.shell.errors.addLineFailed', 'Failed to add receipt line.'));
      }
    }

    return {
      ok: true,
      documentId,
      status: 'draft',
      warnings: [],
      errors: [],
      raw: null,
    };
  };

  const onRowsChange = (nextRows) => {
    setRows(normalizeInitialRows(nextRows, config, mode));
  };

  const onRemoveRow = (_localId, row) => {
    if (row?.id) {
      setRemovedItemIds((prev) => (prev.includes(row.id) ? prev : [...prev, row.id]));
    }
    setRows((prev) => normalizeInitialRows(prev.filter((entry) => entry.localId !== row.localId), config, mode));
  };

  const onRunOperationAll = async ({ confirmed = false } = {}) => {
    setDocumentError('');
    setDocumentNotice('');
    if (!isOperationMode(mode) || !documentId) return;
    if (mode === 'draft' && !applyValidation()) return;
    const action = getOperationAction(mode);
    if (!adapter?.supports?.(action)) {
      setDocumentError(t('wms.shell.errors.operationUnavailable', '{{operation}} is not available for this document.', {
        operation: getOperationLabel(mode, t).replace(/ all$/i, ''),
      }));
      return;
    }

    if (!confirmed && typeof getOperationConfirm === 'function') {
      const confirmation = getOperationConfirm({
        documentId,
        header,
        rows,
        mode,
      });
      if (confirmation) {
        setOperationConfirm(confirmation);
        return;
      }
    }

    setReceiving(true);
    try {
      let latest = null;
      if (mode === 'draft') {
        await saveDraftDiff();
        latest = await loadLatestDraftRows();
      }
      const sourceHeader = latest?.draft?.header || header;
      const sourceRows = latest?.draft?.rows || rows;
      const persistedRows = isDocumentOperationMode(mode)
        ? []
        : getPersistableRows(sourceRows, config)
          .filter((row) => row.id)
          .filter((row) => getRemainingQty(row, mode, qtyField) > 0);

      if (!isDocumentOperationMode(mode) && !persistedRows.length) {
        setDocumentError(getOperationEmptyMessage(mode, t));
        return;
      }

      const result = await adapter.run(action, {
        id: documentId,
        header: sourceHeader,
        rows: persistedRows,
      });

      if (!result?.ok) {
        setDocumentError(getDocumentError(result) || getOperationErrorMessage(mode, t));
        return;
      }

      setOperationConfirm(null);
      setDocumentNotice(getOperationNotice(mode, t));
      onSaveSuccess?.(result);
    } catch (error) {
      setDocumentError(error?.message || getOperationErrorMessage(mode, t));
    } finally {
      setReceiving(false);
    }
  };

  const onCreateCorrection = async ({ confirmed = false } = {}) => {
    setDocumentError('');
    setDocumentNotice('');
    if (!isCorrectionMode || !documentId) return;

    const selectedRows = correctionRows.filter((row) => selectedCorrectionIds.includes(row.id));
    if (!selectedRows.length) {
      setDocumentError(t('wms.corrections.noLines', 'No lines available for correction'));
      return;
    }

    if (!confirmed) {
      setCorrectionConfirm(true);
      return;
    }

    if (!adapter?.supports?.('correct')) {
      setDocumentError(t('wms.policy.correctionUnavailable', 'Correction is unavailable for this status.'));
      return;
    }

    const payload = {
      ...(asText(correctionReason) ? { reason: asText(correctionReason) } : {}),
      items: selectedRows.map((row) => ({
        originalItemId: row.id,
        qty: getCorrectionQty(row, config),
      })),
    };

    setReceiving(true);
    try {
      const result = await adapter.run('correct', {
        id: documentId,
        header,
        rows: selectedRows,
        payload,
      });
      if (!result?.ok) {
        setDocumentError(getDocumentError(result) || t('wms.corrections.errors.createFailed', 'Failed to create correction.'));
        return;
      }
      setCorrectionConfirm(false);
      setDocumentNotice(t('wms.corrections.created', 'Correction was created. Opening the correction document...'));
      onSaveSuccess?.(result);
    } catch (error) {
      setDocumentError(error?.message || t('wms.corrections.errors.createFailed', 'Failed to create correction.'));
    } finally {
      setReceiving(false);
    }
  };

  const badge = config?.badge || 'PZ';
  const documentNumber = asText(postedMeta.documentNumber || header.documentNumber || documentId);
  const postedStatusLabel = getPostedStatusLabel(postedMeta.status || header.status);
  const title = isCorrectionMode && documentNumber
    ? t('wms.corrections.correctionOf', 'Correction of {{number}}', { number: documentNumber })
    : isPostedMode && documentNumber
    ? documentNumber
    : `${badge} ${getModeTitle(mode, t)}`;
  const selectedCorrectionRows = correctionRows.filter((row) => selectedCorrectionIds.includes(row.id));
  const selectedCorrectionQty = selectedCorrectionRows.reduce((acc, row) => acc + getCorrectionQty(row, config), 0);
  const postedPrimarySummaryLabel = config?.kindKey === 'receipt'
    ? t('wms.shell.posted.expected', 'Expected')
    : config?.kindKey === 'cycleCount'
      ? t('wms.cycleCounts.columns.system', 'System')
      : config?.kindKey === 'adjustment'
        ? t('wms.create.qtyDelta', 'Qty delta')
        : t('wms.columns.qty', 'Qty');
  const postedSecondarySummaryLabel = config?.kindKey === 'receipt'
    ? t('wms.shell.posted.received', 'Received')
    : config?.kindKey === 'shipment'
      ? t('wms.shell.posted.shipped', 'Shipped')
      : config?.kindKey === 'transfer'
        ? t('wms.shell.posted.moved', 'Moved')
        : config?.kindKey === 'cycleCount'
          ? t('wms.cycleCounts.columns.counted', 'Counted')
          : t('wms.summary.qtyTotal', 'Total qty');
  const locationMode = useMemo(() => getHeaderLocationMode(header, locations), [header, locations]);
  const visibleHeaderFields = useMemo(() => headerFields.filter((field) => {
    if (isReadonlyHeaderMode) return shouldShowPostedHeaderField(field, header);
    if (!isLocationFieldKey(field?.key)) return true;
    if (isAdvancedLocationMode(locationMode)) return true;
    return Boolean(asText(header[field.key]));
  }), [header, headerFields, isReadonlyHeaderMode, locationMode]);

  const renderScanResults = (variant = 'inline') => (
    scanner.scanResults.length ? (
      <div className={variant === 'mode' ? 'wmsShellScanModeResults' : 'wmsShellScanResults'}>
        {scanner.scanResults.slice(0, 8).map((result) => {
          const key = scanner.getScanResultKey(result);
          return (
            <button
              type="button"
              key={key}
              className={variant === 'mode' ? 'wmsShellScanModeResult' : 'wmsShellScanResult'}
              onMouseDown={(event) => {
                event.preventDefault();
                scanner.selectScanResult(result);
              }}
            >
              <strong>{scanner.getScanResultTitle(result)}</strong>
              <span>{scanner.getScanResultMeta(result)}</span>
            </button>
          );
        })}
      </div>
    ) : null
  );

  const renderScannerInput = (variant = 'inline') => (
    <label className={variant === 'mode' ? 'wmsShellScanModeField' : 'wmsShellScanField'}>
      <span>{variant === 'mode' ? t('wms.shell.scanner.largeInput', 'Large scan input') : t('wms.shell.scanner.quickAdd', 'Scan / Quick add')}</span>
      <input
        ref={variant === 'mode' || !scanModeOpen ? scanner.scanInputRef : null}
        className={variant === 'mode' ? 'wmsShellInput wmsShellScanModeInput' : 'wmsShellInput wmsShellScanInput'}
        value={scanner.scanQuery}
        onChange={(event) => scanner.setScanQuery(event.target.value)}
        onKeyDown={scanner.onScanKeyDown}
        placeholder={t('wms.shell.scanner.placeholder', 'Scan barcode / SKU / EAN')}
        disabled={isSaving || isReceiving}
        autoComplete="off"
      />
    </label>
  );

  const renderRecentScans = (variant = 'inline') => (
    <div className={variant === 'mode' ? 'wmsShellScanModeRecent' : 'wmsShellScanRecent'}>
      <span className="wmsShellScanRecentTitle">{t('wms.shell.scanner.lastScans', 'Last scans')}</span>
      {recentScans.length ? (
        recentScans.map((entry) => {
          const ok = entry.status === 'found';
          const multiple = entry.status === 'multiple';
          return (
            <div key={entry.id} className={`wmsShellScanRecentItem wmsShellScanRecentItem-${entry.status}`}>
              {ok ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />}
              <span>
                <strong>{entry.title}</strong>
                {entry.query ? <small>{entry.query}</small> : null}
                {multiple || entry.meta ? <small>{entry.meta || t('wms.shell.scanner.multipleMatches', 'Multiple matches')}</small> : null}
              </span>
            </div>
          );
        })
      ) : (
        <div className="wmsShellScanRecentEmpty">{t('wms.shell.scanner.noScansYet', 'No scans yet')}</div>
      )}
    </div>
  );

  return (
    <div
      className={`wmsShellPage wmsShellMode-${mode}${isOperationMode(mode) ? ' wmsShellPageOperation' : ''}`}
      data-testid="wms-document-shell"
    >
      <section className="wmsShellCard">
        <div className="wmsShellDocumentBar">
          <div>
            <div className="wmsShellTitleRow">
              <span className="wmsShellBadge">{badge}</span>
              <h1>{title}</h1>
              {isReadonlyHeaderMode && postedStatusLabel ? (
                <WmsStatusChip status={postedMeta.status || header.status || 'posted'} size="sm" className="wmsShellTitleStatusChip">
                  {postedStatusLabel}
                </WmsStatusChip>
              ) : null}
              <span className="wmsShellMode">
                {isPostedMode ? t('common.readOnly', 'Read-only') : getModeTitle(mode, t)}
              </span>
              <span className="wmsShellLocationMode" title={t(`wms.locationMode.${locationMode}.description`, getWmsLocationModeDescription(locationMode))}>
                {t(`wms.locationMode.${locationMode}.label`, getWmsLocationModeLabel(locationMode))}
              </span>
            </div>
            <p>{getModeSubtitle(mode, badge, t)}</p>
          </div>
          <div className="wmsShellActions">
            {isPostedMode ? (
              <>
                <button type="button" className="wmsShellButton" onClick={onCancel}>
                  {t('wms.shell.actions.backToDocuments', 'Back to Documents')}
                </button>
                {correctionUrl ? (
                  <Link className="wmsShellButton wmsShellActionLink" to={correctionUrl}>
                    {t('wms.corrections.action', 'Correction')}
                  </Link>
                ) : null}
                {sourceUrl ? (
                  <a className="wmsShellButton wmsShellActionLink" href={sourceUrl}>
                    {t('wms.shell.actions.openSource', 'Open source document')}
                  </a>
                ) : null}
                {printUrl ? (
                  <Link className="wmsShellPrimaryButton wmsShellActionLink" to={printUrl}>
                    {t('wms.print.print', 'Print')}
                  </Link>
                ) : null}
              </>
            ) : isCorrectionMode ? (
              <>
                <button type="button" className="wmsShellButton" onClick={onCancel} disabled={isSaving || isReceiving}>
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="button"
                  className="wmsShellPrimaryButton"
                  onClick={() => onCreateCorrection()}
                  disabled={isSaving || isReceiving || !selectedCorrectionRows.length}
                >
                  {isReceiving ? t('common.saving', 'Saving...') : t('wms.corrections.submit', 'Create correction')}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="wmsShellButton" onClick={onCancel} disabled={isSaving || isReceiving}>
                  {t('common.cancel', 'Cancel')}
                </button>
                {mode === 'create' ? (
                  <button type="button" className="wmsShellButton" disabled>
                    {getDeferredActionLabel(config, t)}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="wmsShellPrimaryButton"
                    onClick={() => onRunOperationAll()}
                    disabled={isSaving || isReceiving || (mode === 'draft' && validation.blockingCount > 0) || !hasOperationCandidates}
                  >
                    {isReceiving ? getOperationProgressLabel(mode, t) : getOperationLabel(mode, t)}
                  </button>
                )}
                {mode !== 'post' && mode !== 'reconcile' && mode !== 'ship' && mode !== 'execute' ? (
                  <button type="button" className="wmsShellButton" onClick={onSaveDraft} disabled={isSaving || isReceiving}>
                    {isSaving ? t('common.saving', 'Saving...') : t('wms.create.saveDraft', 'Save draft')}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>

        {documentError ? <div className="wmsShellErrorBanner">{documentError}</div> : null}
        {documentNotice ? <div className="wmsShellNoticeBanner">{documentNotice}</div> : null}
        {mode === 'draft' ? (
          <div className="wmsShellReceiveWarning">
            {t('wms.shell.warnings.receive', 'Receive will post stock movements. Save draft first.')}
          </div>
        ) : null}
        {mode === 'ship' ? (
          <div className="wmsShellReceiveWarning">
            {t('wms.shell.warnings.ship', 'Ship all will post stock movements for remaining persisted rows.')}
          </div>
        ) : null}
        {mode === 'execute' ? (
          <div className="wmsShellReceiveWarning">
            {t('wms.shell.warnings.execute', 'Execute all will post stock movements for remaining persisted rows.')}
          </div>
        ) : null}
        {mode === 'post' ? (
          <div className="wmsShellReceiveWarning">
            {t('wms.shell.warnings.post', 'Post will apply the existing draft adjustment.')}
          </div>
        ) : null}
        {mode === 'reconcile' ? (
          <div className="wmsShellReceiveWarning">
            {t('wms.shell.warnings.reconcile', 'Reconcile will apply counted differences and may create RW/PW adjustments.')}
          </div>
        ) : null}
        {isCorrectionMode ? (
          <div className="wmsShellReceiveWarning">
            {t('wms.corrections.fullLineHint', 'MVP supports full-line correction only. Quantity is read-only and equals the original processed quantity.')}
          </div>
        ) : null}
        {operationConfirm ? (
          <div className="wmsShellReceiveWarning" role="dialog" aria-modal="true">
            <strong>{operationConfirm.title || t('wms.shell.confirm.title', 'Confirm operation')}</strong>
            {Array.isArray(operationConfirm.lines) && operationConfirm.lines.length ? (
              <ul>
                {operationConfirm.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
            <div className="wmsShellActions">
              <button
                type="button"
                className="wmsShellButton"
                onClick={() => setOperationConfirm(null)}
                disabled={isReceiving}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                className="wmsShellPrimaryButton"
                onClick={() => onRunOperationAll({ confirmed: true })}
                disabled={isReceiving}
              >
                {isReceiving ? getOperationProgressLabel(mode, t) : (operationConfirm.confirmLabel || getOperationLabel(mode, t))}
              </button>
            </div>
          </div>
        ) : null}
        {correctionConfirm ? (
          <div className="wmsShellReceiveWarning" role="dialog" aria-modal="true">
            <strong>{t('wms.corrections.confirmTitle', 'Confirm correction')}</strong>
            <ul>
              <li>{t('wms.corrections.confirmLines', '{{count}} selected lines', { count: selectedCorrectionRows.length })}</li>
              <li>{t('wms.corrections.confirmQty', '{{qty}} total quantity will be corrected', { qty: selectedCorrectionQty })}</li>
            </ul>
            <div className="wmsShellActions">
              <button
                type="button"
                className="wmsShellButton"
                onClick={() => setCorrectionConfirm(false)}
                disabled={isReceiving}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                className="wmsShellPrimaryButton"
                onClick={() => onCreateCorrection({ confirmed: true })}
                disabled={isReceiving}
              >
                {isReceiving ? t('common.saving', 'Saving...') : t('wms.corrections.submit', 'Create correction')}
              </button>
            </div>
          </div>
        ) : null}

        <div className={`wmsShellBody${isReadonlyHeaderMode ? ' wmsShellPostedBody' : ''}${isCorrectionMode ? ' wmsShellCorrectionBody' : ''}`}>
          <aside className={`wmsShellHeaderRail${isReadonlyHeaderMode ? ' wmsShellPostedHeaderRail' : ''}`}>
            <h2>{t('wms.shell.sections.header', 'Header')}</h2>
            {visibleHeaderFields.map(renderHeaderField)}
            {isCorrectionMode ? (
              <label className="wmsShellField wmsShellCorrectionReasonField">
                <span>{t('wms.corrections.reason', 'Reason')}</span>
                <textarea
                  className="wmsShellInput wmsShellTextarea"
                  value={correctionReason}
                  onChange={(event) => {
                    setCorrectionReason(event.target.value);
                    setCorrectionConfirm(false);
                  }}
                  placeholder={t('wms.corrections.reasonPlaceholder', 'Optional reason')}
                  rows={4}
                  disabled={isSaving || isReceiving}
                />
              </label>
            ) : null}
            {!isReadonlyHeaderMode && !isAdvancedLocationMode(locationMode) ? (
              <div className="wmsShellSimpleModeNote">
                {t('wms.locationMode.simple.description', 'Location management is disabled. Warehouse-level stock is used.')}
              </div>
            ) : null}
          </aside>

          {(rowControllerEnabled || isReadonlyHeaderMode) ? (
            <main className="wmsShellWorkspace">
              <div className="wmsShellWorkspaceHeader">
                <h2>{isCorrectionMode ? t('wms.corrections.title', 'Create correction') : t('wms.tabs.items', 'Items')}</h2>
                <span>
                  {isCorrectionMode
                    ? t('wms.corrections.fullLineHint', 'MVP supports full-line correction only. Quantity is read-only and equals the original processed quantity.')
                    : isPostedMode
                    ? t('wms.shell.posted.readOnlyHint', 'Read-only posted document view')
                    : mode === 'draft'
                      ? t('wms.shell.keyboard.enterDraft', 'Enter commits qty and returns to scan')
                      : t('wms.shell.keyboard.enterCreate', 'Enter commits qty and focuses next row')}
                </span>
              </div>
              {isCorrectionMode ? (
                renderCorrectionRows()
              ) : isPostedMode ? (
                <>
                  {renderPostedRows()}
                  {renderPostedMovements()}
                  {postedExtraSections}
                </>
              ) : null}
              {scannerEnabled ? (
                <div
                  className={`wmsShellScanBar wmsShellScanBar-${scanStatus}`}
                  data-testid="wms-shell-scan-bar"
                  data-scan-status={scanStatus}
                >
                  <div className="wmsShellScanIcon" aria-hidden="true">
                    <ScanLine size={18} />
                  </div>
                  {renderScannerInput('inline')}
                  <div className="wmsShellScanMeta">
                    <WmsStatusChip status={getScanChipStatus(scanStatus)} size="sm" className="wmsShellScanStatusChip">
                      {getScanStatusLabel(scanStatus, t)}
                    </WmsStatusChip>
                    <span>F2</span>
                    <span>{t('wms.shell.scanner.enterResolves', 'Enter resolves')}</span>
                    <span>{t('wms.shell.scanner.escClears', 'Esc clears')}</span>
                  </div>
                  <button
                    type="button"
                    className="wmsShellScanModeButton"
                    onClick={() => {
                      setScanModeOpen(true);
                      scanner.focusScan();
                    }}
                    disabled={isSaving || isReceiving}
                  >
                    <Maximize2 size={14} aria-hidden="true" />
                    {t('wms.shell.scanner.scanMode', 'Scan mode')}
                  </button>
                  {scanner.isScanning ? <div className="wmsShellScanState">{t('wms.shell.product.searching', 'Searching...')}</div> : null}
                  {scanner.scanError ? <div className="wmsShellScanError">{scanner.scanError}</div> : null}
                  {scanFeedback.status === 'found' ? (
                    <div className="wmsShellScanSuccess">{t('wms.shell.scanner.scanned', 'Scanned {{title}}', { title: scanFeedback.title })}</div>
                  ) : null}
                  {renderScanResults('inline')}
                </div>
              ) : null}
              {!isReadonlyHeaderMode ? (
                <RowControllerV0
                  ref={rowControllerRef}
                  config={config}
                  rows={rows}
                  errors={rowErrors}
                  warnings={rowWarnings}
                  disabled={isSaving || isReceiving || mode === 'ship' || mode === 'execute' || mode === 'post' || mode === 'reconcile'}
                  searchProducts={searchProducts}
                  onRowsChange={onRowsChange}
                  onRemoveRow={onRemoveRow}
                  onQtyCommit={mode === 'draft' ? scanner.focusScan : undefined}
                  labels={rowControllerLabels}
                />
              ) : null}
            </main>
          ) : null}
        </div>

        {scannerEnabled && scanModeOpen ? (
          <div className={`wmsShellScanMode wmsShellScanMode-${scanStatus}`} data-testid="wms-shell-scan-mode">
            <div className="wmsShellScanModePanel">
              <div className="wmsShellScanModeTop">
                <div>
                  <span className="wmsShellScanModeEyebrow">{t('wms.shell.scanner.scanMode', 'Scan mode')}</span>
                  <h2>{scanDocumentLabel}</h2>
                  <p>{t('wms.shell.scanner.readyToScanDocument', 'Ready to scan into the current document.')}</p>
                </div>
                <button
                  type="button"
                  className="wmsShellScanModeClose"
                  onClick={() => setScanModeOpen(false)}
                  aria-label={t('wms.shell.scanner.closeScanMode', 'Close scan mode')}
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              <div className="wmsShellScanModeStatus">
                <WmsStatusChip status={getScanChipStatus(scanStatus)} size="md">
                  {getScanStatusLabel(scanStatus, t)}
                </WmsStatusChip>
                {scanner.scanError ? <span>{scanner.scanError}</span> : null}
                {scanFeedback.status === 'found' ? <span>{t('wms.shell.scanner.lastFound', 'Last found: {{title}}', { title: scanFeedback.title })}</span> : null}
                {scanFeedback.status === 'multiple' ? <span>{scanFeedback.meta || t('wms.shell.scanner.chooseMultiple', 'Choose from multiple matches')}</span> : null}
              </div>
              {renderScannerInput('mode')}
              <div className="wmsShellScanModeGrid">
                <div className="wmsShellScanModePicker">
                  <span className="wmsShellScanRecentTitle">{t('wms.shell.scanner.matches', 'Matches')}</span>
                  {renderScanResults('mode') || <div className="wmsShellScanRecentEmpty">{t('wms.shell.scanner.scanPrompt', 'Scan a barcode, SKU, or EAN.')}</div>}
                </div>
                {renderRecentScans('mode')}
              </div>
            </div>
          </div>
        ) : null}

        {isCorrectionMode ? (
          <div className="wmsShellSummaryBar">
            <span className="wmsShellSummaryMetric">{t('wms.corrections.select', 'Select')} <strong>{selectedCorrectionRows.length}</strong></span>
            <span className="wmsShellSummaryMetric">{t('wms.summary.qtyTotal', 'Total qty')} <strong>{selectedCorrectionQty}</strong></span>
            <WmsStatusChip status={selectedCorrectionRows.length ? 'warning' : 'draft'} size="sm" className="wmsShellSummaryChip">
              {t('wms.corrections.create', 'Create correction')}
            </WmsStatusChip>
          </div>
        ) : isPostedMode ? (
          <div className="wmsShellSummaryBar">
            <span className="wmsShellSummaryMetric">{t('wms.shell.rows.lines', 'Lines')} <strong>{postedSummary.lines}</strong></span>
            <span className="wmsShellSummaryMetric">{postedPrimarySummaryLabel} <strong>{postedSummary.primaryQty}</strong></span>
            <span className="wmsShellSummaryMetric">{postedSecondarySummaryLabel} <strong>{postedSummary.secondaryQty}</strong></span>
            {config?.kindKey === 'cycleCount' ? (
              <span className="wmsShellSummaryMetric">{t('wms.cycleCounts.columns.diff', 'Difference')} <strong>{postedSummary.varianceQty}</strong></span>
            ) : null}
            <span className="wmsShellSummaryMetric">{t('wms.shell.posted.movements', 'Movements')} <strong>{postedSummary.movementsCount}</strong></span>
          </div>
        ) : (
          <div className="wmsShellSummaryBar">
            <span className="wmsShellSummaryMetric">{t('wms.shell.rows.lines', 'Lines')} <strong>{summary.lines}</strong></span>
            <span className="wmsShellSummaryMetric">{t('wms.summary.qtyTotal', 'Total qty')} <strong>{summary.totalQty}</strong></span>
            <WmsStatusChip status={summary.warningCount ? 'warning' : 'active'} size="sm" className="wmsShellSummaryChip">
              {t('wms.summary.warningCount', 'Warnings')} {summary.warningCount}
            </WmsStatusChip>
            <WmsStatusChip status={summary.blockingCount ? 'error' : 'active'} size="sm" className="wmsShellSummaryChip">
              {t('wms.summary.blockingCount', 'Blocking')} {summary.blockingCount}
            </WmsStatusChip>
          </div>
        )}
      </section>
    </div>
  );
}
