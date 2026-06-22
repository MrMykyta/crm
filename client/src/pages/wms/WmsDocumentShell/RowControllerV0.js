import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getCellRenderer,
  getColumnLabel,
  getRowColumns,
} from './cellRenderers';
import { getKeyboardPreset } from './keyboardPresets';
import {
  createEmptyRow,
  isAutoRowEnabled,
  isCommittableRow,
  isRowEmpty,
  mapProductPickerRowToPzRowPatch,
  normalizeProductPickerRows,
  normalizeRows,
} from './rowControllerModel';

function hasIssues(issues = {}) {
  return Object.values(issues || {}).some(Boolean);
}

function getRowVisualClass({ empty, rowErrors = {}, rowWarnings = {} }) {
  if (hasIssues(rowErrors)) return 'wmsShellRowStateError';
  if (hasIssues(rowWarnings)) return 'wmsShellRowStateWarning';
  if (empty) return 'wmsShellEmptyRow wmsShellRowStateEmpty';
  return 'wmsShellReadyRow wmsShellRowStateReady';
}

const RowControllerV0 = forwardRef(function RowControllerV0({
  config,
  rows,
  errors = {},
  warnings = {},
  disabled = false,
  searchProducts,
  onRowsChange,
  onRemoveRow,
  onQtyCommit,
  labels = {},
}, ref) {
  const { t } = useTranslation();
  const [picker, setPicker] = useState({ rowId: '', query: '', results: [], busy: false, error: '' });
  const qtyRefs = useRef({});
  const productRefs = useRef({});
  const columns = useMemo(() => getRowColumns(config), [config]);
  const autoRowEnabled = useMemo(() => isAutoRowEnabled(config), [config]);
  const keyboard = useMemo(() => (
    getKeyboardPreset(config?.rowController?.keyboardPreset)
  ), [config?.rowController?.keyboardPreset]);
  const translatedLabels = useMemo(() => ({
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
    stock: t('wms.shell.product.stock', 'Stock'),
    cost: t('wms.shell.product.cost', 'Cost'),
    trailingEmpty: t('wms.shell.rows.trailingEmpty', 'New row is ready'),
    unnamedProduct: t('wms.shell.product.unnamed', 'Product'),
    translate: t,
    ...labels,
  }), [labels, t]);

  const getPickerAnchor = (localId) => {
    const node = productRefs.current[localId];
    if (!node || typeof node.getBoundingClientRect !== 'function') return null;
    const rect = node.getBoundingClientRect();
    const summary = document.querySelector('.wmsShellSummaryBar')?.getBoundingClientRect?.();
    const scanner = document.querySelector('.wmsShellScanBar')?.getBoundingClientRect?.();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1280;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 720;
    const safeBottom = (summary?.top || viewportHeight) - 8;
    const safeTop = (scanner?.bottom || 0) + 8;
    const left = Math.min(Math.max(12, rect.left), Math.max(12, viewportWidth - 292));
    const width = Math.min(360, Math.max(300, rect.width + 116, viewportWidth - left - 12));
    const availableBelow = safeBottom - rect.bottom - 8;
    const availableAbove = rect.top - safeTop - 6;
    if (availableBelow < 210 && availableAbove > availableBelow) {
      const maxHeight = Math.max(130, Math.min(220, availableAbove - 6));
      return {
        left,
        maxHeight,
        top: Math.max(safeTop, rect.top - maxHeight - 6),
        width,
      };
    }
    return {
      left,
      maxHeight: Math.max(130, Math.min(220, availableBelow)),
      top: rect.bottom + 6,
      width,
    };
  };

  const openPicker = (rowId, patch = {}) => {
    setPicker((prev) => ({
      ...prev,
      rowId,
      anchor: getPickerAnchor(rowId),
      ...patch,
    }));
  };

  useEffect(() => {
    if (!Array.isArray(rows) || rows.length === 0) {
      onRowsChange([createEmptyRow(config)]);
      return;
    }
    if (!autoRowEnabled) return;
    const trailingEmpty = rows.filter((row) => isRowEmpty(row, config)).length;
    if (trailingEmpty !== 1 || !isRowEmpty(rows[rows.length - 1], config)) {
      onRowsChange(normalizeRows(rows, config));
    }
  }, [autoRowEnabled, config, onRowsChange, rows]);

  useEffect(() => {
    const query = String(picker.query || '').trim();
    if (!picker.rowId || query.length < 1 || typeof searchProducts !== 'function') {
      setPicker((prev) => ({ ...prev, results: [], busy: false, error: '' }));
      return undefined;
    }

    let cancelled = false;
    setPicker((prev) => ({ ...prev, busy: true, error: '' }));
    const timeoutId = setTimeout(async () => {
      try {
        const result = await searchProducts(query);
        if (!cancelled) {
          setPicker((prev) => ({ ...prev, results: normalizeProductPickerRows(result), busy: false, error: '' }));
        }
      } catch (error) {
        if (!cancelled) {
          setPicker((prev) => ({
            ...prev,
            results: [],
            busy: false,
            error: error?.message || translatedLabels.searchFailed || 'Search failed',
          }));
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [picker.query, picker.rowId, searchProducts, translatedLabels.searchFailed]);

  useEffect(() => {
    if (!picker.rowId) return undefined;
    const updateAnchor = () => {
      setPicker((prev) => (
        prev.rowId ? { ...prev, anchor: getPickerAnchor(prev.rowId) } : prev
      ));
    };
    window.addEventListener('resize', updateAnchor);
    window.addEventListener('scroll', updateAnchor, true);
    return () => {
      window.removeEventListener('resize', updateAnchor);
      window.removeEventListener('scroll', updateAnchor, true);
    };
  }, [picker.rowId]);

  const committableCount = useMemo(() => rows.filter((row) => isCommittableRow(row, config)).length, [config, rows]);

  const updateRow = (localId, patch) => {
    onRowsChange(normalizeRows(rows.map((row) => (row.localId === localId ? { ...row, ...patch } : row)), config));
  };

  const addManualRow = () => {
    onRowsChange([...rows, createEmptyRow(config)]);
  };

  const focusNextProduct = (localId) => {
    const index = rows.findIndex((row) => row.localId === localId);
    const next = rows[index + 1] || rows[rows.length - 1];
    window.requestAnimationFrame(() => {
      productRefs.current[next?.localId]?.focus?.();
    });
  };

  const focusQty = (localId) => {
    window.requestAnimationFrame(() => {
      qtyRefs.current[localId]?.focus?.();
      qtyRefs.current[localId]?.select?.();
    });
  };

  const focusFirstEmptyProduct = () => {
    const next = rows.find((row) => isRowEmpty(row, config)) || rows[rows.length - 1];
    window.requestAnimationFrame(() => {
      productRefs.current[next?.localId]?.focus?.();
    });
  };

  const addOrFillFromProductPicker = (productRow) => {
    const payload = mapProductPickerRowToPzRowPatch(productRow);
    const target = rows[rows.length - 1] && isRowEmpty(rows[rows.length - 1], config)
      ? rows[rows.length - 1]
      : rows.find((row) => isRowEmpty(row, config)) || createEmptyRow(config);
    const exists = rows.some((row) => row.localId === target.localId);
    const filledRow = { ...target, ...payload };
    const nextRows = exists
      ? rows.map((row) => (row.localId === target.localId ? filledRow : row))
      : [...rows, filledRow];
    onRowsChange(normalizeRows(nextRows, config));
    setPicker({ rowId: '', query: '', results: [], busy: false, error: '' });
    return { localId: target.localId, row: filledRow };
  };

  useImperativeHandle(ref, () => ({
    addOrFillFromProductPicker,
    focusQty,
    focusFirstEmptyProduct,
  }));

  const selectProduct = (localId, productRow) => {
    const payload = mapProductPickerRowToPzRowPatch(productRow);
    updateRow(localId, payload);
    setPicker({ rowId: '', query: '', results: [], busy: false, error: '' });
    focusQty(localId);
  };

  const onProductInputChange = (row, column, value) => {
    const patch = { [column.inputField || column.key]: value };
    (column.clearFields || []).forEach((field) => {
      patch[field] = '';
    });
    updateRow(row.localId, patch);
    openPicker(row.localId, { query: value, results: [], busy: true, error: '' });
  };

  const closePicker = () => {
    setPicker({ rowId: '', query: '', results: [], busy: false, error: '' });
  };

  const onCellKeyDown = (event, row, column) => {
    keyboard.handleKeyDown(event, {
      column,
      config,
      editableColumns: keyboard.getEditableColumns?.(config) || [],
      focusFirstEmptyProduct,
      focusNextProduct,
      focusQty,
      closePicker,
      onQtyCommit,
      picker,
      row,
      rows,
    });
  };

  return (
    <div>
      <div className="wmsShellItemsMeta">
        <span>{translatedLabels.lines}: {committableCount}</span>
        <span>{autoRowEnabled ? translatedLabels.trailingEmpty : translatedLabels.manualRows}</span>
        {!autoRowEnabled ? (
          <button
            type="button"
            className="wmsShellButton"
            onClick={addManualRow}
            disabled={disabled}
          >
            {translatedLabels.addLine}
          </button>
        ) : null}
      </div>
      <div className="wmsShellTableWrap">
        <table className="wmsShellTable">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={column.headerClassName || ''}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {getColumnLabel(column, translatedLabels)}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const empty = isRowEmpty(row, config);
              const rowErrors = errors[row.localId] || {};
              const rowWarnings = warnings[row.localId] || {};
              const rowClassName = getRowVisualClass({ empty, rowErrors, rowWarnings });
              return (
                <tr key={row.localId} className={rowClassName}>
                  {columns.map((column) => {
                    const CellRenderer = getCellRenderer(column);
                    return (
                      <td key={column.key} className={column.cellClassName || ''}>
                        <CellRenderer
                          column={column}
                          config={config}
                          disabled={disabled}
                          empty={empty}
                          labels={translatedLabels}
                          picker={picker}
                          productRefs={productRefs}
                          qtyRefs={qtyRefs}
                          row={row}
                          rowErrors={rowErrors}
                          rowWarnings={rowWarnings}
                          onCellKeyDown={onCellKeyDown}
                          onProductInputChange={onProductInputChange}
                          openPicker={openPicker}
                          selectProduct={selectProduct}
                          setPicker={setPicker}
                          updateRow={updateRow}
                        />
                      </td>
                    );
                  })}
                  <td>
                    {!empty ? (
                      <button
                        type="button"
                        className="wmsShellIconButton"
                        onClick={() => onRemoveRow?.(row.localId, row)}
                        disabled={disabled}
                        aria-label={translatedLabels.removeRow}
                      >
                        ×
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default RowControllerV0;
