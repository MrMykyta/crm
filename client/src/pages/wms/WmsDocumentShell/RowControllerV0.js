import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
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
  const [picker, setPicker] = useState({ rowId: '', query: '', results: [], busy: false, error: '' });
  const qtyRefs = useRef({});
  const productRefs = useRef({});
  const columns = useMemo(() => getRowColumns(config), [config]);
  const autoRowEnabled = useMemo(() => isAutoRowEnabled(config), [config]);
  const keyboard = useMemo(() => (
    getKeyboardPreset(config?.rowController?.keyboardPreset)
  ), [config?.rowController?.keyboardPreset]);

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
            error: error?.message || labels.searchFailed || 'Search failed',
          }));
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [labels.searchFailed, picker.query, picker.rowId, searchProducts]);

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
    setPicker({ rowId: row.localId, query: value, results: [], busy: true, error: '' });
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
        <span>{labels.lines || 'Lines'}: {committableCount}</span>
        <span>{autoRowEnabled ? (labels.trailingEmpty || 'New row is ready') : (labels.manualRows || 'Manual rows')}</span>
        {!autoRowEnabled ? (
          <button
            type="button"
            className="wmsShellButton"
            onClick={addManualRow}
            disabled={disabled}
          >
            {labels.addLine || 'Add line'}
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
                  {getColumnLabel(column, labels)}
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
                          labels={labels}
                          picker={picker}
                          productRefs={productRefs}
                          qtyRefs={qtyRefs}
                          row={row}
                          rowErrors={rowErrors}
                          rowWarnings={rowWarnings}
                          onCellKeyDown={onCellKeyDown}
                          onProductInputChange={onProductInputChange}
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
                        aria-label={labels.removeRow || 'Remove row'}
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
