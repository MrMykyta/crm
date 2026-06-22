import { createPortal } from 'react-dom';

import {
  getDetailSectionForColumn,
  renderDetailSection,
} from './detailSectionRenderers.js';
import { WmsStatusChip } from '../../../components/wms/ui';
import { asText, getQtyField, mapProductPickerRowToPzRowPatch } from './rowControllerModel.js';

function readFirstText(row = {}, fields = []) {
  for (const field of fields) {
    const value = asText(row?.[field]);
    if (value) return value;
  }
  return '';
}

function resolveColumnField(column = {}, config = {}) {
  if (column.key === '$qtyField' || column.type === 'qty') return getQtyField(config);
  return column.key;
}

function translate(labels = {}, key = '', fallback = '', options) {
  return typeof labels.translate === 'function' && key ? labels.translate(key, fallback, options) : fallback;
}

function getColumnLabel(column = {}, labels = {}) {
  if (column.labelKey) return translate(labels, column.labelKey, column.label || column.fallbackLabel || column.key || '');
  return column.label || labels[column.key] || column.fallbackLabel || column.key || '';
}

function formatProductLabel(row = {}, column = {}) {
  const name = readFirstText(row, column.displayNameFields || []);
  const code = readFirstText(row, column.displayCodeFields || []);
  if (name && code) return `${name} - ${code}`;
  return name || code || '';
}

function readProductImage(row = {}) {
  return asText(row.imageUrl || row.thumbnailUrl || row.productImageUrl || row.product?.imageUrl || row.product?.thumbnailUrl);
}

function getProductInitial(row = {}, fallback = '') {
  const text = asText(row.productName || row.name || row.sku || fallback);
  return text ? text.slice(0, 1).toUpperCase() : 'P';
}

function renderProductCell(ctx) {
  const {
    column,
    disabled,
    labels,
    picker,
    productRefs,
    row,
    rowErrors,
    openPicker,
    onCellKeyDown,
    onProductInputChange,
    selectProduct,
    setPicker,
  } = ctx;
  const productLabel = formatProductLabel(row, column);
  const pickerOpen = picker.rowId === row.localId;
  const errorField = column.errorField || column.key;
  const imageUrl = readProductImage(row);
  const pickerDropdown = pickerOpen ? (
    <div
      className="wmsShellPicker"
      style={picker.anchor ? {
        left: picker.anchor.left,
        maxHeight: picker.anchor.maxHeight,
        top: picker.anchor.top,
        width: picker.anchor.width,
      } : undefined}
    >
      {picker.busy ? <div className="wmsShellPickerState">{labels.searching || 'Searching...'}</div> : null}
      {picker.error ? <div className="wmsShellPickerState">{picker.error}</div> : null}
      {!picker.busy && !picker.error && picker.query && !picker.results.length ? (
        <div className="wmsShellPickerState">{labels.noProducts || 'No products found'}</div>
      ) : null}
      {!picker.query ? (
        <div className="wmsShellPickerState">{labels.startTyping || 'Start typing product / SKU / EAN'}</div>
      ) : null}
      {picker.results.slice(0, 8).map((result) => {
        const picked = mapProductPickerRowToPzRowPatch(result);
        const title = asText(picked[column.resultTitleField]) || labels.unnamedProduct || 'Product';
        const code = asText(picked[column.resultCodeField]);
        const available = asText(result.available ?? result.availableQty ?? result.stockAvailable);
        const cost = asText(result.unitCost ?? result.cost ?? result.lastCost);
        const key = [
          asText(picked[column.resultIdField]),
          asText(picked[column.resultVariantField]) || 'base',
        ].join(':');
        return (
          <button
            type="button"
            key={key}
            className="wmsShellPickerRow"
            onMouseDown={(event) => {
              event.preventDefault();
              selectProduct(row.localId, result);
            }}
          >
            <span className="wmsShellPickerThumb" aria-hidden="true">{getProductInitial(picked, title)}</span>
            <span className="wmsShellPickerMain">
              <strong>{title}</strong>
              <span>{code ? `${column.resultCodeLabel || 'SKU'} ${code}` : labels.noSku || 'No SKU'}</span>
            </span>
            <span className="wmsShellPickerMeta">
              {available ? <span>{labels.stock || 'Stock'} {available}</span> : null}
              {cost ? <span>{labels.cost || 'Cost'} {cost}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div className="wmsShellProductCell">
      <div className="wmsShellProductCellFrame">
        <span className="wmsShellProductThumb" aria-hidden="true">
          {imageUrl ? <img src={imageUrl} alt="" /> : getProductInitial(row, productLabel)}
        </span>
        <div className="wmsShellProductEditor">
          <input
            ref={(node) => { productRefs.current[row.localId] = node; }}
            className="wmsShellInput wmsShellProductInput"
            value={productLabel}
            onChange={(event) => onProductInputChange(row, column, event.target.value)}
            onKeyDown={(event) => onCellKeyDown?.(event, row, column)}
            onFocus={() => {
              const nextPicker = {
                query: productLabel,
                results: [],
                busy: Boolean(productLabel),
                error: '',
              };
              if (typeof openPicker === 'function') {
                openPicker(row.localId, nextPicker);
              } else {
                setPicker({ rowId: row.localId, ...nextPicker });
              }
            }}
            placeholder={labels.productHint || column.placeholder || 'Start typing product / SKU / EAN'}
            disabled={disabled}
            autoComplete="off"
          />
          {asText(row.sku) ? <span className="wmsShellProductSubline">{row.sku}</span> : null}
        </div>
      </div>
      {pickerDropdown && typeof document !== 'undefined' ? createPortal(pickerDropdown, document.body) : pickerDropdown}
      {rowErrors[errorField] ? <div className="wmsShellFieldError">{rowErrors[errorField]}</div> : null}
    </div>
  );
}

function renderReadonlyCell({ column, row }) {
  return <span>{asText(row?.[column.key]) || '-'}</span>;
}

function renderQtyCell({ column, config, disabled, qtyRefs, row, rowErrors, updateRow, onCellKeyDown }) {
  const field = resolveColumnField(column, config);
  return (
    <>
      <input
        ref={(node) => { qtyRefs.current[row.localId] = node; }}
        className="wmsShellInput wmsShellQtyInput"
        type="number"
        min="0"
        step="0.0001"
        value={row[field]}
        onChange={(event) => updateRow(row.localId, { [field]: event.target.value })}
        onKeyDown={(event) => onCellKeyDown?.(event, row, column)}
        disabled={disabled}
      />
      {rowErrors[field] ? <div className="wmsShellFieldError">{rowErrors[field]}</div> : null}
    </>
  );
}

function renderTextInputCell({ column, disabled, row, rowWarnings, updateRow, onCellKeyDown }) {
  const field = column.key;
  return (
    <>
      <input
        className="wmsShellInput"
        value={row[field]}
        onChange={(event) => updateRow(row.localId, { [field]: event.target.value })}
        onKeyDown={(event) => onCellKeyDown?.(event, row, column)}
        disabled={disabled}
      />
      {rowWarnings[field] ? <div className="wmsShellFieldWarning">{rowWarnings[field]}</div> : null}
    </>
  );
}

function renderDetailSectionCell(ctx) {
  const section = getDetailSectionForColumn(ctx.config, ctx.column, {
    config: ctx.config,
    column: ctx.column,
    row: ctx.row,
  });
  if (section) return renderDetailSection(section, ctx);
  return renderTextInputCell(ctx);
}

function renderNumberCell({ column, disabled, row, rowWarnings, updateRow, onCellKeyDown }) {
  const field = column.key;
  return (
    <>
      <input
        className={column.inputClassName || 'wmsShellInput'}
        type="number"
        step={column.step || '0.0001'}
        value={row[field]}
        onChange={(event) => updateRow(row.localId, { [field]: event.target.value })}
        onKeyDown={(event) => onCellKeyDown?.(event, row, column)}
        disabled={disabled}
      />
      {rowWarnings[field] ? <div className="wmsShellFieldWarning">{rowWarnings[field]}</div> : null}
    </>
  );
}

function renderCurrencyCell({ column, disabled, row, updateRow, onCellKeyDown }) {
  const field = column.key;
  return (
    <input
      className={column.inputClassName || 'wmsShellInput'}
      value={row[field]}
      onChange={(event) => updateRow(row.localId, { [field]: event.target.value.toUpperCase() })}
      onKeyDown={(event) => onCellKeyDown?.(event, row, column)}
      disabled={disabled}
    />
  );
}

function renderStatusCell({ column, empty, labels, row, rowWarnings }) {
  const warningFields = Array.isArray(column.warningFields) ? column.warningFields : [];
  const status = empty ? 'draft' : 'active';
  return (
    <>
      <WmsStatusChip status={status} size="sm" className="wmsShellRowStateChip">
        {empty ? (labels.emptyRow || 'New row') : row.id ? (labels.persistedRow || 'Saved') : (labels.readyRow || 'Ready')}
      </WmsStatusChip>
      {warningFields.map((field) => (
        rowWarnings[field] ? <div key={field} className="wmsShellFieldWarning">{rowWarnings[field]}</div> : null
      ))}
    </>
  );
}

const cellRenderers = {
  product: renderProductCell,
  readonly: renderReadonlyCell,
  text: renderTextInputCell,
  qty: renderQtyCell,
  quantity: renderQtyCell,
  lot: renderDetailSectionCell,
  detail: renderDetailSectionCell,
  cost: renderNumberCell,
  currency: renderCurrencyCell,
  status: renderStatusCell,
};

function getCellRenderer(column = {}) {
  return cellRenderers[column.type] || renderReadonlyCell;
}

function getRowColumns(config = {}) {
  return Array.isArray(config.columns) ? config.columns : [];
}

export {
  cellRenderers,
  formatProductLabel,
  getCellRenderer,
  getColumnLabel,
  getRowColumns,
  resolveColumnField,
};

export default cellRenderers;
