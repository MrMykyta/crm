import { getQtyField, isCommittableRow } from './rowControllerModel.js';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isEditableColumn(column = {}) {
  return column.editable !== false;
}

function getEditableColumns(config = {}) {
  return asArray(config.columns).filter(isEditableColumn);
}

function isProductColumn(column = {}) {
  return column.type === 'product';
}

function isQtyColumn(column = {}, config = {}) {
  const qtyField = getQtyField(config);
  return column.type === 'qty' || column.type === 'quantity' || column.key === qtyField || column.key === '$qtyField';
}

function hasSelectedProduct(row = {}) {
  return Boolean(row.productId);
}

function handleProductKeyDown(event, ctx = {}) {
  if (event.key === 'Escape') {
    event.preventDefault();
    ctx.closePicker?.();
    return true;
  }

  if (event.key !== 'Enter') return false;
  if (!hasSelectedProduct(ctx.row)) return false;
  event.preventDefault();
  ctx.focusQty?.(ctx.row.localId);
  return true;
}

function handleQtyKeyDown(event, ctx = {}) {
  if (event.key !== 'Enter') return false;
  event.preventDefault();
  if (!isCommittableRow(ctx.row, ctx.config)) return true;
  if (typeof ctx.onQtyCommit === 'function') {
    ctx.onQtyCommit(ctx.row);
    return true;
  }
  ctx.focusNextProduct?.(ctx.row.localId);
  return true;
}

function handleWmsDefaultKeyDown(event, ctx = {}) {
  const column = ctx.column || {};
  if (isProductColumn(column)) return handleProductKeyDown(event, ctx);
  if (isQtyColumn(column, ctx.config)) return handleQtyKeyDown(event, ctx);

  // ROW-1E keeps Tab/Shift+Tab and Arrow Up/Down as deferred behavior.
  // The preset receives editable columns now, so later steps can add navigation
  // without changing RowControllerV0 wiring again.
  return false;
}

const keyboardPresets = {
  'wms-default': {
    key: 'wms-default',
    getEditableColumns,
    handleKeyDown: handleWmsDefaultKeyDown,
  },
};

function getKeyboardPreset(key) {
  return keyboardPresets[key] || keyboardPresets['wms-default'];
}

export {
  getEditableColumns,
  getKeyboardPreset,
  keyboardPresets,
};

export default keyboardPresets;
