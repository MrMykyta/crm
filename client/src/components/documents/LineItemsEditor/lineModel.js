// Shared line-item model for commercial documents (offers/orders, future invoices).
// EXTRACTED VERBATIM from OfferEditorPage/OrderEditorPage to preserve exact payload
// semantics (lineType / affectsInventory / isStockTrackedSnapshot / metadataSnapshot /
// isCustomLine). Do not change calculation or payload shape without backend review.

import {
  buildProductMetadataSnapshot,
  getCustomLineSemantics,
  getProductLineSemantics,
  normalizeLineSemantics,
} from '../../oms/lineItemSemantics';

export function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

export function asNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyItem() {
  return {
    localId: uid(),
    id: null,
    productId: null,
    variantId: null,
    unitId: null,
    uomId: null,
    skuSnapshot: '',
    name: '',
    descriptionSnapshot: '',
    unitSnapshot: '',
    vatRateSnapshot: '23',
    productTypeSnapshot: '',
    metadataSnapshot: null,
    qty: '1',
    priceNet: '0',
    taxRate: '23',
    discountType: 'none',
    discountValue: '0',
    isCustomLine: true,
    ...getCustomLineSemantics(),
    sortOrder: 0,
  };
}

export function createProductItem(product) {
  const unitSnapshot = asText(
    product?.uom?.symbol
    || product?.uom?.code
    || product?.uom?.name
    || product?.unit
  );
  const vatRate = asNumber(product?.taxCategory?.rate ?? product?.vatRate ?? product?.taxRate, 0);
  const netPrice = asNumber(product?.price ?? product?.netPrice ?? product?.salePrice, 0);
  const variantId = product?.variantId || product?.defaultVariantId || product?.defaultVariant?.id || null;
  const semantics = getProductLineSemantics(product);

  return {
    localId: uid(),
    id: null,
    productId: product?.id || null,
    variantId,
    unitId: product?.uom?.id || null,
    uomId: product?.uom?.id || null,
    skuSnapshot: asText(product?.sku),
    name: asText(product?.name),
    descriptionSnapshot: asText(product?.description),
    unitSnapshot,
    vatRateSnapshot: String(vatRate),
    productTypeSnapshot: asText(product?.type?.code || product?.type?.name),
    metadataSnapshot: buildProductMetadataSnapshot(product),
    qty: '1',
    priceNet: String(netPrice),
    taxRate: String(vatRate),
    discountType: 'none',
    discountValue: '0',
    isCustomLine: false,
    ...semantics,
    sortOrder: 0,
  };
}

export function toEditorItem(item) {
  const semantics = normalizeLineSemantics(item);
  return {
    localId: uid(),
    id: item?.id || null,
    productId: item?.productId || item?.product?.id || null,
    variantId: item?.variantId || null,
    unitId: item?.unitId || item?.uomId || item?.unit?.id || null,
    uomId: item?.uomId || item?.unitId || item?.unit?.id || null,
    skuSnapshot: item?.skuSnapshot || item?.sku || item?.product?.sku || '',
    name: item?.nameSnapshot || item?.name || item?.product?.name || '',
    descriptionSnapshot: item?.descriptionSnapshot || item?.description || '',
    unitSnapshot: item?.unitSnapshot || item?.unit?.symbol || item?.unit?.code || item?.unit?.name || '',
    vatRateSnapshot: String(item?.vatRateSnapshot ?? item?.vatRate ?? item?.taxRate ?? '0'),
    productTypeSnapshot: item?.productTypeSnapshot || '',
    metadataSnapshot: item?.metadataSnapshot || null,
    qty: String(item?.qty ?? item?.quantity ?? '1'),
    priceNet: String(item?.priceNet ?? item?.unitPriceNet ?? '0'),
    taxRate: String(item?.vatRateSnapshot ?? item?.vatRate ?? item?.taxRate ?? '0'),
    discountType: item?.discountType || 'none',
    discountValue: String(item?.discountValue ?? '0'),
    isCustomLine: item?.isCustomLine !== undefined ? Boolean(item?.isCustomLine) : !item?.productId,
    ...semantics,
    sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : 0,
  };
}

export function calculateLine(item) {
  const qty = Math.max(0, asNumber(item.qty, 0));
  const priceNet = Math.max(0, asNumber(item.priceNet, 0));
  const taxRate = Math.max(0, asNumber(item.taxRate, 0));
  const discountValue = Math.max(0, asNumber(item.discountValue, 0));

  const baseNet = qty * priceNet;

  let discountAmount = 0;
  if (item.discountType === 'fixed') {
    discountAmount = Math.min(discountValue, baseNet);
  } else if (item.discountType === 'percent') {
    discountAmount = baseNet * (discountValue / 100);
  }

  const lineNet = Math.max(0, baseNet - discountAmount);
  const lineVat = lineNet * (taxRate / 100);
  const lineGross = lineNet + lineVat;

  return {
    lineNet: roundMoney(lineNet),
    lineVat: roundMoney(lineVat),
    lineGross: roundMoney(lineGross),
  };
}

export function calculateTotals(items = []) {
  const totals = items.reduce((acc, item) => {
    const line = calculateLine(item);
    acc.net += line.lineNet;
    acc.vat += line.lineVat;
    acc.gross += line.lineGross;
    return acc;
  }, { net: 0, vat: 0, gross: 0 });

  return {
    net: roundMoney(totals.net),
    vat: roundMoney(totals.vat),
    gross: roundMoney(totals.gross),
  };
}

// stableItemsHash — used by the offer editor to skip item save when unchanged.
// Kept identical to the previous in-page implementation.
export function stableItemsHash(items) {
  return JSON.stringify(
    (items || []).map((item, index) => ({
      id: item.id || null,
      sortOrder: index,
      productId: item.productId || null,
      variantId: item.variantId || null,
      unitId: item.unitId || item.uomId || null,
      uomId: item.uomId || item.unitId || null,
      skuSnapshot: asText(item.skuSnapshot) || null,
      nameSnapshot: asText(item.name),
      descriptionSnapshot: asText(item.descriptionSnapshot) || null,
      unitSnapshot: asText(item.unitSnapshot) || null,
      vatRateSnapshot: asNumber(item.vatRateSnapshot, asNumber(item.taxRate, 0)),
      productTypeSnapshot: asText(item.productTypeSnapshot) || null,
      metadataSnapshot: item.metadataSnapshot || null,
      quantity: asNumber(item.qty, 0),
      unitPriceNet: asNumber(item.priceNet, 0),
      taxRate: asNumber(item.taxRate, 0),
      vatRate: asNumber(item.taxRate, 0),
      discountType: item.discountType || 'none',
      discountValue: asNumber(item.discountValue, 0),
      isCustomLine: Boolean(item.isCustomLine),
      lineType: item.lineType || (item.productId ? 'product' : 'custom'),
      affectsInventory: Boolean(item.affectsInventory),
      isStockTrackedSnapshot: Boolean(item.isStockTrackedSnapshot),
    }))
  );
}

// mapLinesToPayload — produces the exact items payload the API expects.
// Identical to the former in-page buildItemsPayload().
export function mapLinesToPayload(items = []) {
  return items.map((item, index) => ({
    id: item.id || undefined,
    sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
    productId: item.productId || null,
    variantId: item.variantId || null,
    unitId: item.unitId || item.uomId || null,
    uomId: item.uomId || item.unitId || null,
    skuSnapshot: asText(item.skuSnapshot) || null,
    nameSnapshot: asText(item.name),
    descriptionSnapshot: asText(item.descriptionSnapshot) || null,
    unitSnapshot: asText(item.unitSnapshot) || null,
    vatRateSnapshot: asNumber(item.vatRateSnapshot, asNumber(item.taxRate, 0)),
    productTypeSnapshot: asText(item.productTypeSnapshot) || null,
    metadataSnapshot: item.metadataSnapshot || null,
    quantity: asNumber(item.qty, 0),
    unitPriceNet: asNumber(item.priceNet, 0),
    taxRate: asNumber(item.taxRate, 0),
    vatRate: asNumber(item.taxRate, 0),
    discountType: item.discountType || 'none',
    discountValue: asNumber(item.discountValue, 0),
    isCustomLine: Boolean(item.isCustomLine),
    lineType: item.lineType || (item.productId ? 'product' : 'custom'),
    affectsInventory: Boolean(item.affectsInventory),
    isStockTrackedSnapshot: Boolean(item.isStockTrackedSnapshot),
  }));
}
