import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import DocumentEnginePage, { WMS_DOCUMENT_ADAPTERS } from '../../../components/documents/DocumentEngine';
import s from '../../oms/OmsReadOnlyDetail.module.css';
import Modal from '../../../components/Modal';
import { ProductPicker } from '../../../components/pim';
import { CheckboxField, NumberField, SelectField, TextareaField, TextField } from '../../../components/ui/fields';
import {
  useCreateReceiptCorrectionMutation,
  useCreateShipmentCorrectionMutation,
  useExecuteTransferLineMutation,
  useGetAdjustmentByIdQuery,
  useGetAdjustmentStockMovesQuery,
  useListLocationsQuery,
  useListWarehousesQuery,
  usePostAdjustmentMutation,
  useGetReceiptByIdQuery,
  useGetReceiptStockMovesQuery,
  useAddReceiptDraftItemMutation,
  useGetShipmentByIdQuery,
  useGetShipmentStockMovesQuery,
  useGetTransferByIdQuery,
  useGetTransferStockMovesQuery,
  useReceiveReceiptLineMutation,
  useRemoveReceiptDraftItemMutation,
  useShipShipmentItemMutation,
  useUpdateReceiptDraftItemMutation,
  useUpdateReceiptDraftMutation,
} from '../../../store/rtk/wmsDocumentsApi';
import {
  useLazyGetProductQuery,
  useLazyGetProductVariantQuery,
  useLazyProductPickerQuery,
  useListProductsQuery,
  useListProductVariantsQuery,
} from '../../../store/rtk/productsApi';
import {
  buildLookupMap,
  formatLocationLabel,
  formatProductLabel,
  formatVariantLabel,
  formatWarehouseLabel,
} from '../../../components/documents/DocumentEngine/wmsDisplay';
import { getWmsDocumentPolicy } from '../wmsDocumentPolicy';
import { mmConfig, pwConfig, pzConfig, wzConfig } from '../documentTypes';
import useAclPermissions from '../../../hooks/useAclPermissions';

const ROUTE_BASE = {
  receipt: pzConfig.routeBase,
  shipment: wzConfig.routeBase,
  transfer: mmConfig.routeBase,
  adjustment: pwConfig.routeBase,
};

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function asNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function round4(value) {
  return Math.round(asNumber(value, 0) * 10000) / 10000;
}

const RECEIPT_ROW_STATE = {
  EMPTY: 'EMPTY',
  SEARCHING_PRODUCT: 'SEARCHING_PRODUCT',
  PRODUCT_SELECTED: 'PRODUCT_SELECTED',
  QTY_EDITING: 'QTY_EDITING',
  READY: 'READY',
  DETAILS_EXPANDED: 'DETAILS_EXPANDED',
  ERROR: 'ERROR',
  REMOVED: 'REMOVED',
};

function makeReceiptDraftLocalId(index = 0) {
  return `new-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDate(value, locale = 'en') {
  const text = asText(value);
  if (!text) return '—';
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(parsed);
}

function formatQty(value, locale = 'en') {
  const qty = asNumber(value, NaN);
  if (!Number.isFinite(qty)) return '—';
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(qty);
}

function formatMoney(value, locale = 'en') {
  const amount = asNumber(value, NaN);
  if (!Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

function warehouseLevelStockText(t) {
  return t('wms.locationOptional.warehouseLevelStock', 'Warehouse-level stock');
}

function warehouseLevelHint(t) {
  return t('wms.locationOptional.warehouseLevelHint', 'No location selected; this document will use warehouse-level stock.');
}

function formatOptionalLocationLabel(locationOrId, locationsById, t) {
  const id = typeof locationOrId === 'object' ? asText(locationOrId?.id) : asText(locationOrId);
  return id ? formatLocationLabel(locationOrId, locationsById) : warehouseLevelStockText(t);
}

function itemName(item, lookups = {}) {
  return item?.nameSnapshot
    || item?.skuSnapshot
    || formatProductLabel(item?.product || item?.productId, lookups.productsById);
}

function itemVariant(item, lookups = {}) {
  return formatVariantLabel(item?.variant || item?.variantId, lookups.variantsById);
}

function itemQty(item, kind) {
  if (kind === 'adjustment') return item?.qtyDelta ?? 0;
  return item?.qty ?? item?.qtyExpected ?? 0;
}

function itemProgress(item, kind, processedByItem = {}) {
  if (kind === 'shipment') return processedByItem[item?.id] ?? item?.qtyShipped ?? item?.movedQty ?? null;
  if (item?.qtyReceived !== undefined) return item.qtyReceived;
  if (item?.movedQty !== undefined) return item.movedQty;
  return null;
}

function isCostingNotInitializedError(error) {
  return error?.data?.code === 'COSTING_NOT_INITIALIZED';
}

function getWmsActionErrorText(error, t) {
  const code = error?.data?.code;
  if (code) {
    const translated = t(`wms.corrections.errors.${code}`, '');
    if (translated) return translated;
  }
  if (isCostingNotInitializedError(error)) {
    return t(
      'wms.costing.errors.notInitialized',
      'FIFO costing is not initialized for this company. Go to Company Settings → Warehouse/WMS → Wycena.'
    );
  }
  return error?.data?.message || error?.data?.error || error?.message || t('common.error', 'Error');
}

function correctionRoute(kind, id) {
  if (!id) return null;
  if (kind === 'receipt') return `/main/wms/receipts/${id}`;
  if (kind === 'shipment') return `/main/wms/shipments/${id}`;
  return null;
}

function correctionQty(item, kind) {
  if (kind === 'receipt') return asNumber(item?.qtyReceived ?? item?.qty ?? item?.qtyExpected, 0);
  return asNumber(item?.qty ?? item?.qtyShipped, 0);
}

function uniqueIds(rows = [], field) {
  const ids = new Set();
  rows.forEach((row) => {
    const value = asText(row?.[field]);
    if (value) ids.add(value);
  });
  return Array.from(ids);
}

function shippedQtyByShipmentItem(historyItems = []) {
  return historyItems.reduce((acc, move) => {
    const refItemId = asText(move?.refItemId);
    if (!refItemId || asText(move?.type).toLowerCase() !== 'ship') return acc;
    acc[refItemId] = round4(asNumber(acc[refItemId], 0) + asNumber(move?.qty, 0));
    return acc;
  }, {});
}

function pendingShipmentQty(item, shippedByItem = {}) {
  const planned = asNumber(item?.qty, 0);
  const shipped = asNumber(shippedByItem?.[item?.id], 0);
  return round4(Math.max(0, planned - shipped));
}

function makeReceiptDraftRow(item = {}, index = 0) {
  const hasProduct = Boolean(asText(item.productId));
  const hasQty = asNumber(item.qtyExpected ?? item.qty, 0) > 0;
  return {
    localId: item.localId || item.id || makeReceiptDraftLocalId(index),
    id: item.id || null,
    productId: asText(item.productId),
    variantId: asText(item.variantId),
    pickerProductName: asText(item.product?.name || item.productName || item.nameSnapshot),
    pickerVariantLabel: asText(item.variant?.name || item.variantName || item.variantLabel),
    purchasePriceSource: asText(item.purchasePriceSource),
    purchasePriceCurrency: asText(item.purchasePriceCurrency),
    purchasePriceWarning: asText(item.purchasePriceWarning),
    unitCostManual: item.unitCostManual !== undefined ? Boolean(item.unitCostManual) : Boolean(asText(item.unitCost)),
    lotNumber: asText(item.lotNumber),
    serialNumber: asText(item.serialNumber),
    qtyExpected: asText(item.qtyExpected ?? item.qty ?? ''),
    unitCost: asText(item.unitCost),
    currency: asText(item.currency),
    rowState: item.rowState || (hasProduct && hasQty ? RECEIPT_ROW_STATE.READY : hasProduct ? RECEIPT_ROW_STATE.PRODUCT_SELECTED : RECEIPT_ROW_STATE.EMPTY),
    hasVariants: Boolean(item.hasVariants),
    isLotTracked: Boolean(item.isLotTracked ?? item.product?.isLotTracked),
    isSerialized: Boolean(item.isSerialized ?? item.product?.isSerialized),
    isNew: !item.id,
  };
}

function isReceiptDraftRowEmpty(row) {
  return !asText(row?.productId)
    && !asText(row?.variantId)
    && !asText(row?.pickerProductName)
    && !asText(row?.pickerVariantLabel)
    && !asText(row?.lotNumber)
    && !asText(row?.serialNumber)
    && !asText(row?.qtyExpected)
    && !asText(row?.unitCost)
    && !asText(row?.currency);
}

function normalizeReceiptDraftRows(rows = []) {
  const visibleRows = rows.filter((row) => row?.rowState !== RECEIPT_ROW_STATE.REMOVED);
  const filledRows = visibleRows
    .filter((row) => !isReceiptDraftRowEmpty(row))
    .map((row, index) => makeReceiptDraftRow(row, index));
  const reusableEmpty = visibleRows.find((row) => isReceiptDraftRowEmpty(row));
  const emptyRow = makeReceiptDraftRow({
    ...(reusableEmpty || {}),
    localId: reusableEmpty?.localId || makeReceiptDraftLocalId(filledRows.length),
    id: null,
    productId: '',
    variantId: '',
    pickerProductName: '',
    pickerVariantLabel: '',
    lotNumber: '',
    serialNumber: '',
    qtyExpected: '',
    unitCost: '',
    currency: '',
    rowState: reusableEmpty?.rowState || RECEIPT_ROW_STATE.EMPTY,
    isLotTracked: false,
    isSerialized: false,
    isNew: true,
  }, filledRows.length);
  return [...filledRows, emptyRow];
}

function receiptDraftPersistableRows(rows = []) {
  return rows.filter((row) => row?.rowState !== RECEIPT_ROW_STATE.REMOVED && !isReceiptDraftRowEmpty(row));
}

function receiptDraftItemPayload(row) {
  return {
    productId: asText(row.productId),
    variantId: asText(row.variantId) || null,
    lotNumber: asText(row.lotNumber) || null,
    serialNumber: asText(row.serialNumber) || null,
    qtyExpected: asNumber(row.qtyExpected, 0),
    unitCost: asText(row.unitCost) ? asNumber(row.unitCost, 0) : null,
    currency: asText(row.currency) || null,
  };
}

function getRowTotal(row) {
  return round4(asNumber(row?.qtyExpected, 0) * asNumber(row?.unitCost, 0));
}

function getRowCurrency(row) {
  return asText(row?.currency) || '—';
}

function getReceiptDraftTotals(rows = []) {
  return receiptDraftPersistableRows(rows).reduce((acc, row) => {
    const qty = asNumber(row?.qtyExpected, 0);
    const total = getRowTotal(row);
    const currency = getRowCurrency(row);
    acc.lines += 1;
    acc.qty = round4(acc.qty + qty);
    acc.byCurrency[currency] = round4(asNumber(acc.byCurrency[currency], 0) + total);
    return acc;
  }, { lines: 0, qty: 0, byCurrency: {} });
}

function receiptDraftProductHasVariants(row, variants = []) {
  if (row?.hasVariants) return true;
  const productId = asText(row?.productId);
  if (!productId) return false;
  return variants.some((variant) => asText(variant?.productId) === productId);
}

function getReceiptDraftRowValidation(row, { variants = [], t, lookups = {} }) {
  const errors = {};
  const warnings = {};
  if (isReceiptDraftRowEmpty(row)) return { errors, warnings, hasErrors: false, hasWarnings: false };

  const productId = asText(row?.productId);
  const qtyText = asText(row?.qtyExpected);
  const qty = Number(qtyText);
  const hasProduct = Boolean(productId);

  if (hasProduct && !qtyText) {
    errors.qtyExpected = t('wms.validation.qtyPositive', 'Quantity must be greater than 0');
  } else if (hasProduct && !Number.isFinite(qty)) {
    errors.qtyExpected = t('wms.receipts.draftEdit.validation.qtyNumber', 'Quantity must be a number');
  } else if (hasProduct && qty <= 0) {
    errors.qtyExpected = t('wms.validation.qtyPositive', 'Quantity must be greater than 0');
  }

  if (hasProduct && receiptDraftProductHasVariants(row, variants) && !asText(row?.variantId)) {
    errors.productId = t('wms.receipts.draftEdit.validation.variantRequired', 'Select a variant for this product');
  } else if (!hasProduct) {
    errors.productId = t('wms.validation.productRequired', 'Product is required');
  }

  if (hasProduct && !asText(row?.unitCost)) {
    warnings.unitCost = t('wms.receipts.draftEdit.priceWarnings.noSuggestedPrice', 'No suggested purchase price');
  }
  if (hasProduct && asText(row?.purchasePriceWarning)) {
    warnings.purchasePrice = row.purchasePriceWarning;
  }
  if (hasProduct && row?.unitCostManual) {
    warnings.manualCost = t('wms.receipts.draftEdit.priceWarnings.manualCost', 'Manual cost');
  }
  if (hasProduct && getReceiptDraftProductFlags(row, lookups).isLotTracked && !asText(row?.lotNumber)) {
    warnings.lotNumber = t('wms.receipts.draftEdit.lot.required', 'Lot required');
  }

  return {
    errors,
    warnings,
    hasErrors: Object.keys(errors).length > 0,
    hasWarnings: Object.keys(warnings).length > 0,
  };
}

function getReceiptDraftRowState(row, validation) {
  if (row?.rowState === RECEIPT_ROW_STATE.REMOVED) return RECEIPT_ROW_STATE.REMOVED;
  if (row?.rowState === RECEIPT_ROW_STATE.SEARCHING_PRODUCT) return RECEIPT_ROW_STATE.SEARCHING_PRODUCT;
  if (isReceiptDraftRowEmpty(row)) return RECEIPT_ROW_STATE.EMPTY;
  if (validation?.hasErrors) return RECEIPT_ROW_STATE.ERROR;
  if (row?.rowState === RECEIPT_ROW_STATE.DETAILS_EXPANDED) return RECEIPT_ROW_STATE.DETAILS_EXPANDED;
  if (row?.rowState === RECEIPT_ROW_STATE.QTY_EDITING) return RECEIPT_ROW_STATE.QTY_EDITING;
  if (asText(row?.productId) && asNumber(row?.qtyExpected, 0) > 0) return RECEIPT_ROW_STATE.READY;
  if (asText(row?.productId)) return RECEIPT_ROW_STATE.PRODUCT_SELECTED;
  return RECEIPT_ROW_STATE.EMPTY;
}

function getReceiptDraftRowStateLabel(rowState, t) {
  const labels = {
    [RECEIPT_ROW_STATE.EMPTY]: t('wms.receipts.draftEdit.rowStates.empty', 'новая строка'),
    [RECEIPT_ROW_STATE.SEARCHING_PRODUCT]: t('wms.receipts.draftEdit.rowStates.searchingProduct', 'поиск товара'),
    [RECEIPT_ROW_STATE.PRODUCT_SELECTED]: t('wms.receipts.draftEdit.rowStates.productSelected', 'товар выбран'),
    [RECEIPT_ROW_STATE.QTY_EDITING]: t('wms.receipts.draftEdit.rowStates.qtyEditing', 'ввод кол-ва'),
    [RECEIPT_ROW_STATE.READY]: t('wms.receipts.draftEdit.rowStates.ready', 'готово'),
    [RECEIPT_ROW_STATE.DETAILS_EXPANDED]: t('wms.receipts.draftEdit.rowStates.detailsExpanded', 'детали'),
    [RECEIPT_ROW_STATE.ERROR]: t('wms.receipts.draftEdit.rowStates.error', 'ошибка'),
    [RECEIPT_ROW_STATE.REMOVED]: t('wms.receipts.draftEdit.rowStates.removed', 'удалено'),
  };
  return labels[rowState] || rowState.replaceAll('_', ' ').toLowerCase();
}

function purchasePriceSourceLabel(source) {
  const key = asText(source);
  if (key === 'productSupplierVariant' || key === 'productSupplier') return 'supplierPrice';
  if (key === 'variantCost') return 'variantCost';
  if (key === 'productCost') return 'productCost';
  if (key === 'manual') return 'manual';
  return '';
}

function getPurchasePriceSourceText(source, t) {
  const key = purchasePriceSourceLabel(source);
  if (!key) return '';
  const fallback = {
    supplierPrice: 'Supplier Price',
    variantCost: 'Variant Cost',
    productCost: 'Product Cost',
    manual: 'Manual',
  }[key] || '';
  return t(`wms.receipts.draftEdit.priceSource.${key}`, fallback);
}

function getPurchasePriceWarnings(row, t) {
  const warnings = [];
  if (!asText(row?.unitCost)) {
    warnings.push(t('wms.receipts.draftEdit.priceWarnings.noSuggestedPrice', 'No suggested purchase price'));
  }
  const suggestedCurrency = asText(row?.purchasePriceCurrency).toUpperCase();
  const currentCurrency = asText(row?.currency).toUpperCase();
  if (suggestedCurrency && currentCurrency && suggestedCurrency !== currentCurrency) {
    warnings.push(t(
      'wms.receipts.draftEdit.priceWarnings.currencyMismatch',
      'Suggested currency differs from current line currency'
    ));
  }
  return warnings;
}

function normalizeScanCode(value) {
  return asText(value).toLowerCase();
}

function getPickerRowCodes(row = {}) {
  return [
    row.variantSku,
    row.sku,
    row.ean,
    row.barcode,
  ].map(normalizeScanCode).filter(Boolean);
}

function isExactPickerScanMatch(row, query) {
  const normalized = normalizeScanCode(query);
  if (!normalized) return false;
  return getPickerRowCodes(row).some((code) => code === normalized);
}

function scanPickerPayload(row = {}) {
  return {
    productId: row?.productId || null,
    variantId: row?.variantId || null,
    productName: row?.productName || null,
    variantLabel: row?.variantLabel || null,
    sku: row?.variantSku || row?.sku || null,
    barcode: row?.barcode || null,
    ean: row?.ean || null,
    thumbnailUrl: row?.thumbnailUrl || null,
  };
}

function getScanResultTitle(row = {}) {
  const sku = asText(row.variantSku || row.sku);
  const name = asText(row.productName);
  if (sku && name) return `${sku} — ${name}`;
  return sku || name || '—';
}

function getReceiptDraftProductFlags(row, lookups = {}) {
  const product = row?.productId ? lookups.productsById?.get?.(row.productId) : null;
  return {
    isLotTracked: Boolean(row?.isLotTracked || product?.isLotTracked),
    isSerialized: Boolean(row?.isSerialized || product?.isSerialized),
  };
}

function getReceiptDraftLotBadge(row, lookups = {}, t) {
  if (isReceiptDraftRowEmpty(row) || !asText(row?.productId)) return null;
  const lotNumber = asText(row?.lotNumber);
  const { isLotTracked } = getReceiptDraftProductFlags(row, lookups);
  if (isLotTracked && !lotNumber) {
    return {
      state: 'warning',
      text: t('wms.receipts.draftEdit.lot.required', 'Lot required'),
    };
  }
  if (lotNumber) {
    const lotLabel = `LOT ${lotNumber}`;
    return {
      state: isLotTracked ? 'ready' : 'neutral',
      text: t('wms.receipts.draftEdit.lot.valueBadge', lotLabel, { lotNumber }),
    };
  }
  return null;
}

function receiptPickerValue(row, lookups = {}) {
  if (!row?.productId) return null;
  const productName = row.pickerProductName || formatProductLabel(row.productId, lookups.productsById);
  const variantLabel = row.variantId
    ? row.pickerVariantLabel || formatVariantLabel(row.variantId, lookups.variantsById)
    : null;
  return {
    productId: row.productId,
    variantId: row.variantId || null,
    productName,
    variantLabel,
    sku: null,
    barcode: null,
    ean: null,
  };
}

function ReceiptDraftProductPicker({
  row,
  lookups,
  t,
  disabled,
  warehouseId,
  fieldRef,
  onFocus,
  onKeyDownCapture,
  onProductSelect,
  onClearProduct,
}) {
  return (
    <div
      className={s.draftProductPicker}
      ref={fieldRef}
      onFocus={onFocus}
      onKeyDownCapture={onKeyDownCapture}
    >
      <ProductPicker
        value={receiptPickerValue(row, lookups)}
        warehouseId={warehouseId || null}
        disabled={disabled}
        placeholder={t('wms.receipts.draftEdit.productCellPlaceholder', 'Начните вводить товар / SKU / EAN')}
        limit={12}
        onSelect={(payload, productPickerRow) => {
          if (!payload?.productId) {
            onClearProduct();
            return;
          }
          onProductSelect(payload, productPickerRow);
        }}
      />
    </div>
  );
}

function ReceiptDraftDetailsRow({
  row,
  lookups,
  locations,
  inboundLocationId,
  validation,
  priceSourceText,
  priceWarnings,
  effectiveDisabled,
  t,
  onRowChange,
  onCollapse,
}) {
  const productFlags = getReceiptDraftProductFlags(row, lookups);
  const lotBadge = getReceiptDraftLotBadge(row, lookups, t);
  const inboundLocation = inboundLocationId ? lookups.locationsById?.get?.(inboundLocationId) : null;
  const showReceiveNow = Object.prototype.hasOwnProperty.call(row, 'receiveNow');

  return (
    <tr className={s.draftDetailsRow}>
      <td colSpan={9}>
        <div
          className={s.draftDetailsPanel}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onCollapse();
            }
          }}
        >
          <div className={s.draftDetailsHeader}>
            <span>{t('wms.receipts.draftEdit.details.title', 'Line details')}</span>
            <button type="button" className={s.draftDetailsClose} onClick={onCollapse}>
              {t('common.close', 'Close')}
            </button>
          </div>

          <div className={s.draftDetailsGrid}>
            <section className={s.draftDetailsSection}>
              <div className={s.draftDetailsSectionHead}>
                <strong>{t('wms.receipts.draftEdit.details.cost', 'Cost')}</strong>
                {priceSourceText ? <span className={s.draftPriceBadge}>{priceSourceText}</span> : null}
              </div>
              <div className={s.draftDetailsFields}>
                <label className={s.draftDetailsField}>
                  <span>{t('wms.columns.unitCost', 'Unit cost')}</span>
                  <NumberField
                    value={row.unitCost ?? ''}
                    emitAs="string"
                    min="0"
                    step="0.0001"
                    disabled={effectiveDisabled}
                    onValueChange={(value) => onRowChange(row.localId, 'unitCost', value)}
                    inputClassName={`${s.draftControl} ${s.draftNumberControl}`}
                  />
                </label>
                <label className={s.draftDetailsField}>
                  <span>{t('wms.columns.currency', 'Currency')}</span>
                  <TextField
                    value={row.currency || ''}
                    disabled={effectiveDisabled}
                    onValueChange={(value) => onRowChange(row.localId, 'currency', value.toUpperCase())}
                    inputClassName={s.draftControl}
                  />
                </label>
              </div>
              {priceWarnings.length ? (
                <div className={s.draftDetailsWarnings}>
                  {priceWarnings.map((warning) => <span key={warning} className={s.draftPriceWarning}>{warning}</span>)}
                </div>
              ) : null}
            </section>

            <section className={s.draftDetailsSection}>
              <div className={s.draftDetailsSectionHead}>
                <strong>{t('wms.receipts.draftEdit.details.putAway', 'Put-away')}</strong>
              </div>
              <label className={s.draftDetailsField}>
                <span>{t('wms.locationOptional.inboundLabel', 'Inbound location optional')}</span>
                <SelectField
                  value={inboundLocationId || ''}
                  disabled
                  options={[
                    { value: '', label: warehouseLevelStockText(t) },
                    ...(locations || []).map((location) => ({
                      value: location.id,
                      label: formatLocationLabel(location, lookups.locationsById),
                    })),
                  ]}
                  inputClassName={s.select}
                />
              </label>
              <span className={s.draftDetailsMuted}>
                {inboundLocation
                  ? formatLocationLabel(inboundLocation, lookups.locationsById)
                  : warehouseLevelHint(t)}
              </span>
            </section>

            {productFlags.isLotTracked ? (
              <section className={s.draftDetailsSection} data-section-state={asText(row.lotNumber) ? 'ready' : 'warning'}>
                <div className={s.draftDetailsSectionHead}>
                  <strong>{t('wms.receipts.draftEdit.details.lot', 'Lot')}</strong>
                  {lotBadge ? (
                    <span className={s.draftLotBadge} data-state={lotBadge.state}>
                      {lotBadge.text}
                    </span>
                  ) : null}
                </div>
                <label className={s.draftDetailsField}>
                  <span>{t('wms.receipts.draftEdit.lot.inputLabel', 'Lot number')}</span>
                  <TextField
                    value={row.lotNumber || ''}
                    disabled={effectiveDisabled}
                    onValueChange={(value) => onRowChange(row.localId, 'lotNumber', value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        event.stopPropagation();
                      }
                    }}
                    inputClassName={s.draftControl}
                  />
                </label>
                {validation.warnings.lotNumber ? (
                  <span className={s.draftFieldWarning}>{validation.warnings.lotNumber}</span>
                ) : null}
              </section>
            ) : null}

            {productFlags.isSerialized ? (
              <section className={s.draftDetailsSection}>
                <div className={s.draftDetailsSectionHead}>
                  <strong>{t('wms.receipts.draftEdit.details.serials', 'Serials')}</strong>
                  <span className={s.draftFieldWarning}>{t('wms.receipts.draftEdit.details.placeholder', 'placeholder')}</span>
                </div>
                <div className={s.draftSerialPlaceholder}>
                  <span>{t('wms.receipts.draftEdit.details.serialListPlaceholder', 'Serial list placeholder')}</span>
                  {row.serialNumber ? <strong>{row.serialNumber}</strong> : null}
                </div>
              </section>
            ) : null}

            {showReceiveNow ? (
              <section className={s.draftDetailsSection}>
                <div className={s.draftDetailsSectionHead}>
                  <strong>{t('wms.receipts.draftEdit.details.receiveNow', 'Receive now')}</strong>
                </div>
                <span className={s.draftDetailsMuted}>{row.receiveNow ? t('common.yes', 'Yes') : t('common.no', 'No')}</span>
              </section>
            ) : null}
          </div>

          {validation.hasErrors ? (
            <div className={s.draftDetailsWarnings}>
              {Object.values(validation.errors).map((message) => (
                <span key={message} className={s.draftFieldError}>{message}</span>
              ))}
            </div>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function ReceiptDraftEditor({
  header,
  rows,
  warehouses,
  locations,
  lookups,
  variants,
  locale,
  t,
  error,
  disabled,
  onHeaderChange,
  onRowChange,
  onProductSelect,
  onScanResolve,
  onScanSelect,
  onRemoveRow,
  onBulkRemoveRows,
}) {
  const fieldRefs = useRef({});
  const scanInputRef = useRef(null);
  const [selectedRowIds, setSelectedRowIds] = useState([]);
  const [isBulkRemoving, setIsBulkRemoving] = useState(false);
  const [scanQuery, setScanQuery] = useState('');
  const [scanError, setScanError] = useState('');
  const [scanResults, setScanResults] = useState([]);
  const [scanBusy, setScanBusy] = useState(false);
  const [expandedRowIds, setExpandedRowIds] = useState([]);
  const warehouseId = asText(header.warehouseId);
  const scopedLocations = warehouseId
    ? locations.filter((location) => asText(location?.warehouseId) === warehouseId)
    : locations;
  const totals = useMemo(() => getReceiptDraftTotals(rows), [rows]);
  const activeRows = useMemo(() => receiptDraftPersistableRows(rows), [rows]);
  const selectedRows = useMemo(
    () => activeRows.filter((row) => selectedRowIds.includes(row.localId)),
    [activeRows, selectedRowIds]
  );
  const allRowsSelected = activeRows.length > 0 && selectedRowIds.length === activeRows.length;
  const effectiveDisabled = disabled || isBulkRemoving;

  useEffect(() => {
    setSelectedRowIds((prev) => prev.filter((localId) => activeRows.some((row) => row.localId === localId)));
  }, [activeRows]);

  useEffect(() => {
    setExpandedRowIds((prev) => prev.filter((localId) => activeRows.some((row) => row.localId === localId)));
  }, [activeRows]);

  const setFieldRef = useCallback((localId, field, node) => {
    const key = `${localId}:${field}`;
    if (node) fieldRefs.current[key] = node;
    else delete fieldRefs.current[key];
  }, []);

  const focusCell = useCallback((localId, field) => {
    window.setTimeout(() => {
      const node = fieldRefs.current[`${localId}:${field}`];
      const target = node?.querySelector?.('input, button, select, textarea, [tabindex]:not([tabindex="-1"])') || node;
      target?.focus?.();
      if (typeof target?.select === 'function') target.select();
    }, 0);
  }, []);

  const focusScan = useCallback(() => {
    window.setTimeout(() => {
      scanInputRef.current?.focus?.();
      scanInputRef.current?.select?.();
    }, 0);
  }, []);

  useEffect(() => {
    if (effectiveDisabled) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'F2') return;
      event.preventDefault();
      focusScan();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [effectiveDisabled, focusScan]);

  const moveGridFocus = useCallback((localId, field, delta) => {
    const index = rows.findIndex((row) => row.localId === localId);
    if (index < 0) return;
    const next = rows[index + delta];
    if (next) focusCell(next.localId, field);
  }, [focusCell, rows]);

  const focusNextField = useCallback((localId, field, shiftKey = false) => {
    const fieldOrder = ['product', 'qtyExpected', 'unitCost', 'currency'];
    const rowIndex = rows.findIndex((row) => row.localId === localId);
    const fieldIndex = fieldOrder.indexOf(field);
    if (rowIndex < 0 || fieldIndex < 0) return;
    if (shiftKey) {
      const prevField = fieldOrder[fieldIndex - 1];
      if (prevField) {
        focusCell(localId, prevField);
      } else if (rows[rowIndex - 1]) {
        focusCell(rows[rowIndex - 1].localId, fieldOrder[fieldOrder.length - 1]);
      }
      return;
    }
    const nextField = fieldOrder[fieldIndex + 1];
    if (nextField) {
      focusCell(localId, nextField);
    } else if (rows[rowIndex + 1]) {
      focusCell(rows[rowIndex + 1].localId, fieldOrder[0]);
    }
  }, [focusCell, rows]);

  const focusNextEmptyProduct = useCallback((localId) => {
    const rowIndex = rows.findIndex((row) => row.localId === localId);
    const nextEmpty = rows.slice(Math.max(rowIndex + 1, 0)).find((row) => isReceiptDraftRowEmpty(row));
    if (nextEmpty) focusCell(nextEmpty.localId, 'product');
  }, [focusCell, rows]);

  const commitQty = useCallback((row) => {
    const validation = getReceiptDraftRowValidation(row, { variants, t, lookups });
    if (validation.errors.qtyExpected) {
      onRowChange(row.localId, 'rowState', RECEIPT_ROW_STATE.ERROR);
      focusCell(row.localId, 'qtyExpected');
      return;
    }
    onRowChange(row.localId, 'rowState', RECEIPT_ROW_STATE.READY);
    focusScan();
  }, [focusCell, focusScan, lookups, onRowChange, t, variants]);

  const applyScanResult = useCallback(async (pickerRow) => {
    if (!onScanSelect || effectiveDisabled) return;
    const result = await onScanSelect(pickerRow);
    setScanQuery('');
    setScanError('');
    setScanResults([]);
    if (result?.localId) focusCell(result.localId, 'qtyExpected');
  }, [effectiveDisabled, focusCell, onScanSelect]);

  const resolveScan = useCallback(async () => {
    const query = asText(scanQuery);
    if (!query || scanBusy || effectiveDisabled || !onScanResolve) {
      focusScan();
      return;
    }
    setScanBusy(true);
    setScanError('');
    setScanResults([]);
    try {
      const result = await onScanResolve(query);
      if (result?.status === 'exact' && result.row) {
        await applyScanResult(result.row);
        return;
      }
      if (result?.status === 'multiple' && Array.isArray(result.rows) && result.rows.length) {
        setScanResults(result.rows);
        focusScan();
        return;
      }
      setScanError(t('wms.receipts.draftEdit.scan.notFound', 'Barcode/SKU not found'));
      focusScan();
    } catch (err) {
      setScanError(t('wms.receipts.draftEdit.scan.failed', 'Scan lookup failed'));
      focusScan();
    } finally {
      setScanBusy(false);
    }
  }, [applyScanResult, effectiveDisabled, focusScan, onScanResolve, scanBusy, scanQuery, t]);

  const clearScan = useCallback(() => {
    setScanQuery('');
    setScanError('');
    setScanResults([]);
    focusScan();
  }, [focusScan]);

  const collapseDetails = useCallback((localId) => {
    setExpandedRowIds((prev) => prev.filter((entry) => entry !== localId));
    onRowChange(localId, 'rowState', RECEIPT_ROW_STATE.READY);
  }, [onRowChange]);

  const toggleDetails = useCallback((row, rowState) => {
    if (rowState !== RECEIPT_ROW_STATE.READY && rowState !== RECEIPT_ROW_STATE.DETAILS_EXPANDED) return;
    const isExpanded = expandedRowIds.includes(row.localId);
    setExpandedRowIds((prev) => (
      isExpanded
        ? prev.filter((entry) => entry !== row.localId)
        : [...prev, row.localId]
    ));
    onRowChange(row.localId, 'rowState', isExpanded ? RECEIPT_ROW_STATE.READY : RECEIPT_ROW_STATE.DETAILS_EXPANDED);
  }, [expandedRowIds, onRowChange]);

  const toggleRow = useCallback((localId) => {
    setSelectedRowIds((prev) => (
      prev.includes(localId)
        ? prev.filter((entry) => entry !== localId)
        : [...prev, localId]
    ));
  }, []);

  const toggleAllRows = useCallback(() => {
    setSelectedRowIds((prev) => (
      prev.length === activeRows.length ? [] : activeRows.map((row) => row.localId)
    ));
  }, [activeRows]);

  const removeSelectedRows = useCallback(async () => {
    if (!selectedRows.length || !onBulkRemoveRows) return;
    setIsBulkRemoving(true);
    try {
      await onBulkRemoveRows(selectedRows.map((row) => row.localId));
      setSelectedRowIds([]);
    } finally {
      setIsBulkRemoving(false);
    }
  }, [onBulkRemoveRows, selectedRows]);

  return (
    <div className={s.draftEditor}>
      <h3 className={s.sectionTitle}>{t('wms.receipts.draftEdit.title', 'Edit draft receipt')}</h3>
      {error ? <div className={s.errorBox}>{error}</div> : null}
      <div className={s.draftGrid}>
        <label className={s.fieldStack}>
          <span className={s.fieldLabel}>{t('wms.fields.warehouse', 'Warehouse')}</span>
          <SelectField
            value={header.warehouseId}
            disabled={effectiveDisabled}
            onValueChange={(value) => onHeaderChange('warehouseId', value)}
            options={[
              { value: '', label: t('wms.create.selectWarehouse', 'Select warehouse') },
              ...warehouses.map((warehouse) => ({
                value: warehouse.id,
                label: formatWarehouseLabel(warehouse, lookups.warehousesById),
              })),
            ]}
            inputClassName={s.select}
          />
        </label>
        <label className={s.fieldStack}>
          <span className={s.fieldLabel}>{t('wms.locationOptional.inboundLabel', 'Inbound location optional')}</span>
          <SelectField
            value={header.inboundLocationId}
            disabled={effectiveDisabled}
            onValueChange={(value) => onHeaderChange('inboundLocationId', value)}
            options={[
              { value: '', label: warehouseLevelStockText(t) },
              ...scopedLocations.map((location) => ({
                value: location.id,
                label: formatLocationLabel(location, lookups.locationsById),
              })),
            ]}
            inputClassName={s.select}
          />
          {!asText(header.inboundLocationId) ? (
            <span className={s.draftDetailsMuted}>{warehouseLevelHint(t)}</span>
          ) : null}
        </label>
      </div>

      <div className={s.draftToolbar}>
        <div className={s.draftToolbarMain}>
          <span className={s.fieldLabel}>{t('wms.tabs.items', 'Items')}</span>
          <span className={s.draftHint}>
            {t('wms.receipts.draftEdit.startTypingHint', 'Начните вводить товар / SKU / EAN')}
          </span>
        </div>
        <div className={s.draftKeyboardHints} aria-label={t('wms.receipts.draftEdit.keyboardHints', 'Keyboard hints')}>
          <span className={s.draftKeyHint}><kbd>Enter</kbd>{t('wms.receipts.draftEdit.hints.enterNextRow', 'следующая строка')}</span>
          <span className={s.draftKeyHint}><kbd>Esc</kbd>{t('wms.receipts.draftEdit.hints.escCloseSearch', 'закрыть поиск')}</span>
          <span className={s.draftKeyHint}><kbd>Tab</kbd>{t('wms.receipts.draftEdit.hints.tabNextField', 'следующее поле')}</span>
        </div>
      </div>

      <div className={s.draftScanBar}>
        <label className={s.draftScanField}>
          <span className={s.fieldLabel}>{t('wms.receipts.draftEdit.scan.label', 'Scan / Quick add')}</span>
          <TextField
            ref={scanInputRef}
            value={scanQuery}
            disabled={effectiveDisabled}
            placeholder={t('wms.receipts.draftEdit.scan.placeholder', 'Scan barcode / SKU / EAN')}
            onValueChange={(value) => {
              setScanQuery(value);
              setScanError('');
              setScanResults([]);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                resolveScan();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                clearScan();
              }
            }}
            autoComplete="off"
            inputClassName={s.draftScanInput}
          />
        </label>
        <div className={s.draftScanMeta}>
          <span>{t('wms.receipts.draftEdit.scan.f2Hint', 'F2 focuses scan')}</span>
          {scanBusy ? <strong>{t('productPicker.searching', 'Searching...')}</strong> : null}
          {scanError ? <strong className={s.draftScanError}>{scanError}</strong> : null}
        </div>
        {scanResults.length ? (
          <div className={s.draftScanResults} role="listbox">
            {scanResults.map((row) => {
              const sku = asText(row.variantSku || row.sku);
              return (
                <button
                  key={`${row.productId || 'product'}:${row.variantId || 'base'}:${sku || row.ean || row.barcode || row.productName}`}
                  type="button"
                  className={s.draftScanResult}
                  onClick={() => applyScanResult(row)}
                  role="option"
                  aria-selected="false"
                >
                  <span className={s.draftScanResultTitle}>{getScanResultTitle(row)}</span>
                  <span className={s.draftScanResultMeta}>
                    {sku ? <span>SKU {sku}</span> : null}
                    {row.ean ? <span>EAN {row.ean}</span> : null}
                    {row.barcode ? <span>{t('productPicker.barcode', 'Barcode')} {row.barcode}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className={s.draftSummary}>
        <div className={s.draftSummaryItem}>
          <span>{t('wms.receipts.draftEdit.lines', 'Lines')}</span>
          <strong>{formatQty(totals.lines, locale)}</strong>
        </div>
        <div className={s.draftSummaryItem}>
          <span>{t('wms.receipts.draftEdit.totalQty', 'Qty')}</span>
          <strong>{formatQty(totals.qty, locale)}</strong>
        </div>
        <div className={s.draftSummaryItem}>
          <span>{t('wms.receipts.draftEdit.totalCost', 'Total')}</span>
          <div className={s.draftTotalList}>
            {Object.entries(totals.byCurrency).length ? Object.entries(totals.byCurrency).map(([currency, value]) => (
              <strong key={currency}>{currency} {formatMoney(value, locale)}</strong>
            )) : <strong>—</strong>}
          </div>
        </div>
      </div>

      <div className={s.draftTableShell}>
          <div className={s.draftBulkBar}>
            <span className={s.fieldLabel}>
              {t('wms.receipts.draftEdit.selectedCount', 'Selected')}: {formatQty(selectedRows.length, locale)}
            </span>
            <button
              type="button"
              className={`${s.actionChip} ${s.actionDanger}`}
              onClick={removeSelectedRows}
              disabled={effectiveDisabled || !selectedRows.length}
            >
              {isBulkRemoving
                ? t('common.saving', 'Saving...')
                : t('wms.receipts.draftEdit.removeSelected', 'Remove selected')}
            </button>
          </div>
          <div className={`${s.tableWrap} ${s.draftTableWrap}`}>
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.checkboxCell}>
                  <CheckboxField
                    checked={allRowsSelected}
                    disabled={effectiveDisabled || !activeRows.length}
                    onValueChange={() => toggleAllRows()}
                    aria-label={t('wms.receipts.draftEdit.selectAll', 'Select all lines')}
                    fullWidth={false}
                  />
                </th>
                <th>{t('wms.columns.product', 'Product')}</th>
                <th>{t('wms.create.lot', 'Lot')}</th>
                <th>{t('wms.create.serial', 'Serial')}</th>
                <th className={s.textRight}>{t('wms.columns.qty', 'Qty')}</th>
                <th className={s.textRight}>{t('wms.columns.unitCost', 'Unit cost')}</th>
                <th>{t('wms.columns.currency', 'Currency')}</th>
                <th className={s.textRight}>{t('wms.receipts.draftEdit.rowTotal', 'Row total')}</th>
                <th className={s.textRight}>{t('common.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isEmptyRow = isReceiptDraftRowEmpty(row);
                const validation = getReceiptDraftRowValidation(row, { variants, t, lookups });
                const rowState = getReceiptDraftRowState(row, validation);
                const rowTotal = getRowTotal(row);
                const rowCurrency = getRowCurrency(row);
                const priceSourceText = isEmptyRow ? '' : getPurchasePriceSourceText(row.purchasePriceSource, t);
                const priceWarnings = isEmptyRow ? [] : getPurchasePriceWarnings(row, t);
                const lotBadge = getReceiptDraftLotBadge(row, lookups, t);
                const isExpanded = expandedRowIds.includes(row.localId);
                const canToggleDetails = rowState === RECEIPT_ROW_STATE.READY || rowState === RECEIPT_ROW_STATE.DETAILS_EXPANDED;
                return (
                  <Fragment key={row.localId}>
                    <tr
                      className={s.draftDataRow}
                      data-row-state={rowState}
                      data-row-expanded={isExpanded ? 'true' : 'false'}
                    >
                      <td className={s.checkboxCell}>
                        <CheckboxField
                          checked={selectedRowIds.includes(row.localId)}
                          disabled={effectiveDisabled || isEmptyRow}
                          onValueChange={() => toggleRow(row.localId)}
                          aria-label={t('wms.receipts.draftEdit.selectLine', 'Select line')}
                          fullWidth={false}
                        />
                      </td>
                      <td>
                        <ReceiptDraftProductPicker
                          row={row}
                          lookups={lookups}
                          t={t}
                          disabled={effectiveDisabled}
                          warehouseId={warehouseId}
                          fieldRef={(node) => setFieldRef(row.localId, 'product', node)}
                          onFocus={() => onRowChange(row.localId, 'rowState', RECEIPT_ROW_STATE.SEARCHING_PRODUCT)}
                          onKeyDownCapture={(event) => {
                            if (event.key === 'Tab') {
                              event.preventDefault();
                              focusNextField(row.localId, 'product', event.shiftKey);
                            }
                          }}
                          onProductSelect={(payload, productPickerRow) => {
                            onProductSelect(row.localId, payload, productPickerRow);
                            focusCell(row.localId, 'qtyExpected');
                          }}
                          onClearProduct={() => onRowChange(row.localId, 'productId', '')}
                        />
                        <div className={s.draftRowMeta}>
                          <span className={s.draftStateBadge}>{getReceiptDraftRowStateLabel(rowState, t)}</span>
                          {validation.errors.productId ? <span className={s.draftFieldError}>{validation.errors.productId}</span> : null}
                          {validation.hasWarnings ? <span className={s.draftFieldWarning}>{Object.values(validation.warnings)[0]}</span> : null}
                        </div>
                      </td>
                      <td>
                        <TextField
                          value={row.lotNumber || ''}
                          disabled={effectiveDisabled}
                          ref={(node) => setFieldRef(row.localId, 'lotNumber', node)}
                          onValueChange={(value) => onRowChange(row.localId, 'lotNumber', value)}
                          inputClassName={s.draftControl}
                        />
                        {lotBadge ? (
                          <div className={s.draftCellMeta}>
                            <span className={s.draftLotBadge} data-state={lotBadge.state}>{lotBadge.text}</span>
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <TextField
                          value={row.serialNumber || ''}
                          disabled={effectiveDisabled}
                          ref={(node) => setFieldRef(row.localId, 'serialNumber', node)}
                          onValueChange={(value) => onRowChange(row.localId, 'serialNumber', value)}
                          inputClassName={s.draftControl}
                        />
                      </td>
                      <td>
                        <NumberField
                          value={row.qtyExpected ?? ''}
                          emitAs="string"
                          min="0.0001"
                          step="0.0001"
                          disabled={effectiveDisabled}
                          ref={(node) => setFieldRef(row.localId, 'qtyExpected', node)}
                          onFocus={() => onRowChange(row.localId, 'rowState', RECEIPT_ROW_STATE.QTY_EDITING)}
                          onValueChange={(value) => onRowChange(row.localId, 'qtyExpected', value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              commitQty(row);
                            } else if (event.key === 'Tab') {
                              event.preventDefault();
                              focusNextField(row.localId, 'qtyExpected', event.shiftKey);
                            } else if (event.key === 'ArrowDown') {
                              moveGridFocus(row.localId, 'qtyExpected', 1);
                            } else if (event.key === 'ArrowUp') {
                              moveGridFocus(row.localId, 'qtyExpected', -1);
                            }
                          }}
                          inputClassName={`${s.draftControl} ${s.draftNumberControl}`}
                        />
                        {validation.errors.qtyExpected ? <span className={s.draftFieldError}>{validation.errors.qtyExpected}</span> : null}
                      </td>
                      <td>
                        <div className={s.draftPriceCell}>
                          <NumberField
                            value={row.unitCost ?? ''}
                            emitAs="string"
                            min="0"
                            step="0.0001"
                            disabled={effectiveDisabled}
                            ref={(node) => setFieldRef(row.localId, 'unitCost', node)}
                            onValueChange={(value) => onRowChange(row.localId, 'unitCost', value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Tab') {
                                event.preventDefault();
                                focusNextField(row.localId, 'unitCost', event.shiftKey);
                              } else if (event.key === 'ArrowDown') {
                                moveGridFocus(row.localId, 'unitCost', 1);
                              } else if (event.key === 'ArrowUp') {
                                moveGridFocus(row.localId, 'unitCost', -1);
                              }
                            }}
                            inputClassName={`${s.draftControl} ${s.draftNumberControl}`}
                          />
                          {priceSourceText ? <span className={s.draftPriceBadge}>{priceSourceText}</span> : null}
                          {priceWarnings.map((warning) => (
                            <span key={warning} className={s.draftPriceWarning}>{warning}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <TextField
                          value={row.currency || ''}
                          disabled={effectiveDisabled}
                          ref={(node) => setFieldRef(row.localId, 'currency', node)}
                          onValueChange={(value) => onRowChange(row.localId, 'currency', value.toUpperCase())}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              if (rowState === RECEIPT_ROW_STATE.READY) focusNextEmptyProduct(row.localId);
                            } else if (event.key === 'Tab') {
                              event.preventDefault();
                              focusNextField(row.localId, 'currency', event.shiftKey);
                            } else if (event.key === 'ArrowDown') {
                              moveGridFocus(row.localId, 'currency', 1);
                            } else if (event.key === 'ArrowUp') {
                              moveGridFocus(row.localId, 'currency', -1);
                            }
                          }}
                          inputClassName={s.draftControl}
                        />
                      </td>
                      <td className={s.textRight}>
                        <strong className={s.draftRowTotal}>{isEmptyRow ? '—' : `${rowCurrency} ${formatMoney(rowTotal, locale)}`}</strong>
                      </td>
                      <td className={s.textRight}>
                        <div className={s.draftRowActions}>
                          <button
                            type="button"
                            className={s.draftDetailsToggle}
                            onClick={() => toggleDetails(row, rowState)}
                            disabled={effectiveDisabled || !canToggleDetails}
                            aria-expanded={isExpanded}
                            aria-label={isExpanded
                              ? t('wms.receipts.draftEdit.details.collapse', 'Collapse details')
                              : t('wms.receipts.draftEdit.details.expand', 'Expand details')}
                            title={isExpanded
                              ? t('wms.receipts.draftEdit.details.collapse', 'Collapse details')
                              : t('wms.receipts.draftEdit.details.expand', 'Expand details')}
                          >
                            <span aria-hidden="true">{isExpanded ? '▼' : '▶'}</span>
                          </button>
                          <button
                            type="button"
                            className={`${s.actionChip} ${s.actionDanger}`}
                            onClick={() => onRemoveRow(row.localId)}
                            disabled={effectiveDisabled || isEmptyRow}
                          >
                            {t('common.remove', 'Remove')}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <ReceiptDraftDetailsRow
                        row={row}
                        lookups={lookups}
                        locations={scopedLocations}
                        inboundLocationId={asText(header.inboundLocationId)}
                        validation={validation}
                        priceSourceText={priceSourceText}
                        priceWarnings={priceWarnings}
                        effectiveDisabled={effectiveDisabled}
                        t={t}
                        onRowChange={onRowChange}
                        onCollapse={() => collapseDetails(row.localId)}
                      />
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
    </div>
  );
}

// --- read-only items table (WMS shape) rendered inside the engine itemsSlot ---
function WmsItemsTable({ items, kind, locale, t, lookups, processedByItem, rowAction }) {
  const hasRowAction = typeof rowAction === 'function';
  return (
    <>
      <h3 className={s.sectionTitle}>{t('wms.tabs.items', 'Items')}</h3>
      {!items.length ? (
        <p className={s.empty}>{t('wms.items.empty', 'No items')}</p>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>{t('wms.columns.product', 'Product')}</th>
                <th>{t('wms.columns.variant', 'Variant')}</th>
                <th className={s.textRight}>{t('wms.columns.qty', 'Qty')}</th>
                <th className={s.textRight}>{t('wms.columns.progress', 'Processed')}</th>
                {hasRowAction ? <th className={s.textRight}>{t('common.actions', 'Actions')}</th> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id || `${item.productId || 'product'}-${item.variantId || 'variant'}`}>
                  <td>{itemName(item, lookups)}</td>
                  <td>{itemVariant(item, lookups)}</td>
                  <td className={s.textRight}>{formatQty(itemQty(item, kind), locale)}</td>
                  <td className={s.textRight}>
                    {itemProgress(item, kind, processedByItem) === null
                      ? '—'
                      : formatQty(itemProgress(item, kind, processedByItem), locale)}
                  </td>
                  {hasRowAction ? <td className={s.textRight}>{rowAction(item)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ShipShipmentModal({ open, title, items, locations, selectedLocationId, onLocationChange, onClose, onSubmit, t, locale, isSubmitting, error, shippedByItem, lookups }) {
  const totalQty = items.reduce((acc, item) => acc + pendingShipmentQty(item, shippedByItem), 0);
  const canSubmit = items.length > 0 && !isSubmitting;
  const footer = (
    <>
      <Modal.Button type="button" onClick={onClose} disabled={isSubmitting}>
        {t('common.cancel', 'Cancel')}
      </Modal.Button>
      <Modal.Button type="button" variant="primary" disabled={!canSubmit} onClick={onSubmit}>
        {isSubmitting ? t('common.saving', 'Saving...') : t('wms.shipments.actions.ship', 'Ship')}
      </Modal.Button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={isSubmitting ? undefined : onClose}
      title={title}
      size="lg"
      footer={footer}
      closeOnOverlay={!isSubmitting}
    >
      <div className={s.shipModal}>
        {error ? <div className={s.errorBox}>{error}</div> : null}
        <label className={s.fieldLabel} htmlFor="wms-ship-from-location">
          {t('wms.locationOptional.fromLabel', 'Source location optional')}
        </label>
        <SelectField
          id="wms-ship-from-location"
          value={selectedLocationId}
          onValueChange={onLocationChange}
          disabled={isSubmitting}
          options={[
            { value: '', label: warehouseLevelStockText(t) },
            ...locations.map((location) => ({
              value: location.id,
              label: formatLocationLabel(location, lookups.locationsById),
            })),
          ]}
          inputClassName={s.select}
        />
        {!selectedLocationId ? (
          <p className={s.empty}>{warehouseLevelHint(t)}</p>
        ) : null}
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>{t('wms.columns.product', 'Product')}</th>
                <th>{t('wms.columns.variant', 'Variant')}</th>
                <th className={s.textRight}>{t('wms.columns.qty', 'Qty')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{itemName(item, lookups)}</td>
                  <td>{itemVariant(item, lookups)}</td>
                  <td className={s.textRight}>{formatQty(pendingShipmentQty(item, shippedByItem), locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={s.empty}>
          {t('wms.shipments.shipTotal', 'Total to ship')}: {formatQty(totalQty, locale)}
        </p>
      </div>
    </Modal>
  );
}

function HistorySection({ historyItems, locale, t, lookups }) {
  if (!historyItems.length) return <p className={s.empty}>{t('wms.history.empty', 'No stock moves')}</p>;
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>{t('wms.history.columns.date', 'Date')}</th>
            <th>{t('wms.history.columns.type', 'Type')}</th>
            <th>{t('wms.history.columns.product', 'Product')}</th>
            <th className={s.textRight}>{t('wms.history.columns.qty', 'Qty')}</th>
            <th>{t('wms.history.columns.from', 'From')}</th>
            <th>{t('wms.history.columns.to', 'To')}</th>
            <th>{t('wms.history.columns.refItem', 'Ref item')}</th>
          </tr>
        </thead>
        <tbody>
          {historyItems.map((move) => (
            <tr key={move.id || `${move.refItemId || 'row'}-${move.createdAt || ''}`}>
              <td>{formatDate(move?.createdAt, locale)}</td>
              <td>{asText(move?.type) || '—'}</td>
              <td>{formatProductLabel(move?.product || move?.productId, lookups.productsById)}</td>
              <td className={s.textRight}>{formatQty(move?.qty, locale)}</td>
              <td>{formatOptionalLocationLabel(move?.fromLocation || move?.fromLocationId, lookups.locationsById, t)}</td>
              <td>{formatOptionalLocationLabel(move?.toLocation || move?.toLocationId, lookups.locationsById, t)}</td>
              <td>{asText(move?.refType) || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CorrectionModal({ open, onClose, onSubmit, document, kind, locale, t, isSubmitting, error, lookups }) {
  const items = useMemo(() => (Array.isArray(document?.items) ? document.items : []), [document?.items]);
  const selectableItems = useMemo(
    () => items.filter((item) => item?.id && correctionQty(item, kind) > 0),
    [items, kind]
  );
  const [selectedIds, setSelectedIds] = useState([]);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setSelectedIds(selectableItems.map((item) => item.id));
    setReason('');
  }, [open, selectableItems]);

  const toggleLine = useCallback((itemId) => {
    setSelectedIds((prev) => (prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]));
  }, []);

  const canSubmit = selectedIds.length > 0 && !isSubmitting;

  const footer = (
    <>
      <Modal.Button type="button" onClick={onClose} disabled={isSubmitting}>
        {t('common.cancel', 'Cancel')}
      </Modal.Button>
      <Modal.Button
        type="button"
        variant="primary"
        disabled={!canSubmit}
        onClick={() => {
          const selected = selectableItems.filter((item) => selectedIds.includes(item.id));
          onSubmit({
            reason: asText(reason) || undefined,
            items: selected.map((item) => ({ originalItemId: item.id, qty: correctionQty(item, kind) })),
          });
        }}
      >
        {isSubmitting ? t('common.saving', 'Saving...') : t('wms.corrections.submit', 'Create correction')}
      </Modal.Button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={isSubmitting ? undefined : onClose}
      title={t('wms.corrections.title', 'Create correction')}
      size="lg"
      footer={footer}
      closeOnOverlay={!isSubmitting}
    >
      <div className={s.correctionModal}>
        <p className={s.correctionHint}>
          {t('wms.corrections.fullLineHint', 'MVP supports full-line correction only. Quantity is read-only and equals the original processed quantity.')}
        </p>
        {error ? <div className={s.errorBox}>{error}</div> : null}
        <label className={s.fieldLabel} htmlFor="wms-correction-reason">{t('wms.corrections.reason', 'Reason')}</label>
        <TextareaField
          id="wms-correction-reason"
          value={reason}
          onValueChange={setReason}
          disabled={isSubmitting}
          placeholder={t('wms.corrections.reasonPlaceholder', 'Optional reason')}
          rows={3}
          inputClassName={s.textarea}
        />
        {!selectableItems.length ? (
          <p className={s.empty}>{t('wms.corrections.noLines', 'No lines available for correction')}</p>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t('wms.corrections.select', 'Select')}</th>
                  <th>{t('wms.columns.product', 'Product')}</th>
                  <th>{t('wms.columns.variant', 'Variant')}</th>
                  <th className={s.textRight}>{t('wms.columns.qty', 'Qty')}</th>
                </tr>
              </thead>
              <tbody>
                {selectableItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <CheckboxField
                        checked={selectedIds.includes(item.id)}
                        onValueChange={() => toggleLine(item.id)}
                        disabled={isSubmitting}
                        aria-label={t('wms.corrections.selectLine', 'Select line')}
                        fullWidth={false}
                      />
                    </td>
                    <td>{itemName(item, lookups)}</td>
                    <td>{itemVariant(item, lookups)}</td>
                    <td className={s.textRight}>{formatQty(correctionQty(item, kind), locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function WarehouseDocumentDetailPage({ kind = 'receipt' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { can } = useAclPermissions();
  const locale = i18n.language;

  const [actionError, setActionError] = useState('');
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionError, setCorrectionError] = useState('');
  const [shipModal, setShipModal] = useState({ open: false, mode: 'line', items: [] });
  const [shipLocationId, setShipLocationId] = useState('');
  const [shipError, setShipError] = useState('');
  const [receiptDraftEditing, setReceiptDraftEditing] = useState(false);
  const [receiptDraftHeader, setReceiptDraftHeader] = useState({ warehouseId: '', inboundLocationId: '' });
  const [receiptDraftRows, setReceiptDraftRows] = useState([]);
  const [receiptDraftRemovedIds, setReceiptDraftRemovedIds] = useState([]);
  const [receiptDraftError, setReceiptDraftError] = useState('');
  const [wmsViewMode, setWmsViewMode] = useState('preview');

  const [receiveReceiptLine, { isLoading: isReceivingReceipt }] = useReceiveReceiptLineMutation();
  const [updateReceiptDraft, { isLoading: isUpdatingReceiptDraft }] = useUpdateReceiptDraftMutation();
  const [addReceiptDraftItem, { isLoading: isAddingReceiptDraftItem }] = useAddReceiptDraftItemMutation();
  const [updateReceiptDraftItem, { isLoading: isUpdatingReceiptDraftItem }] = useUpdateReceiptDraftItemMutation();
  const [removeReceiptDraftItem, { isLoading: isRemovingReceiptDraftItem }] = useRemoveReceiptDraftItemMutation();
  const [executeTransferLine, { isLoading: isExecutingTransfer }] = useExecuteTransferLineMutation();
  const [postAdjustment, { isLoading: isPostingAdjustment }] = usePostAdjustmentMutation();
  const [createReceiptCorrection, { isLoading: isCreatingReceiptCorrection }] = useCreateReceiptCorrectionMutation();
  const [createShipmentCorrection, { isLoading: isCreatingShipmentCorrection }] = useCreateShipmentCorrectionMutation();
  const [shipShipmentItem, { isLoading: isShippingShipment }] = useShipShipmentItemMutation();
  const [fetchProductById] = useLazyGetProductQuery();
  const [fetchVariantById] = useLazyGetProductVariantQuery();
  const [resolveProductPicker] = useLazyProductPickerQuery();

  const [exactProductsById, setExactProductsById] = useState({});
  const [exactVariantsById, setExactVariantsById] = useState({});

  const { data: warehousesData } = useListWarehousesQuery({ limit: 200, sort: 'name', dir: 'ASC' });
  const { data: locationsData } = useListLocationsQuery({ limit: 200, sort: 'code', dir: 'ASC' });
  const { data: productsData } = useListProductsQuery({ page: 1, limit: 100, sort: 'updatedAt', dir: 'DESC' });
  const { data: variantsData } = useListProductVariantsQuery({ page: 1, limit: 200 });

  const adjustmentQuery = useGetAdjustmentByIdQuery(id, { skip: kind !== 'adjustment' || !id, refetchOnMountOrArgChange: true });
  const receiptQuery = useGetReceiptByIdQuery(id, { skip: kind !== 'receipt' || !id, refetchOnMountOrArgChange: true });
  const transferQuery = useGetTransferByIdQuery(id, { skip: kind !== 'transfer' || !id, refetchOnMountOrArgChange: true });
  const shipmentQuery = useGetShipmentByIdQuery(id, { skip: kind !== 'shipment' || !id, refetchOnMountOrArgChange: true });
  const historyQueryArgs = useMemo(() => ({ id, page: 1, limit: 200 }), [id]);

  const adjustmentHistoryQuery = useGetAdjustmentStockMovesQuery(historyQueryArgs, { skip: kind !== 'adjustment' || !id, refetchOnMountOrArgChange: true });
  const receiptHistoryQuery = useGetReceiptStockMovesQuery(historyQueryArgs, { skip: kind !== 'receipt' || !id, refetchOnMountOrArgChange: true });
  const transferHistoryQuery = useGetTransferStockMovesQuery(historyQueryArgs, { skip: kind !== 'transfer' || !id, refetchOnMountOrArgChange: true });
  const shipmentHistoryQuery = useGetShipmentStockMovesQuery(historyQueryArgs, { skip: kind !== 'shipment' || !id, refetchOnMountOrArgChange: true });

  const activeQuery = kind === 'adjustment' ? adjustmentQuery
    : kind === 'receipt' ? receiptQuery
      : kind === 'transfer' ? transferQuery
        : shipmentQuery;
  const activeHistoryQuery = kind === 'adjustment' ? adjustmentHistoryQuery
    : kind === 'receipt' ? receiptHistoryQuery
      : kind === 'transfer' ? transferHistoryQuery
        : shipmentHistoryQuery;

  const base = activeQuery?.data || null;
  const policy = useMemo(() => getWmsDocumentPolicy({ kind, document: base }), [base, kind]);
  const isCreatingCorrection = isCreatingReceiptCorrection || isCreatingShipmentCorrection;
  const isSavingReceiptDraft = isUpdatingReceiptDraft
    || isAddingReceiptDraftItem
    || isUpdatingReceiptDraftItem
    || isRemovingReceiptDraftItem;
  const canShipShipment = can('wms:document:post');
  const historyItems = useMemo(
    () => (Array.isArray(activeHistoryQuery?.data?.items) ? activeHistoryQuery.data.items : []),
    [activeHistoryQuery?.data?.items]
  );
  const documentItems = useMemo(() => (Array.isArray(base?.items) ? base.items : []), [base?.items]);
  const shippedByItem = useMemo(
    () => (kind === 'shipment' ? shippedQtyByShipmentItem(historyItems) : {}),
    [historyItems, kind]
  );
  const shipmentLocations = useMemo(() => {
    const rows = Array.isArray(locationsData?.items) ? locationsData.items : [];
    const warehouseId = asText(base?.warehouseId);
    const scoped = warehouseId ? rows.filter((location) => asText(location?.warehouseId) === warehouseId) : rows;
    return scoped.length ? scoped : rows;
  }, [base?.warehouseId, locationsData?.items]);
  const canShowShipmentActions = kind === 'shipment'
    && canShipShipment
    && asText(base?.status).toLowerCase() === 'packing'
    && !base?.parentDocumentId;
  const canEditReceiptDraft = kind === 'receipt'
    && can('wms:document:update')
    && asText(base?.status).toLowerCase() === 'draft'
    && !base?.parentDocumentId;

  useEffect(() => {
    setReceiptDraftEditing(false);
    setReceiptDraftHeader({ warehouseId: '', inboundLocationId: '' });
    setReceiptDraftRows([]);
    setReceiptDraftRemovedIds([]);
    setReceiptDraftError('');
    setWmsViewMode('preview');
  }, [id, kind]);

  useEffect(() => {
    if (canEditReceiptDraft || wmsViewMode !== 'edit') return;
    setReceiptDraftEditing(false);
    setReceiptDraftHeader({ warehouseId: '', inboundLocationId: '' });
    setReceiptDraftRows([]);
    setReceiptDraftRemovedIds([]);
    setReceiptDraftError('');
    setWmsViewMode('preview');
  }, [canEditReceiptDraft, wmsViewMode]);

  const shippableItems = useMemo(() => {
    if (!canShowShipmentActions) return [];
    return documentItems.filter((item) => item?.id && pendingShipmentQty(item, shippedByItem) > 0);
  }, [canShowShipmentActions, documentItems, shippedByItem]);
  const productIds = useMemo(() => uniqueIds([...documentItems, ...historyItems], 'productId'), [documentItems, historyItems]);
  const variantIds = useMemo(() => uniqueIds([...documentItems, ...historyItems], 'variantId'), [documentItems, historyItems]);
  const productIdsKey = productIds.join('|');
  const variantIdsKey = variantIds.join('|');

  useEffect(() => {
    const listedProductsById = buildLookupMap(productsData?.items || []);
    const missingIds = productIds.filter((productId) => !listedProductsById.has(productId) && !exactProductsById[productId]);
    if (!missingIds.length) return;
    let cancelled = false;
    Promise.all(
      missingIds.map((productId) => (
        fetchProductById(productId, true).unwrap().then((product) => [productId, product]).catch(() => null)
      ))
    ).then((rows) => {
      if (cancelled) return;
      const next = {};
      rows.forEach((entry) => {
        if (entry?.[0] && entry?.[1]) next[entry[0]] = entry[1];
      });
      if (Object.keys(next).length) {
        setExactProductsById((prev) => ({ ...prev, ...next }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [exactProductsById, fetchProductById, productIds, productIdsKey, productsData?.items]);

  useEffect(() => {
    const listedVariantsById = buildLookupMap(variantsData?.items || []);
    const missingIds = variantIds.filter((variantId) => !listedVariantsById.has(variantId) && !exactVariantsById[variantId]);
    if (!missingIds.length) return;
    let cancelled = false;
    Promise.all(
      missingIds.map((variantId) => (
        fetchVariantById(variantId, true).unwrap().then((variant) => [variantId, variant]).catch(() => null)
      ))
    ).then((rows) => {
      if (cancelled) return;
      const next = {};
      rows.forEach((entry) => {
        if (entry?.[0] && entry?.[1]) next[entry[0]] = entry[1];
      });
      if (Object.keys(next).length) {
        setExactVariantsById((prev) => ({ ...prev, ...next }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [exactVariantsById, fetchVariantById, variantIds, variantIdsKey, variantsData?.items]);

  const lookups = useMemo(() => ({
    warehousesById: buildLookupMap(warehousesData?.items || []),
    locationsById: buildLookupMap(locationsData?.items || []),
    productsById: buildLookupMap([...(productsData?.items || []), ...Object.values(exactProductsById)]),
    variantsById: buildLookupMap([...(variantsData?.items || []), ...Object.values(exactVariantsById)]),
  }), [exactProductsById, exactVariantsById, locationsData?.items, productsData?.items, variantsData?.items, warehousesData?.items]);

  const receiptVariantOptions = useMemo(
    () => [...(variantsData?.items || []), ...Object.values(exactVariantsById)],
    [exactVariantsById, variantsData?.items]
  );

  const startReceiptDraftEdit = useCallback(() => {
    if (!canEditReceiptDraft || !base) return;
    setReceiptDraftHeader({
      warehouseId: asText(base.warehouseId),
      inboundLocationId: asText(base.inboundLocationId || base.locationId),
    });
    setReceiptDraftRows(normalizeReceiptDraftRows((Array.isArray(base.items) ? base.items : []).map(makeReceiptDraftRow)));
    setReceiptDraftRemovedIds([]);
    setReceiptDraftError('');
    setActionError('');
    setReceiptDraftEditing(true);
    setWmsViewMode('edit');
  }, [base, canEditReceiptDraft]);

  const cancelReceiptDraftEdit = useCallback(() => {
    if (isSavingReceiptDraft) return;
    setReceiptDraftEditing(false);
    setReceiptDraftHeader({ warehouseId: '', inboundLocationId: '' });
    setReceiptDraftRows([]);
    setReceiptDraftRemovedIds([]);
    setReceiptDraftError('');
    setWmsViewMode('preview');
  }, [isSavingReceiptDraft]);

  const onWmsViewModeChange = useCallback((mode) => {
    if (mode === 'edit') {
      if (canEditReceiptDraft) startReceiptDraftEdit();
      return;
    }
    if (mode === 'preview') {
      cancelReceiptDraftEdit();
    }
  }, [canEditReceiptDraft, cancelReceiptDraftEdit, startReceiptDraftEdit]);

  const onReceiptDraftHeaderChange = useCallback((field, value) => {
    setReceiptDraftHeader((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'warehouseId' ? { inboundLocationId: '' } : {}),
    }));
  }, []);

  const onReceiptDraftRowChange = useCallback((localId, field, value) => {
    setReceiptDraftRows((prev) => normalizeReceiptDraftRows(prev.map((row) => {
      if (row.localId !== localId) return row;
      return {
        ...row,
        [field]: value,
        ...(field === 'productId' ? {
          variantId: '',
          pickerProductName: '',
          pickerVariantLabel: '',
          purchasePriceSource: '',
          purchasePriceCurrency: '',
          purchasePriceWarning: '',
          hasVariants: false,
          isLotTracked: false,
          isSerialized: false,
          ...(!asText(value) ? { unitCost: '', currency: '', unitCostManual: false } : {}),
        } : {}),
        ...(field === 'unitCost' ? {
          unitCostManual: true,
          purchasePriceSource: 'manual',
          purchasePriceWarning: '',
        } : {}),
      };
    })));
  }, []);

  const onReceiptDraftProductSelect = useCallback((localId, payload, pickerRow = {}) => {
    const productId = asText(payload?.productId);
    if (!productId) return;

    const variantId = asText(payload?.variantId);
    const productName = asText(payload?.productName || pickerRow?.productName);
    const variantLabel = asText(payload?.variantLabel || pickerRow?.variantLabel);
    const purchaseValue = pickerRow?.purchasePrice?.value;
    const purchaseCost = Number.isFinite(Number(purchaseValue)) ? String(purchaseValue) : '';
    const purchaseCurrency = asText(pickerRow?.purchasePrice?.currency);
    const purchaseSource = asText(pickerRow?.purchasePrice?.source);
    const productLookup = (productsData?.items || []).find((product) => asText(product.id) === productId);
    const isLotTracked = Boolean(pickerRow?.isLotTracked ?? productLookup?.isLotTracked);
    const isSerialized = Boolean(pickerRow?.isSerialized ?? productLookup?.isSerialized);

    setExactProductsById((prev) => ({
      ...prev,
      [productId]: {
        id: productId,
        name: productName,
        productName,
        sku: pickerRow?.sku || null,
        isLotTracked,
        isSerialized,
      },
    }));
    if (variantId) {
      setExactVariantsById((prev) => ({
        ...prev,
        [variantId]: {
          id: variantId,
          productId,
          name: variantLabel,
          variantLabel,
          sku: pickerRow?.variantSku || payload?.sku || null,
        },
      }));
    }

    setReceiptDraftRows((prev) => normalizeReceiptDraftRows(prev.map((row) => {
      if (row.localId !== localId) return row;

      const productChanged = asText(row.productId) !== productId || asText(row.variantId) !== variantId;
      const shouldApplySuggestedCost = Boolean(purchaseCost)
        && (productChanged || !row.unitCostManual || !asText(row.unitCost));
      const nextUnitCost = shouldApplySuggestedCost
        ? purchaseCost
        : (!purchaseCost && productChanged && !row.unitCostManual ? '' : row.unitCost);
      const currentCurrency = asText(row.currency);
      const nextCurrency = purchaseCurrency && !currentCurrency
        ? purchaseCurrency
        : (currentCurrency || 'PLN');

      return {
        ...row,
        productId,
        variantId,
        pickerProductName: productName,
        pickerVariantLabel: variantLabel,
        unitCost: nextUnitCost,
        currency: nextCurrency,
        unitCostManual: shouldApplySuggestedCost ? false : Boolean(row.unitCostManual),
        purchasePriceSource: purchaseCost ? purchaseSource : (row.unitCostManual && asText(row.unitCost) ? 'manual' : ''),
        purchasePriceCurrency: purchaseCurrency,
        purchasePriceWarning: purchaseCost ? '' : 'No suggested purchase price',
        hasVariants: Boolean(pickerRow?.hasVariants),
        isLotTracked,
        isSerialized,
        rowState: RECEIPT_ROW_STATE.PRODUCT_SELECTED,
      };
    })));
  }, [productsData?.items]);

  const onReceiptDraftScanResolve = useCallback(async (query) => {
    const text = asText(query);
    if (!text) return { status: 'empty', rows: [] };
    const result = await resolveProductPicker({
      q: text,
      limit: 8,
      warehouseId: asText(receiptDraftHeader.warehouseId) || undefined,
    }).unwrap();
    const rows = Array.isArray(result?.items) ? result.items : [];
    const exactRows = rows.filter((row) => isExactPickerScanMatch(row, text));
    if (exactRows.length === 1) return { status: 'exact', row: exactRows[0], rows: exactRows };
    if (exactRows.length > 1) return { status: 'multiple', rows: exactRows };
    if (rows.length) return { status: 'multiple', rows };
    return { status: 'notFound', rows: [] };
  }, [receiptDraftHeader.warehouseId, resolveProductPicker]);

  const onReceiptDraftScanSelect = useCallback(async (pickerRow) => {
    const targetRow = receiptDraftRows.find((row) => isReceiptDraftRowEmpty(row))
      || receiptDraftRows[receiptDraftRows.length - 1];
    if (!targetRow) return null;
    onReceiptDraftProductSelect(targetRow.localId, scanPickerPayload(pickerRow), pickerRow);
    return { localId: targetRow.localId };
  }, [onReceiptDraftProductSelect, receiptDraftRows]);

  const onRemoveReceiptDraftRow = useCallback((localId) => {
    setReceiptDraftRows((prev) => {
      const row = prev.find((entry) => entry.localId === localId);
      if (row?.id) {
        setReceiptDraftRemovedIds((ids) => (ids.includes(row.id) ? ids : [...ids, row.id]));
      }
      return normalizeReceiptDraftRows(prev.filter((entry) => entry.localId !== localId));
    });
  }, []);

  const onBulkRemoveReceiptDraftRows = useCallback(async (localIds) => {
    if (!id || !canEditReceiptDraft || !receiptDraftEditing || !Array.isArray(localIds) || !localIds.length) return;
    setReceiptDraftError('');
    setActionError('');
    const selectedRows = receiptDraftRows.filter((row) => localIds.includes(row.localId));
    const localOnlyIds = selectedRows.filter((row) => !row.id).map((row) => row.localId);
    const persistedIds = selectedRows.filter((row) => row.id).map((row) => row.id);

    if (localOnlyIds.length) {
      setReceiptDraftRows((prev) => normalizeReceiptDraftRows(prev.filter((row) => !localOnlyIds.includes(row.localId))));
    }
    if (!persistedIds.length) return;

    try {
      for (const itemId of persistedIds) {
        // eslint-disable-next-line no-await-in-loop
        await removeReceiptDraftItem({ id, itemId }).unwrap();
      }
      setReceiptDraftRows((prev) => normalizeReceiptDraftRows(prev.filter((row) => !persistedIds.includes(row.id))));
      setReceiptDraftRemovedIds((prev) => prev.filter((itemId) => !persistedIds.includes(itemId)));
      await Promise.all([activeQuery.refetch?.(), activeHistoryQuery.refetch?.()]);
    } catch (err) {
      const message = getWmsActionErrorText(err, t);
      setReceiptDraftError(message);
      setActionError(message);
      throw err;
    }
  }, [
    activeHistoryQuery,
    activeQuery,
    canEditReceiptDraft,
    id,
    receiptDraftEditing,
    receiptDraftRows,
    removeReceiptDraftItem,
    t,
  ]);

  const onSaveReceiptDraft = useCallback(async () => {
    if (!id || !canEditReceiptDraft || !receiptDraftEditing) return;
    setReceiptDraftError('');
    setActionError('');
    try {
      if (!asText(receiptDraftHeader.warehouseId)) {
        throw new Error(t('wms.validation.warehouseRequired', 'Warehouse is required'));
      }
      const saveRows = receiptDraftPersistableRows(receiptDraftRows);
      if (!saveRows.length) {
        throw new Error(t('wms.validation.itemRequired', 'At least one item is required'));
      }
      saveRows.forEach((row) => {
        const validation = getReceiptDraftRowValidation(row, { variants: receiptVariantOptions, t, lookups });
        if (validation.hasErrors) {
          throw new Error(Object.values(validation.errors)[0]);
        }
      });

      await updateReceiptDraft({
        id,
        payload: {
          warehouseId: receiptDraftHeader.warehouseId,
          inboundLocationId: asText(receiptDraftHeader.inboundLocationId) || null,
        },
      }).unwrap();

      for (const itemId of receiptDraftRemovedIds) {
        // eslint-disable-next-line no-await-in-loop
        await removeReceiptDraftItem({ id, itemId }).unwrap();
      }

      for (const row of saveRows) {
        const payload = receiptDraftItemPayload(row);
        if (row.id) {
          // eslint-disable-next-line no-await-in-loop
          await updateReceiptDraftItem({ id, itemId: row.id, payload }).unwrap();
        } else {
          // eslint-disable-next-line no-await-in-loop
          await addReceiptDraftItem({ id, payload }).unwrap();
        }
      }

      setReceiptDraftEditing(false);
      setReceiptDraftHeader({ warehouseId: '', inboundLocationId: '' });
      setReceiptDraftRows([]);
      setReceiptDraftRemovedIds([]);
      setWmsViewMode('preview');
      await Promise.all([activeQuery.refetch?.(), activeHistoryQuery.refetch?.()]);
    } catch (err) {
      const message = getWmsActionErrorText(err, t);
      setReceiptDraftError(message);
      setActionError(message);
    }
  }, [
    activeHistoryQuery,
    activeQuery,
    addReceiptDraftItem,
    canEditReceiptDraft,
    id,
    receiptDraftEditing,
    receiptDraftHeader.inboundLocationId,
    receiptDraftHeader.warehouseId,
    receiptDraftRemovedIds,
    receiptDraftRows,
    receiptVariantOptions,
    lookups,
    removeReceiptDraftItem,
    t,
    updateReceiptDraft,
    updateReceiptDraftItem,
  ]);

  const onReceiveAll = useCallback(async () => {
    if (!id || kind !== 'receipt' || !base) return;
    setActionError('');
    try {
      const toLocationId = asText(base.inboundLocationId || base.locationId) || null;
      const lines = (Array.isArray(base.items) ? base.items : [])
        .map((line) => {
          const qtyExpected = asNumber(line?.qtyExpected ?? line?.qty, 0);
          const qtyReceived = asNumber(line?.qtyReceived, 0);
          return { line, qty: round4(qtyExpected - qtyReceived) };
        })
        .filter(({ line, qty }) => line?.id && qty > 0);
      if (!lines.length) {
        throw new Error(t('wms.validation.selectLineForReceive', 'Select at least one line for receive'));
      }
      for (const { line, qty } of lines) {
        await receiveReceiptLine({
          itemId: line.id,
          receiptId: id,
          payload: { qty, toLocationId, lotId: line?.lotId || null },
        }).unwrap();
      }
      await Promise.all([activeQuery.refetch?.(), activeHistoryQuery.refetch?.()]);
    } catch (err) {
      const message = getWmsActionErrorText(err, t);
      setActionError(message);
      if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(message);
    }
  }, [activeHistoryQuery, activeQuery, base, id, kind, receiveReceiptLine, t]);

  const onExecuteAll = useCallback(async () => {
    if (!id || kind !== 'transfer' || !base) return;
    setActionError('');
    try {
      const fromLocationId = asText(base.fromLocationId || base.sourceLocationId) || null;
      const toLocationId = asText(base.toLocationId || base.targetLocationId) || null;
      const lines = (Array.isArray(base.items) ? base.items : [])
        .map((line) => {
          const plannedQty = asNumber(line?.qty, 0);
          const movedQty = asNumber(line?.movedQty, 0);
          return { line, qty: round4(plannedQty - movedQty) };
        })
        .filter(({ line, qty }) => line?.id && qty > 0);
      if (!lines.length) {
        throw new Error(t('wms.validation.itemRequired', 'At least one item is required'));
      }
      for (const { line, qty } of lines) {
        await executeTransferLine({
          itemId: line.id,
          payload: { fromLocationId, toLocationId, qty },
        }).unwrap();
      }
      await Promise.all([activeQuery.refetch?.(), activeHistoryQuery.refetch?.()]);
    } catch (err) {
      const message = getWmsActionErrorText(err, t);
      setActionError(message);
      if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(message);
    }
  }, [activeHistoryQuery, activeQuery, base, executeTransferLine, id, kind, t]);

  const onPost = useCallback(async () => {
    if (!id || kind !== 'adjustment') return;
    setActionError('');
    try {
      await postAdjustment({ id }).unwrap();
      await Promise.all([activeQuery.refetch?.(), activeHistoryQuery.refetch?.()]);
    } catch (err) {
      const message = getWmsActionErrorText(err, t);
      setActionError(message);
      if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(message);
    }
  }, [activeHistoryQuery, activeQuery, id, kind, postAdjustment, t]);

  const openShipModal = useCallback((itemsToShip, mode = 'line') => {
    const rows = (Array.isArray(itemsToShip) ? itemsToShip : [itemsToShip])
      .filter((item) => item?.id && pendingShipmentQty(item, shippedByItem) > 0);
    if (!rows.length) return;
    setShipError('');
    setShipLocationId('');
    setShipModal({ open: true, mode, items: rows });
  }, [shippedByItem]);

  const closeShipModal = useCallback(() => {
    if (isShippingShipment) return;
    setShipModal({ open: false, mode: 'line', items: [] });
    setShipLocationId('');
    setShipError('');
  }, [isShippingShipment]);

  const onShipSubmit = useCallback(async () => {
    if (kind !== 'shipment' || !id || !base) return;
    const fromLocationId = asText(shipLocationId) || null;
    const rows = shipModal.items.filter((item) => item?.id && pendingShipmentQty(item, shippedByItem) > 0);
    if (!rows.length) {
      setShipError(t('wms.shipments.noPendingItems', 'No pending shipment lines.'));
      return;
    }
    setShipError('');
    setActionError('');
    try {
      for (const line of rows) {
        const qty = pendingShipmentQty(line, shippedByItem);
        if (qty <= 0) continue;
        // eslint-disable-next-line no-await-in-loop
        await shipShipmentItem({
          itemId: line.id,
          shipmentId: id,
          payload: { qty, fromLocationId },
        }).unwrap();
      }
      setShipModal({ open: false, mode: 'line', items: [] });
      setShipLocationId('');
      await Promise.all([activeQuery.refetch?.(), activeHistoryQuery.refetch?.()]);
    } catch (err) {
      const message = getWmsActionErrorText(err, t);
      setShipError(message);
      setActionError(message);
    }
  }, [activeHistoryQuery, activeQuery, base, id, kind, shipLocationId, shipModal.items, shipShipmentItem, shippedByItem, t]);

  const onCreateCorrection = useCallback(async (payload) => {
    if (!id || (kind !== 'receipt' && kind !== 'shipment')) return;
    setActionError('');
    setCorrectionError('');
    try {
      const mutation = kind === 'receipt' ? createReceiptCorrection : createShipmentCorrection;
      const correction = await mutation({ id, payload }).unwrap();
      setCorrectionOpen(false);
      await Promise.all([activeQuery.refetch?.(), activeHistoryQuery.refetch?.()]);
      const route = correctionRoute(kind, correction?.id);
      if (route) navigate(route);
    } catch (err) {
      const message = getWmsActionErrorText(err, t);
      setCorrectionError(message);
      setActionError(message);
    }
  }, [activeHistoryQuery, activeQuery, createReceiptCorrection, createShipmentCorrection, id, kind, navigate, t]);

  if (activeQuery.isLoading || (activeQuery.isFetching && !activeQuery.data)) {
    return <DocumentEnginePage.State title={t('common.loading', 'Loading...')} text={t('documents.editor.loadingHint', 'Preparing…')} />;
  }
  if (activeQuery.isError) {
    const message = activeQuery?.error?.data?.message || activeQuery?.error?.data?.error || activeQuery?.error?.message || t('common.error', 'Error');
    return <DocumentEnginePage.State title={t('common.error', 'Error')} text={message} />;
  }
  if (!base) {
    return <DocumentEnginePage.State title={t('common.notFound', 'Not found')} text={t('documents.editor.notFoundHint', '')} />;
  }

  const adapter = WMS_DOCUMENT_ADAPTERS[kind] || WMS_DOCUMENT_ADAPTERS.receipt;
  const model = adapter(base, { t, locale, lookups });
  const items = Array.isArray(base?.items) ? base.items : [];
  const routeBase = ROUTE_BASE[kind] || ROUTE_BASE.receipt;
  const wmsViewModeDisabledModes = canEditReceiptDraft ? [] : ['edit'];

  const actions = [];
  if (receiptDraftEditing) {
    actions.push({
      key: 'saveReceiptDraft',
      label: isSavingReceiptDraft ? t('common.saving', 'Saving...') : t('common.save', 'Save'),
      variant: 'primary',
      loading: isSavingReceiptDraft,
      disabled: isSavingReceiptDraft,
      onClick: onSaveReceiptDraft,
    });
    actions.push({
      key: 'cancelReceiptDraftEdit',
      label: t('common.cancel', 'Cancel'),
      disabled: isSavingReceiptDraft,
      onClick: cancelReceiptDraftEdit,
    });
  }
  if (policy.canReceive && !receiptDraftEditing) {
    actions.push({
      key: 'receiveAll',
      label: isReceivingReceipt ? t('common.saving', 'Saving...') : t('wms.create.receiveAll', 'Receive all'),
      variant: 'primary',
      loading: isReceivingReceipt,
      disabled: isReceivingReceipt,
      onClick: onReceiveAll,
    });
  }
  if (policy.canExecute) {
    actions.push({
      key: 'execute',
      label: isExecutingTransfer ? t('common.saving', 'Saving...') : t('wms.create.execute', 'Execute'),
      variant: 'primary',
      loading: isExecutingTransfer,
      disabled: isExecutingTransfer,
      onClick: onExecuteAll,
    });
  } else if (policy.lockedReason === 'executionRequiresLocations') {
    actions.push({
      key: 'executeDisabled',
      label: t('wms.policy.executionRequiresLocations', 'Execution can use warehouse-level stock when no location is selected.'),
      disabled: true,
    });
  }
  if (policy.canPost) {
    actions.push({
      key: 'post',
      label: isPostingAdjustment ? t('common.saving', 'Saving...') : t('wms.adjustments.actions.post', 'Post'),
      variant: 'primary',
      loading: isPostingAdjustment,
      onClick: onPost,
    });
  }
  if (canShowShipmentActions && shippableItems.length) {
    actions.push({
      key: 'shipAll',
      label: isShippingShipment ? t('common.saving', 'Saving...') : t('wms.shipments.actions.shipAll', 'Ship all'),
      variant: 'primary',
      loading: isShippingShipment,
      disabled: isShippingShipment,
      onClick: () => openShipModal(shippableItems, 'all'),
    });
  }
  if (policy.canCreateCorrection) {
    actions.push({
      key: 'correction',
      label: t('wms.corrections.create', 'Create correction'),
      disabled: isCreatingCorrection,
      onClick: () => { setCorrectionError(''); setCorrectionOpen(true); },
    });
  }

  const relations = Array.isArray(model.relations) ? model.relations : [];
  const sections = [];
  if (relations.length) {
    sections.push({
      key: 'relations',
      title: t('wms.relations.title', 'Relations'),
      content: (
        <div className={s.kvList}>
          {relations.map((rel) => (
            <div key={rel.key} className={s.kvRow}>
              <span className={s.kvLabel}>{rel.label}</span>
              <span className={`${s.kvValue} ${s.kvValueLeft}`}>
                {rel.to ? <Link className={s.entityLink} to={rel.to}>{rel.value}</Link> : rel.value}
              </span>
            </div>
          ))}
        </div>
      ),
    });
  }
  sections.push({
    key: 'history',
    title: t('wms.tabs.history', 'History'),
    content: <HistorySection historyItems={historyItems} locale={locale} t={t} lookups={lookups} />,
  });

  return (
    <>
      <DocumentEnginePage
        model={model}
        mode={receiptDraftEditing ? 'edit' : 'preview'}
        back={{ label: t('wms.backToList', 'Back to list'), onClick: () => navigate(routeBase) }}
        breadcrumb={`${model.typeLabel} / ${model.number}`}
        paramsTitle={t('documents.editor.header', 'Header')}
        showViewModeToggle
        viewMode={wmsViewMode}
        onViewModeChange={onWmsViewModeChange}
        viewModeDisabledModes={wmsViewModeDisabledModes}
        viewModeHiddenModes={['split']}
        showPrintButton
        onPrint={() => navigate(`${routeBase}/${id}/print`)}
        actions={actions}
        actionError={actionError}
        summaryTitle={t('wms.tabs.summary', 'Summary')}
        itemsSlot={(
          receiptDraftEditing ? (
            <ReceiptDraftEditor
              header={receiptDraftHeader}
              rows={receiptDraftRows}
              warehouses={warehousesData?.items || []}
              locations={locationsData?.items || []}
              variants={receiptVariantOptions}
              lookups={lookups}
              locale={locale}
              t={t}
              error={receiptDraftError}
              disabled={isSavingReceiptDraft}
              onHeaderChange={onReceiptDraftHeaderChange}
              onRowChange={onReceiptDraftRowChange}
              onProductSelect={onReceiptDraftProductSelect}
              onScanResolve={onReceiptDraftScanResolve}
              onScanSelect={onReceiptDraftScanSelect}
              onRemoveRow={onRemoveReceiptDraftRow}
              onBulkRemoveRows={onBulkRemoveReceiptDraftRows}
            />
          ) : (
            <WmsItemsTable
              items={items}
              kind={kind}
              locale={locale}
              t={t}
              lookups={lookups}
              processedByItem={shippedByItem}
              rowAction={canShowShipmentActions ? (item) => (
                pendingShipmentQty(item, shippedByItem) > 0 ? (
                  <button
                    type="button"
                    className={`${s.actionChip} ${s.actionEnabled}`}
                    onClick={() => openShipModal(item, 'line')}
                    disabled={isShippingShipment}
                  >
                    {t('wms.shipments.actions.ship', 'Ship')}
                  </button>
                ) : null
              ) : null}
            />
          )
        )}
        sections={sections}
      />
      <CorrectionModal
        open={correctionOpen}
        onClose={() => setCorrectionOpen(false)}
        onSubmit={onCreateCorrection}
        document={base}
        kind={kind}
        locale={locale}
        t={t}
        isSubmitting={isCreatingCorrection}
        error={correctionError}
        lookups={lookups}
      />
      <ShipShipmentModal
        open={shipModal.open}
        title={shipModal.mode === 'all'
          ? t('wms.shipments.actions.shipAll', 'Ship all')
          : t('wms.shipments.actions.ship', 'Ship')}
        items={shipModal.items}
        locations={shipmentLocations}
        selectedLocationId={shipLocationId}
        onLocationChange={setShipLocationId}
        onClose={closeShipModal}
        onSubmit={onShipSubmit}
        t={t}
        locale={locale}
        isSubmitting={isShippingShipment}
        error={shipError}
        shippedByItem={shippedByItem}
        lookups={lookups}
      />
    </>
  );
}
