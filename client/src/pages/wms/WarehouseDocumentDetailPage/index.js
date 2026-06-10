import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import DocumentEnginePage, { WMS_DOCUMENT_ADAPTERS } from '../../../components/documents/DocumentEngine';
import s from '../../oms/OmsReadOnlyDetail.module.css';
import Modal from '../../../components/Modal';
import { ProductPicker } from '../../../components/pim';
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
import useAclPermissions from '../../../hooks/useAclPermissions';

const ROUTE_BASE = {
  receipt: '/main/wms/receipts',
  shipment: '/main/wms/shipments',
  transfer: '/main/wms/transfers',
  adjustment: '/main/wms/adjustments',
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
  return {
    localId: item.id || `new-${Date.now()}-${index}`,
    id: item.id || null,
    productId: asText(item.productId),
    variantId: asText(item.variantId),
    pickerProductName: asText(item.product?.name || item.productName || item.nameSnapshot),
    pickerVariantLabel: asText(item.variant?.name || item.variantName || item.variantLabel),
    purchasePriceSource: '',
    purchasePriceCurrency: '',
    purchasePriceWarning: '',
    unitCostManual: Boolean(asText(item.unitCost)),
    lotNumber: asText(item.lotNumber),
    serialNumber: asText(item.serialNumber),
    qtyExpected: asText(item.qtyExpected ?? item.qty ?? ''),
    unitCost: asText(item.unitCost),
    currency: asText(item.currency),
    isNew: !item.id,
  };
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
  return rows.reduce((acc, row) => {
    const qty = asNumber(row?.qtyExpected, 0);
    const total = getRowTotal(row);
    const currency = getRowCurrency(row);
    acc.lines += 1;
    acc.qty = round4(acc.qty + qty);
    acc.byCurrency[currency] = round4(asNumber(acc.byCurrency[currency], 0) + total);
    return acc;
  }, { lines: 0, qty: 0, byCurrency: {} });
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
  onOpenProductPicker,
  onClearProduct,
}) {
  const selectedProductLabel = row.productId
    ? row.pickerProductName || formatProductLabel(row.productId, lookups.productsById)
    : t('wms.create.selectProduct', 'Select product');
  const selectedVariantLabel = row.variantId
    ? row.pickerVariantLabel || formatVariantLabel(row.variantId, lookups.variantsById)
    : '';

  return (
    <div className={s.draftProductPicker}>
      <div className={s.draftProductSummary}>
        <button
          type="button"
          className={s.draftProductButton}
          onClick={onOpenProductPicker}
          disabled={disabled}
        >
          <span className={s.draftProductName}>{selectedProductLabel}</span>
          <span className={s.draftProductMeta}>
            {selectedVariantLabel || (row.productId
              ? t('wms.receipts.draftEdit.changeProduct', 'Change product')
              : t('wms.receipts.draftEdit.chooseProduct', 'Choose product'))}
          </span>
        </button>
        {row.productId ? (
          <button
            type="button"
            className={`${s.actionChip} ${s.actionDanger}`}
            onClick={onClearProduct}
            disabled={disabled}
          >
            {t('common.clear', 'Clear')}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ReceiptDraftEditor({
  header,
  rows,
  warehouses,
  locations,
  lookups,
  locale,
  t,
  error,
  disabled,
  onHeaderChange,
  onRowChange,
  onProductSelect,
  onAddRow,
  onRemoveRow,
  onBulkRemoveRows,
}) {
  const [productPickerRowId, setProductPickerRowId] = useState('');
  const [selectedRowIds, setSelectedRowIds] = useState([]);
  const [isBulkRemoving, setIsBulkRemoving] = useState(false);
  const warehouseId = asText(header.warehouseId);
  const scopedLocations = warehouseId
    ? locations.filter((location) => asText(location?.warehouseId) === warehouseId)
    : locations;
  const totals = useMemo(() => getReceiptDraftTotals(rows), [rows]);
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedRowIds.includes(row.localId)),
    [rows, selectedRowIds]
  );
  const allRowsSelected = rows.length > 0 && selectedRowIds.length === rows.length;
  const effectiveDisabled = disabled || isBulkRemoving;
  const pickerRow = rows.find((row) => row.localId === productPickerRowId) || null;

  useEffect(() => {
    setSelectedRowIds((prev) => prev.filter((localId) => rows.some((row) => row.localId === localId)));
  }, [rows]);

  const toggleRow = useCallback((localId) => {
    setSelectedRowIds((prev) => (
      prev.includes(localId)
        ? prev.filter((entry) => entry !== localId)
        : [...prev, localId]
    ));
  }, []);

  const toggleAllRows = useCallback(() => {
    setSelectedRowIds((prev) => (
      prev.length === rows.length ? [] : rows.map((row) => row.localId)
    ));
  }, [rows]);

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
          <select
            className={s.select}
            value={header.warehouseId}
            disabled={effectiveDisabled}
            onChange={(event) => onHeaderChange('warehouseId', event.target.value)}
          >
            <option value="">{t('wms.create.selectWarehouse', 'Select warehouse')}</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {formatWarehouseLabel(warehouse, lookups.warehousesById)}
              </option>
            ))}
          </select>
        </label>
        <label className={s.fieldStack}>
          <span className={s.fieldLabel}>{t('wms.fields.inboundLocation', 'Inbound location')}</span>
          <select
            className={s.select}
            value={header.inboundLocationId}
            disabled={effectiveDisabled}
            onChange={(event) => onHeaderChange('inboundLocationId', event.target.value)}
          >
            <option value="">{t('wms.create.selectInboundLocation', 'Select inbound location')}</option>
            {scopedLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {formatLocationLabel(location, lookups.locationsById)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={s.draftToolbar}>
        <span className={s.fieldLabel}>{t('wms.tabs.items', 'Items')}</span>
        <button type="button" className={s.actionChip} onClick={onAddRow} disabled={effectiveDisabled}>
          {t('wms.receipts.draftEdit.addLine', 'Add line')}
        </button>
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

      {!rows.length ? (
        <div className={s.draftAddSection}>
          <p className={s.empty}>{t('wms.receipts.draftEdit.empty', 'No draft lines yet. Add a line to choose product, quantity and cost.')}</p>
        </div>
      ) : (
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
          <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.checkboxCell}>
                  <input
                    type="checkbox"
                    checked={allRowsSelected}
                    disabled={effectiveDisabled || !rows.length}
                    onChange={toggleAllRows}
                    aria-label={t('wms.receipts.draftEdit.selectAll', 'Select all lines')}
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
                const rowTotal = getRowTotal(row);
                const rowCurrency = getRowCurrency(row);
                const priceSourceText = getPurchasePriceSourceText(row.purchasePriceSource, t);
                const priceWarnings = getPurchasePriceWarnings(row, t);
                return (
                  <tr key={row.localId}>
                    <td className={s.checkboxCell}>
                      <input
                        type="checkbox"
                        checked={selectedRowIds.includes(row.localId)}
                        disabled={effectiveDisabled}
                        onChange={() => toggleRow(row.localId)}
                        aria-label={t('wms.receipts.draftEdit.selectLine', 'Select line')}
                      />
                    </td>
                    <td>
                      <ReceiptDraftProductPicker
                        row={row}
                        lookups={lookups}
                        t={t}
                        disabled={effectiveDisabled}
                        onOpenProductPicker={() => setProductPickerRowId(row.localId)}
                        onClearProduct={() => onRowChange(row.localId, 'productId', '')}
                      />
                    </td>
                    <td>
                      <input
                        className={s.draftControl}
                        value={row.lotNumber}
                        disabled={effectiveDisabled}
                        onChange={(event) => onRowChange(row.localId, 'lotNumber', event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className={s.draftControl}
                        value={row.serialNumber}
                        disabled={effectiveDisabled}
                        onChange={(event) => onRowChange(row.localId, 'serialNumber', event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className={`${s.draftControl} ${s.draftNumberControl}`}
                        type="number"
                        min="0.0001"
                        step="0.0001"
                        value={row.qtyExpected}
                        disabled={effectiveDisabled}
                        onChange={(event) => onRowChange(row.localId, 'qtyExpected', event.target.value)}
                      />
                    </td>
                    <td>
                      <div className={s.draftPriceCell}>
                        <input
                          className={`${s.draftControl} ${s.draftNumberControl}`}
                          type="number"
                          min="0"
                          step="0.0001"
                          value={row.unitCost}
                          disabled={effectiveDisabled}
                          onChange={(event) => onRowChange(row.localId, 'unitCost', event.target.value)}
                        />
                        {priceSourceText ? <span className={s.draftPriceBadge}>{priceSourceText}</span> : null}
                        {priceWarnings.map((warning) => (
                          <span key={warning} className={s.draftPriceWarning}>{warning}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <input
                        className={s.draftControl}
                        value={row.currency}
                        disabled={effectiveDisabled}
                        onChange={(event) => onRowChange(row.localId, 'currency', event.target.value)}
                      />
                    </td>
                    <td className={s.textRight}>
                      <strong className={s.draftRowTotal}>{rowCurrency} {formatMoney(rowTotal, locale)}</strong>
                    </td>
                    <td className={s.textRight}>
                      <button
                        type="button"
                        className={`${s.actionChip} ${s.actionDanger}`}
                        onClick={() => onRemoveRow(row.localId)}
                        disabled={effectiveDisabled}
                      >
                        {t('common.remove', 'Remove')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
      <div className={s.draftAddSection}>
        <button type="button" className={s.actionChip} onClick={onAddRow} disabled={effectiveDisabled}>
          {t('wms.receipts.draftEdit.addLine', 'Add line')}
        </button>
        <span className={s.empty}>{t('wms.receipts.draftEdit.addLineHint', 'New lines stay local until Save.')}</span>
      </div>
      <Modal
        open={Boolean(pickerRow)}
        onClose={() => setProductPickerRowId('')}
        title={t('wms.receipts.draftEdit.productPickerTitle', 'Choose product')}
        size="xl"
        footer={<Modal.Button onClick={() => setProductPickerRowId('')}>{t('common.close', 'Close')}</Modal.Button>}
      >
        <ProductPicker
          value={receiptPickerValue(pickerRow, lookups)}
          warehouseId={warehouseId || null}
          autoFocus
          onSelect={(payload, productPickerRow) => {
            if (!pickerRow || !payload?.productId) return;
            onProductSelect(pickerRow.localId, payload, productPickerRow);
            setProductPickerRowId('');
          }}
        />
      </Modal>
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
  const canSubmit = Boolean(selectedLocationId) && items.length > 0 && !isSubmitting;
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
          {t('wms.fields.fromLocation', 'From location')}
        </label>
        <select
          id="wms-ship-from-location"
          className={s.select}
          value={selectedLocationId}
          onChange={(event) => onLocationChange(event.target.value)}
          disabled={isSubmitting}
        >
          <option value="">{t('wms.create.selectFromLocation', 'Select from location')}</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {formatLocationLabel(location, lookups.locationsById)}
            </option>
          ))}
        </select>
        {!locations.length ? (
          <p className={s.empty}>{t('wms.shipments.noShipLocations', 'No locations available for this shipment warehouse.')}</p>
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
              <td>{formatLocationLabel(move?.fromLocation || move?.fromLocationId, lookups.locationsById)}</td>
              <td>{formatLocationLabel(move?.toLocation || move?.toLocationId, lookups.locationsById)}</td>
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
        <textarea
          id="wms-correction-reason"
          className={s.textarea}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={isSubmitting}
          placeholder={t('wms.corrections.reasonPlaceholder', 'Optional reason')}
          rows={3}
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
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleLine(item.id)}
                        disabled={isSubmitting}
                        aria-label={t('wms.corrections.selectLine', 'Select line')}
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

  const [exactProductsById, setExactProductsById] = useState({});
  const [exactVariantsById, setExactVariantsById] = useState({});

  const { data: warehousesData } = useListWarehousesQuery({ limit: 200, sort: 'name', dir: 'ASC' });
  const { data: locationsData } = useListLocationsQuery({ limit: 200, sort: 'code', dir: 'ASC' });
  const { data: productsData } = useListProductsQuery({ page: 1, limit: 200, sort: 'updatedAt', dir: 'DESC' });
  const { data: variantsData } = useListProductVariantsQuery({ page: 1, limit: 200 });

  const adjustmentQuery = useGetAdjustmentByIdQuery(id, { skip: kind !== 'adjustment' || !id, refetchOnMountOrArgChange: true });
  const receiptQuery = useGetReceiptByIdQuery(id, { skip: kind !== 'receipt' || !id, refetchOnMountOrArgChange: true });
  const transferQuery = useGetTransferByIdQuery(id, { skip: kind !== 'transfer' || !id, refetchOnMountOrArgChange: true });
  const shipmentQuery = useGetShipmentByIdQuery(id, { skip: kind !== 'shipment' || !id, refetchOnMountOrArgChange: true });

  const adjustmentHistoryQuery = useGetAdjustmentStockMovesQuery({ id, page: 1, limit: 200 }, { skip: kind !== 'adjustment' || !id, refetchOnMountOrArgChange: true });
  const receiptHistoryQuery = useGetReceiptStockMovesQuery({ id, page: 1, limit: 200 }, { skip: kind !== 'receipt' || !id, refetchOnMountOrArgChange: true });
  const transferHistoryQuery = useGetTransferStockMovesQuery({ id, page: 1, limit: 200 }, { skip: kind !== 'transfer' || !id, refetchOnMountOrArgChange: true });
  const shipmentHistoryQuery = useGetShipmentStockMovesQuery({ id, page: 1, limit: 200 }, { skip: kind !== 'shipment' || !id, refetchOnMountOrArgChange: true });

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

  const receiptProductOptions = useMemo(
    () => [...(productsData?.items || []), ...Object.values(exactProductsById)],
    [exactProductsById, productsData?.items]
  );
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
    setReceiptDraftRows((Array.isArray(base.items) ? base.items : []).map(makeReceiptDraftRow));
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
    setReceiptDraftRows((prev) => prev.map((row) => (
      row.localId === localId
        ? {
            ...row,
            [field]: value,
            ...(field === 'productId' ? {
              variantId: '',
              pickerProductName: '',
              pickerVariantLabel: '',
              purchasePriceSource: '',
              purchasePriceCurrency: '',
              purchasePriceWarning: '',
            } : {}),
            ...(field === 'unitCost' ? {
              unitCostManual: true,
              purchasePriceSource: 'manual',
              purchasePriceWarning: '',
            } : {}),
          }
        : row
    )));
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

    setExactProductsById((prev) => ({
      ...prev,
      [productId]: {
        id: productId,
        name: productName,
        productName,
        sku: pickerRow?.sku || null,
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

    setReceiptDraftRows((prev) => prev.map((row) => {
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
      };
    }));
  }, []);

  const onAddReceiptDraftRow = useCallback(() => {
    setReceiptDraftRows((prev) => [
      ...prev,
      makeReceiptDraftRow({ currency: 'PLN' }, prev.length),
    ]);
  }, []);

  const onRemoveReceiptDraftRow = useCallback((localId) => {
    setReceiptDraftRows((prev) => {
      const row = prev.find((entry) => entry.localId === localId);
      if (row?.id) {
        setReceiptDraftRemovedIds((ids) => (ids.includes(row.id) ? ids : [...ids, row.id]));
      }
      return prev.filter((entry) => entry.localId !== localId);
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
      setReceiptDraftRows((prev) => prev.filter((row) => !localOnlyIds.includes(row.localId)));
    }
    if (!persistedIds.length) return;

    try {
      for (const itemId of persistedIds) {
        // eslint-disable-next-line no-await-in-loop
        await removeReceiptDraftItem({ id, itemId }).unwrap();
      }
      setReceiptDraftRows((prev) => prev.filter((row) => !persistedIds.includes(row.id)));
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
      if (!receiptDraftRows.length) {
        throw new Error(t('wms.validation.itemRequired', 'At least one item is required'));
      }
      receiptDraftRows.forEach((row) => {
        if (!asText(row.productId)) {
          throw new Error(t('wms.validation.productRequired', 'Product is required'));
        }
        if (asNumber(row.qtyExpected, 0) <= 0) {
          throw new Error(t('wms.validation.qtyPositive', 'Quantity must be greater than 0'));
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

      for (const row of receiptDraftRows) {
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
    removeReceiptDraftItem,
    t,
    updateReceiptDraft,
    updateReceiptDraftItem,
  ]);

  const onReceiveAll = useCallback(async () => {
    if (!id || kind !== 'receipt' || !base) return;
    setActionError('');
    try {
      const toLocationId = asText(base.inboundLocationId || base.locationId);
      if (!toLocationId) {
        throw new Error(t('wms.validation.inboundLocationRequired', 'Inbound location is required'));
      }
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
      const fromLocationId = asText(base.fromLocationId || base.sourceLocationId);
      const toLocationId = asText(base.toLocationId || base.targetLocationId);
      if (!fromLocationId) {
        throw new Error(t('wms.validation.fromLocationRequired', 'From location is required'));
      }
      if (!toLocationId) {
        throw new Error(t('wms.validation.toLocationRequired', 'To location is required'));
      }
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
    const fromLocationId = asText(shipLocationId);
    if (!fromLocationId) {
      setShipError(t('wms.validation.fromLocationRequired', 'From location is required'));
      return;
    }
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

  if (activeQuery.isLoading || activeQuery.isFetching) {
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
      label: t('wms.policy.executionRequiresLocations', 'Execution requires source and target locations.'),
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
              products={receiptProductOptions}
              variants={receiptVariantOptions}
              lookups={lookups}
              locale={locale}
              t={t}
              error={receiptDraftError}
              disabled={isSavingReceiptDraft}
              onHeaderChange={onReceiptDraftHeaderChange}
              onRowChange={onReceiptDraftRowChange}
              onProductSelect={onReceiptDraftProductSelect}
              onAddRow={onAddReceiptDraftRow}
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
