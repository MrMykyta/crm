import { useEffect, useMemo, useRef, useState } from 'react';
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

function normalizeInitialRows(rows, config) {
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

function getShellHeaderFields(config = {}) {
  const fields = getConfigHeaderFields(config);
  const shellKeys = getShellHeaderKeys(config);
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

function getHeaderFieldLabel(field = {}, mode = '') {
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
  const base = field.label || labels[field.key] || field.key;
  return isHeaderFieldRequired(field, mode) ? `${base} *` : base;
}

function getHeaderFieldPlaceholder(field = {}) {
  const placeholders = {
    warehouseId: 'Select warehouse',
    fromWarehouseId: 'Select source warehouse',
    toWarehouseId: 'Select target warehouse',
    inboundLocationId: 'Warehouse-level stock',
    sourceLocationId: 'Source warehouse-level stock',
    targetLocationId: 'Target warehouse-level stock',
    fromLocationId: 'Source warehouse-level stock',
    toLocationId: 'Target warehouse-level stock',
    locationId: 'Warehouse-level stock',
    reason: 'Enter reason',
  };
  return placeholders[field.key] || '';
}

function getLocationWarehouseId(fieldKey = '', header = {}) {
  if (fieldKey === 'sourceLocationId' || fieldKey === 'fromLocationId') return header.fromWarehouseId || '';
  if (fieldKey === 'targetLocationId' || fieldKey === 'toLocationId') return header.toWarehouseId || '';
  return header.warehouseId || '';
}

function getDeferredActionLabel(config = {}) {
  if (config.kindKey === 'cycleCount') return 'Reconcile deferred';
  if (config.kindKey === 'transfer') return 'Execute deferred';
  if (config.kindKey === 'shipment') return 'Ship deferred';
  if (config.kindKey === 'adjustment') return 'Post deferred';
  return 'Receive deferred';
}

function getOperationLabel(mode = '') {
  if (mode === 'reconcile') return 'Reconcile';
  if (mode === 'post') return 'Post';
  if (mode === 'execute') return 'Execute all';
  if (mode === 'ship') return 'Ship all';
  return 'Receive all';
}

function getOperationProgressLabel(mode = '') {
  if (mode === 'reconcile') return 'Reconciling...';
  if (mode === 'post') return 'Posting...';
  if (mode === 'execute') return 'Executing...';
  if (mode === 'ship') return 'Shipping...';
  return 'Receiving...';
}

function getOperationAction(mode = '') {
  if (mode === 'reconcile') return 'reconcileExisting';
  if (mode === 'post') return 'postExisting';
  if (mode === 'execute') return 'executeExisting';
  if (mode === 'ship') return 'shipExisting';
  return 'receiveExisting';
}

function getOperationErrorMessage(mode = '') {
  if (mode === 'reconcile') return 'Failed to reconcile cycle count.';
  if (mode === 'post') return 'Failed to post adjustment.';
  if (mode === 'execute') return 'Failed to execute transfer.';
  if (mode === 'ship') return 'Failed to ship shipment.';
  return 'Failed to receive receipt.';
}

function getOperationEmptyMessage(mode = '') {
  if (mode === 'execute') return 'No remaining rows to execute.';
  if (mode === 'ship') return 'No remaining rows to ship.';
  return 'No remaining rows to receive.';
}

function getOperationNotice(mode = '') {
  if (mode === 'reconcile') return 'Cycle count was reconciled. Opening the latest document view...';
  if (mode === 'post') return 'Adjustment was posted. Opening the latest document view...';
  if (mode === 'execute') return 'Transfer was executed. Opening the latest document view...';
  if (mode === 'ship') return 'Shipment was shipped. Opening the latest document view...';
  return 'Receipt was received. Opening the latest document view...';
}

function getModeTitle(mode = '') {
  if (mode === 'draft') return 'draft';
  if (mode === 'reconcile') return 'reconcile';
  if (mode === 'post') return 'post';
  if (mode === 'ship') return 'ship';
  if (mode === 'execute') return 'execute';
  return 'create';
}

function getModeSubtitle(mode = '', badge = '') {
  if (mode === 'draft') return `WMS Shell MVP - ${badge} draft edit`;
  if (mode === 'reconcile') return `WMS Shell MVP - ${badge} reconcile existing`;
  if (mode === 'post') return `WMS Shell MVP - ${badge} post existing`;
  if (mode === 'ship') return `WMS Shell MVP - ${badge} ship existing`;
  if (mode === 'execute') return `WMS Shell MVP - ${badge} execute existing`;
  return `WMS Shell MVP - ${badge} create only`;
}

function isOperationMode(mode = '') {
  return mode === 'draft' || mode === 'post' || mode === 'reconcile' || mode === 'ship' || mode === 'execute';
}

function isDocumentOperationMode(mode = '') {
  return mode === 'post' || mode === 'reconcile';
}

function getRemainingQty(row = {}, mode = '', qtyField = 'qty') {
  if (mode === 'execute') return asNumber(row[qtyField], 0) - asNumber(row.movedQty, 0);
  if (mode === 'ship') return asNumber(row[qtyField], 0) - asNumber(row.qtyShipped, 0);
  return asNumber(row[qtyField], 0) - asNumber(row.qtyReceived, 0);
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
  onSaveSuccess,
  onCancel,
}) {
  const [header, setHeader] = useState(() => buildInitialHeader(config, initialHeader));
  const qtyField = getQtyField(config);
  const headerFields = useMemo(() => getShellHeaderFields(config), [config]);
  const rowControllerEnabled = useMemo(() => isRowControllerEnabled(config), [config]);
  const [rows, setRows] = useState(() => normalizeInitialRows(initialRows, config));
  const [baselineHeader, setBaselineHeader] = useState(() => ({ ...(originalHeader || initialHeader || {}) }));
  const [baselineRows, setBaselineRows] = useState(() => normalizeInitialRows(originalRows || initialRows, config));
  const [removedItemIds, setRemovedItemIds] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [rowErrors, setRowErrors] = useState({});
  const [rowWarnings, setRowWarnings] = useState({});
  const [documentError, setDocumentError] = useState('');
  const [documentNotice, setDocumentNotice] = useState('');
  const [operationConfirm, setOperationConfirm] = useState(null);
  const [isSaving, setSaving] = useState(false);
  const [isReceiving, setReceiving] = useState(false);
  const rowControllerRef = useRef(null);
  const scannerRowApi = useMemo(() => ({
    addOrFillFromProductPicker: (row) => rowControllerRef.current?.addOrFillFromProductPicker?.(row),
    focusQty: (localId) => rowControllerRef.current?.focusQty?.(localId),
    focusFirstEmptyProduct: () => rowControllerRef.current?.focusFirstEmptyProduct?.(),
  }), []);
  const scanner = useScannerModule({
    config,
    enabled: mode === 'draft',
    queryProductPicker: searchProducts,
    rowApi: scannerRowApi,
    resetKey,
  });

  useEffect(() => {
    const nextHeader = buildInitialHeader(config, initialHeader);
    setHeader(nextHeader);
    setRows(normalizeInitialRows(initialRows, config));
    setBaselineHeader({ ...(originalHeader || initialHeader || {}) });
    setBaselineRows(normalizeInitialRows(originalRows || initialRows, config));
    setRemovedItemIds([]);
    setFieldErrors({});
    setRowErrors({});
    setRowWarnings({});
    setDocumentError('');
    setDocumentNotice('');
    setOperationConfirm(null);
  }, [config, initialHeader, initialRows, originalHeader, originalRows, resetKey]);

  const warehouseOptions = useMemo(() => [
    { value: '', label: 'Select warehouse' },
    ...warehouses.map((row) => ({ value: row.id, label: formatWarehouseLabel(row) })),
  ], [warehouses]);

  const locationOptions = useMemo(() => {
    const filtered = locations.filter((row) => !header.warehouseId || row.warehouseId === header.warehouseId);
    return [
      { value: '', label: 'Warehouse-level stock' },
      ...filtered.map((row) => ({ value: row.id, label: formatLocationLabel(row) })),
    ];
  }, [header.warehouseId, locations]);

  const getLocationOptions = (fieldKey) => {
    const warehouseId = getLocationWarehouseId(fieldKey, header);
    const filtered = locations.filter((row) => !warehouseId || row.warehouseId === warehouseId);
    const placeholder = fieldKey === 'targetLocationId' || fieldKey === 'toLocationId'
      ? 'Target warehouse-level stock'
      : fieldKey === 'sourceLocationId' || fieldKey === 'fromLocationId'
        ? 'Source warehouse-level stock'
        : 'Warehouse-level stock';
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
    const label = getHeaderFieldLabel(field, mode);
    const value = header[field.key] || '';
    const disabled = isSaving
      || isReceiving
      || mode === 'post'
      || mode === 'reconcile'
      || ((mode === 'ship' || mode === 'execute') && field.type !== 'locationSelect');
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
            placeholder={getHeaderFieldPlaceholder(field) || 'Select warehouse'}
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
            placeholder={getHeaderFieldPlaceholder(field) || 'Warehouse-level stock'}
            disabled={disabled}
          />
          {!value ? <span className="wmsShellHint">{getHeaderFieldPlaceholder(field) || 'Warehouse-level stock'}</span> : null}
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
          {mode === 'draft' ? <span className="wmsShellHint">Date is read-only in SHELL-2A.</span> : null}
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
            placeholder={getHeaderFieldPlaceholder(field)}
            disabled={disabled}
          />
          {fieldErrors[field.key] ? <span className="wmsShellFieldError">{fieldErrors[field.key]}</span> : null}
        </label>
      );
    }
    return null;
  };

  const applyValidation = () => {
    setFieldErrors(validation.fieldErrors);
    setRowErrors(validation.rowErrors);
    setRowWarnings(validation.rowWarnings);
    if (rowControllerEnabled && !validation.committableRows.length) {
      setDocumentError(validation.documentMessages[0] || 'Add at least one product row before saving.');
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
      setDocumentError('Save is not available for this document.');
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
      setDocumentError(getDocumentError(result) || 'Failed to save draft.');
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
    const loaded = await runAdapterAction('loadDraft', { id: documentId }, 'Failed to reload receipt draft.');
    const latestReceipt = loaded.raw?.data || loaded.raw || {};
    return {
      result: loaded,
      receipt: latestReceipt,
      draft: mapReceiptToShellDraft(latestReceipt, config),
    };
  };

  const saveDraftDiff = async () => {
    if (!documentId) throw new Error('Document id is required.');

    const baselineById = new Map(
      baselineRows
        .filter((row) => row.id)
        .map((row) => [row.id, row])
    );

    await runAdapterAction('updateDraftHeader', {
      id: documentId,
      header,
      baselineHeader,
    }, 'Failed to update receipt header.');

    for (const itemId of removedItemIds) {
      // eslint-disable-next-line no-await-in-loop
      await runAdapterAction('removeItem', { id: documentId, itemId }, 'Failed to remove receipt line.');
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
        }, 'Failed to update receipt line.');
      } else {
        // eslint-disable-next-line no-await-in-loop
        await runAdapterAction('addItem', {
          id: documentId,
          row,
        }, 'Failed to add receipt line.');
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
    setRows(normalizeInitialRows(nextRows, config));
  };

  const onRemoveRow = (_localId, row) => {
    if (row?.id) {
      setRemovedItemIds((prev) => (prev.includes(row.id) ? prev : [...prev, row.id]));
    }
    setRows((prev) => normalizeInitialRows(prev.filter((entry) => entry.localId !== row.localId), config));
  };

  const onRunOperationAll = async ({ confirmed = false } = {}) => {
    setDocumentError('');
    setDocumentNotice('');
    if (!isOperationMode(mode) || !documentId) return;
    if (mode === 'draft' && !applyValidation()) return;
    const action = getOperationAction(mode);
    if (!adapter?.supports?.(action)) {
      setDocumentError(`${getOperationLabel(mode).replace(' all', '')} is not available for this document.`);
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
        setDocumentError(getOperationEmptyMessage(mode));
        return;
      }

      const result = await adapter.run(action, {
        id: documentId,
        header: sourceHeader,
        rows: persistedRows,
      });

      if (!result?.ok) {
        setDocumentError(getDocumentError(result) || getOperationErrorMessage(mode));
        return;
      }

      setOperationConfirm(null);
      setDocumentNotice(getOperationNotice(mode));
      onSaveSuccess?.(result);
    } catch (error) {
      setDocumentError(error?.message || getOperationErrorMessage(mode));
    } finally {
      setReceiving(false);
    }
  };

  const badge = config?.badge || 'PZ';
  const title = `${badge} ${getModeTitle(mode)}`;

  return (
    <div className="wmsShellPage" data-testid="wms-document-shell">
      <section className="wmsShellCard">
        <div className="wmsShellDocumentBar">
          <div>
            <div className="wmsShellTitleRow">
              <span className="wmsShellBadge">{badge}</span>
              <h1>{title}</h1>
              <span className="wmsShellMode">{mode}</span>
            </div>
            <p>{getModeSubtitle(mode, badge)}</p>
          </div>
          <div className="wmsShellActions">
            <button type="button" className="wmsShellButton" onClick={onCancel} disabled={isSaving || isReceiving}>
              Cancel
            </button>
            {mode === 'create' ? (
              <button type="button" className="wmsShellButton" disabled>
                {getDeferredActionLabel(config)}
              </button>
            ) : (
              <button
                type="button"
                className="wmsShellPrimaryButton"
                onClick={() => onRunOperationAll()}
                disabled={isSaving || isReceiving || (mode === 'draft' && validation.blockingCount > 0) || !hasOperationCandidates}
              >
                {isReceiving ? getOperationProgressLabel(mode) : getOperationLabel(mode)}
              </button>
            )}
            {mode !== 'post' && mode !== 'reconcile' && mode !== 'ship' && mode !== 'execute' ? (
              <button type="button" className="wmsShellButton" onClick={onSaveDraft} disabled={isSaving || isReceiving}>
                {isSaving ? 'Saving...' : 'Save draft'}
              </button>
            ) : null}
          </div>
        </div>

        {documentError ? <div className="wmsShellErrorBanner">{documentError}</div> : null}
        {documentNotice ? <div className="wmsShellNoticeBanner">{documentNotice}</div> : null}
        {mode === 'draft' ? (
          <div className="wmsShellReceiveWarning">
            Receive will post stock movements. Save draft first.
          </div>
        ) : null}
        {mode === 'ship' ? (
          <div className="wmsShellReceiveWarning">
            Ship all will post stock movements for remaining persisted rows.
          </div>
        ) : null}
        {mode === 'execute' ? (
          <div className="wmsShellReceiveWarning">
            Execute all will post stock movements for remaining persisted rows.
          </div>
        ) : null}
        {mode === 'post' ? (
          <div className="wmsShellReceiveWarning">
            Post will apply the existing draft adjustment.
          </div>
        ) : null}
        {mode === 'reconcile' ? (
          <div className="wmsShellReceiveWarning">
            Reconcile will apply counted differences and may create RW/PW adjustments.
          </div>
        ) : null}
        {operationConfirm ? (
          <div className="wmsShellReceiveWarning" role="dialog" aria-modal="true">
            <strong>{operationConfirm.title || 'Confirm operation'}</strong>
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
                Cancel
              </button>
              <button
                type="button"
                className="wmsShellPrimaryButton"
                onClick={() => onRunOperationAll({ confirmed: true })}
                disabled={isReceiving}
              >
                {isReceiving ? getOperationProgressLabel(mode) : (operationConfirm.confirmLabel || getOperationLabel(mode))}
              </button>
            </div>
          </div>
        ) : null}

        <div className="wmsShellBody">
          <aside className="wmsShellHeaderRail">
            <h2>Header</h2>
            {headerFields.map(renderHeaderField)}
          </aside>

          {rowControllerEnabled ? (
            <main className="wmsShellWorkspace">
              <div className="wmsShellWorkspaceHeader">
                <h2>Items</h2>
                <span>{mode === 'draft' ? 'Enter commits qty and returns to scan' : 'Enter commits qty and focuses next row'}</span>
              </div>
              {mode === 'draft' ? (
                <div className="wmsShellScanBar" data-testid="wms-shell-scan-bar">
                  <label className="wmsShellScanField">
                    <span>Scan / Quick add</span>
                    <input
                      ref={scanner.scanInputRef}
                      className="wmsShellInput wmsShellScanInput"
                      value={scanner.scanQuery}
                      onChange={(event) => scanner.setScanQuery(event.target.value)}
                      onKeyDown={scanner.onScanKeyDown}
                      placeholder="Scan barcode / SKU / EAN"
                      disabled={isSaving || isReceiving}
                      autoComplete="off"
                    />
                  </label>
                  <div className="wmsShellScanMeta">
                    <span>F2</span>
                    <span>Enter resolves</span>
                    <span>Esc clears</span>
                  </div>
                  {scanner.isScanning ? <div className="wmsShellScanState">Searching...</div> : null}
                  {scanner.scanError ? <div className="wmsShellScanError">{scanner.scanError}</div> : null}
                  {scanner.scanResults.length ? (
                    <div className="wmsShellScanResults">
                      {scanner.scanResults.slice(0, 8).map((result) => {
                        const key = scanner.getScanResultKey(result);
                        return (
                          <button
                            type="button"
                            key={key}
                            className="wmsShellScanResult"
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
                  ) : null}
                </div>
              ) : null}
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
              />
            </main>
          ) : null}
        </div>

        <div className="wmsShellSummaryBar">
          <span className="wmsShellSummaryMetric">Lines <strong>{summary.lines}</strong></span>
          <span className="wmsShellSummaryMetric">Total qty <strong>{summary.totalQty}</strong></span>
          <WmsStatusChip status={summary.warningCount ? 'warning' : 'active'} size="sm" className="wmsShellSummaryChip">
            Warnings {summary.warningCount}
          </WmsStatusChip>
          <WmsStatusChip status={summary.blockingCount ? 'error' : 'active'} size="sm" className="wmsShellSummaryChip">
            Blocking {summary.blockingCount}
          </WmsStatusChip>
        </div>
      </section>
    </div>
  );
}
