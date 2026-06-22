function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function asNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round4(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e4) / 1e4;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getQtyField(config = {}) {
  return asText(config?.qtyField) || 'qty';
}

function isAutoRowEnabled(config = {}) {
  return config?.rowController?.autoRow?.enabled !== false;
}

function createEmptyRow(config = {}) {
  const qtyField = getQtyField(config);
  return {
    localId: uid(),
    id: null,
    isNew: true,
    productId: '',
    variantId: '',
    productName: '',
    pickerProductName: '',
    sku: '',
    variantLabel: '',
    pickerVariantLabel: '',
    [qtyField]: '',
    lotNumber: '',
    unitCost: '',
    currency: '',
    qtyReceived: '',
    isLotTracked: false,
  };
}

function mapProductPickerRowToPzRowPatch(row = {}) {
  const purchasePrice = row?.purchasePrice || {};
  const purchaseValue = purchasePrice?.value ?? row.purchasePrice ?? row.unitCost ?? '';
  const purchaseCurrency = purchasePrice?.currency ?? row.currency ?? '';
  return {
    productId: asText(row.productId || row.product?.id || row.id),
    variantId: asText(row.variantId),
    productName: asText(row.productName || row.name || row.product?.name),
    sku: asText(row.variantSku || row.sku || row.product?.sku),
    variantLabel: asText(row.variantLabel || row.variantName),
    unitCost: purchaseValue,
    currency: purchaseCurrency || 'PLN',
    isLotTracked: Boolean(row.isLotTracked || row.product?.isLotTracked),
    isSerialized: Boolean(row.isSerialized || row.product?.isSerialized),
  };
}

function normalizeProductPickerRows(result) {
  if (Array.isArray(result?.items)) return result.items;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result)) return result;
  return [];
}

function normalizeScanCode(value) {
  return asText(value).toLowerCase();
}

function getProductPickerScanCodes(row = {}) {
  return [
    row.variantSku,
    row.sku,
    row.ean,
    row.barcode,
    row.product?.sku,
  ].map(normalizeScanCode).filter(Boolean);
}

function isExactProductPickerScanMatch(row, query) {
  const normalized = normalizeScanCode(query);
  if (!normalized) return false;
  return getProductPickerScanCodes(row).some((code) => code === normalized);
}

function isRowEmpty(row, config = {}) {
  if (row?.id) return false;
  const qtyField = getQtyField(config);
  return !asText(row?.productId)
    && !asText(row?.productName)
    && !asText(row?.pickerProductName)
    && !asText(row?.sku)
    && !asText(row?.variantId)
    && !asText(row?.variantLabel)
    && !asText(row?.pickerVariantLabel)
    && !asText(row?.lotNumber)
    && !asText(row?.unitCost)
    && !asText(row?.currency)
    && asNumber(row?.[qtyField], 0) <= 0;
}

function isCommittableRow(row, config = {}) {
  const qtyField = getQtyField(config);
  return Boolean(asText(row?.productId)) && asNumber(row?.[qtyField], 0) > 0;
}

function getPersistableRows(rows = [], config = {}) {
  return rows.filter((row) => isCommittableRow(row, config));
}

function normalizeRows(rows = [], config = {}) {
  if (!isAutoRowEnabled(config)) return rows;
  const filled = rows.filter((row) => row?.id || !isRowEmpty(row, config));
  return [...filled, createEmptyRow(config)];
}

function getRowSnapshot(row = {}, config = {}) {
  const qtyField = getQtyField(config);
  const snapshot = {
    productId: asText(row.productId),
    variantId: asText(row.variantId) || null,
    lotNumber: asText(row.lotNumber) || null,
    [qtyField]: round4(asNumber(row[qtyField], 0)),
    unitCost: asText(row.unitCost) ? asNumber(row.unitCost, 0) : null,
    currency: asText(row.currency) || null,
  };
  return snapshot;
}

function areDraftItemSnapshotsEqual(a = {}, b = {}, config = {}) {
  return JSON.stringify(getRowSnapshot(a, config)) === JSON.stringify(getRowSnapshot(b, config));
}

function mapReceiptItemToPzRow(item = {}, index = 0, config = {}) {
  const qtyField = getQtyField(config);
  return {
    ...createEmptyRow(config),
    localId: item.localId || item.id || `receipt-item-${index}`,
    id: item.id || null,
    isNew: !item.id,
    productId: asText(item.productId),
    variantId: asText(item.variantId),
    productName: asText(item.product?.name || item.productName || item.nameSnapshot),
    pickerProductName: asText(item.product?.name || item.productName || item.nameSnapshot),
    sku: asText(item.variant?.sku || item.product?.sku || item.variantSku || item.sku),
    variantLabel: asText(item.variant?.name || item.variantName || item.variantLabel),
    pickerVariantLabel: asText(item.variant?.name || item.variantName || item.variantLabel),
    [qtyField]: asText(item.qtyExpected ?? item.qty ?? ''),
    qtyReceived: asText(item.qtyReceived ?? ''),
    lotNumber: asText(item.lotNumber),
    unitCost: asText(item.unitCost),
    currency: asText(item.currency),
    isLotTracked: Boolean(item.isLotTracked ?? item.product?.isLotTracked),
    isSerialized: Boolean(item.isSerialized ?? item.product?.isSerialized),
  };
}

function mapReceiptToShellDraft(receipt = {}, config = {}) {
  const items = Array.isArray(receipt.items) ? receipt.items : [];
  return {
    header: {
      warehouseId: asText(receipt.warehouseId),
      inboundLocationId: asText(receipt.inboundLocationId || receipt.locationId),
      issueDate: asText(receipt.issueDate || '').slice(0, 10),
    },
    rows: normalizeRows(items.map((item, index) => mapReceiptItemToPzRow(item, index, config)), config),
  };
}

function mapReceiptToShellPosted(receipt = {}, config = {}) {
  const items = Array.isArray(receipt.items) ? receipt.items : [];
  return {
    header: {
      warehouseId: asText(receipt.warehouseId),
      inboundLocationId: asText(receipt.inboundLocationId || receipt.locationId),
      counterpartyId: asText(
        receipt.counterparty?.name
        || receipt.supplier?.name
        || receipt.counterpartyName
        || receipt.supplierName
        || receipt.counterpartyId
      ),
      sourceRef: asText(
        receipt.sourceRef
        || receipt.sourceReference
        || receipt.sourceDocumentNumber
        || receipt.purchaseOrderNumber
        || receipt.orderNumber
        || receipt.source?.number
        || receipt.order?.number
      ),
      issueDate: asText(receipt.issueDate || receipt.createdAt || '').slice(0, 10),
      documentNumber: asText(receipt.number || receipt.documentNumber || receipt.code || receipt.id),
      status: asText(receipt.status),
    },
    rows: items.map((item, index) => mapReceiptItemToPzRow(item, index, config)),
  };
}

const rowControllerModel = {
  areDraftItemSnapshotsEqual,
  asNumber,
  asText,
  createEmptyRow,
  getQtyField,
  getPersistableRows,
  getRowSnapshot,
  isAutoRowEnabled,
  isCommittableRow,
  isRowEmpty,
  isExactProductPickerScanMatch,
  mapProductPickerRowToPzRowPatch,
  mapReceiptItemToPzRow,
  mapReceiptToShellDraft,
  mapReceiptToShellPosted,
  normalizeProductPickerRows,
  normalizeRows,
  round4,
};

export {
  areDraftItemSnapshotsEqual,
  asNumber,
  asText,
  createEmptyRow,
  getQtyField,
  getPersistableRows,
  getRowSnapshot,
  isAutoRowEnabled,
  isCommittableRow,
  isRowEmpty,
  isExactProductPickerScanMatch,
  mapProductPickerRowToPzRowPatch,
  mapReceiptItemToPzRow,
  mapReceiptToShellDraft,
  mapReceiptToShellPosted,
  normalizeProductPickerRows,
  normalizeRows,
  round4,
};

export default rowControllerModel;
