import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import DocumentEnginePage from '../../../components/documents/DocumentEngine';
import OmsProductPicker from '../../../components/oms/OmsProductPicker';
import {
  useCreateAdjustmentMutation,
  useCreateReceiptMutation,
  useCreateTransferMutation,
  useExecuteTransferLineMutation,
  useLazyGetReceiptByIdQuery,
  useLazyGetTransferByIdQuery,
  useListLocationsQuery,
  useListWarehousesQuery,
  usePostAdjustmentMutation,
  useReceiveReceiptLineMutation,
} from '../../../store/rtk/wmsDocumentsApi';
import { useListProductVariantsQuery } from '../../../store/rtk/productsApi';
import { useListCounterpartiesQuery } from '../../../store/rtk/counterpartyApi';
import {
  formatLocationLabel,
  formatProductLabel,
  formatVariantLabel,
  formatWarehouseLabel,
} from '../../../components/documents/DocumentEngine/wmsDisplay';
import {
  buildAdjustmentPayload as buildAdjustmentAdapterPayload,
  buildReceiptPayload as buildReceiptAdapterPayload,
  buildTransferPayload as buildTransferAdapterPayload,
} from '../documentAdapters/payloadBuilders';
import s from './WmsDocumentCreatePage.module.css';

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

function getErrorText(error, fallback = 'Operation failed') {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || fallback;
}

function isCostingNotInitializedError(error) {
  return error?.data?.code === 'COSTING_NOT_INITIALIZED';
}

function getWmsActionErrorText(error, t, fallback) {
  if (isCostingNotInitializedError(error)) {
    return t('wms.costing.errors.notInitialized', 'FIFO costing is not initialized for this company. Go to Company Settings → Warehouse/WMS → Wycena.');
  }
  return getErrorText(error, fallback);
}

function createReceiptItem() {
  return { localId: uid(), productId: '', productName: '', sku: '', variantId: '', variantSku: '', variantName: '', lotNumber: '', qtyExpected: '1', receiveNow: false };
}

function createAdjustmentItem() {
  return { localId: uid(), productId: '', productName: '', sku: '', variantId: '', variantSku: '', variantName: '', qtyDelta: '1' };
}

function createTransferItem() {
  return { localId: uid(), productId: '', productName: '', sku: '', variantId: '', variantSku: '', variantName: '', qty: '1' };
}

function applyProductToItem(item, product) {
  const defaultVariant = product?.defaultVariant || product?.variant || null;
  return {
    ...item,
    productId: asText(product?.id),
    productName: asText(product?.name),
    sku: asText(product?.sku),
    variantId: asText(product?.defaultVariantId || product?.variantId || defaultVariant?.id),
    variantSku: asText(product?.defaultVariantSku || product?.variantSku || defaultVariant?.sku),
    variantName: asText(product?.defaultVariantName || product?.variantName || defaultVariant?.name),
  };
}

function listRouteByKind(kind) {
  if (kind === 'receipt') return '/main/wms/receipts';
  if (kind === 'adjustment') return '/main/wms/adjustments';
  return '/main/wms/transfers';
}

function detailRouteByKind(kind, id) {
  if (kind === 'receipt') return `/main/wms/receipts/${id}`;
  if (kind === 'adjustment') return `/main/wms/adjustments/${id}`;
  return `/main/wms/transfers/${id}`;
}

function locationOptionalLabel(t, key = 'label') {
  const fallback = {
    label: 'Location optional',
    inboundLabel: 'Inbound location optional',
    fromLabel: 'Source location optional',
    toLabel: 'Target location optional',
  };
  return t(`wms.locationOptional.${key}`, fallback[key] || fallback.label);
}

function warehouseLevelOption(t) {
  return { value: '', label: t('wms.locationOptional.warehouseLevelStock', 'Warehouse-level stock') };
}

// WMS-specific create items editor (rendered inside DocumentEngine itemsSlot).
// Preserves the existing per-kind columns, product picker, qty/lot/receive fields.
function WmsCreateItemsTable({ items, kind, errors, t, onAddItem, onRemoveItem, onItemField, onOpenPicker, variants }) {
  const isReceipt = kind === 'receipt';
  const isAdjustment = kind === 'adjustment';
  const isTransfer = kind === 'transfer';
  const variantOptionsFor = (item) => {
    const rows = variants.filter((variant) => !item.productId || variant.productId === item.productId);
    const options = rows.map((variant) => ({
      value: variant.id,
      label: formatVariantLabel(variant),
    }));
    if (item.variantId && !options.some((option) => option.value === item.variantId)) {
      options.push({
        value: item.variantId,
        label: formatVariantLabel({ id: item.variantId, sku: item.variantSku, name: item.variantName }),
      });
    }
    return [{ value: '', label: t('wms.create.noVariant', 'No variant') }, ...options];
  };
  return (
    <>
      <div className={s.itemsHeader}>
        <h2 className={s.sectionTitle}>{t('documents.lines.title', 'Items')}</h2>
        <button type="button" className={s.addRowButton} onClick={onAddItem}>
          {t('wms.create.addLine', 'Add line')}
        </button>
      </div>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>{t('wms.columns.product', 'Product')} *</th>
              <th>{t('wms.create.variantOptional', 'Variant (optional)')}</th>
              {isReceipt ? <th>{t('wms.create.lot', 'Lot (optional)')}</th> : null}
              {isReceipt ? <th>{t('wms.create.qtyExpected', 'Qty expected')}</th> : null}
              {isReceipt ? <th>{t('wms.create.receiveLine', 'Receive line')}</th> : null}
              {isAdjustment ? <th>{t('wms.create.qtyDelta', 'Qty delta')}</th> : null}
              {isTransfer ? <th>{t('wms.columns.qty', 'Qty')}</th> : null}
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.localId}>
                <td>
                  <div className={s.productCell}>
                    <button type="button" className={s.pickButton} onClick={() => onOpenPicker(item.localId)}>
                      {item.productId ? t('wms.create.changeProduct', 'Change product') : t('wms.create.selectProduct', 'Select product')}
                    </button>
                    <div className={s.productText}>
                      {item.productId ? formatProductLabel(item) : t('wms.create.noProduct', 'No product selected')}
                    </div>
                  </div>
                  {errors[`item:${item.localId}:productId`] ? <div className={s.fieldError}>{errors[`item:${item.localId}:productId`]}</div> : null}
                </td>
                <td>
                  <select
                    className={s.input}
                    value={item.variantId}
                    onChange={(event) => onItemField(item.localId, 'variantId', event.target.value)}
                  >
                    {variantOptionsFor(item).map((option) => (
                      <option key={option.value || 'empty'} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </td>
                {isReceipt ? (
                  <td>
                    <input className={s.input} value={item.lotNumber} onChange={(event) => onItemField(item.localId, 'lotNumber', event.target.value)} placeholder={t('wms.create.lot', 'Lot')} />
                  </td>
                ) : null}
                {isReceipt ? (
                  <td>
                    <input className={s.input} type="number" min="0" step="0.0001" value={item.qtyExpected} onChange={(event) => onItemField(item.localId, 'qtyExpected', event.target.value)} />
                    {errors[`item:${item.localId}:qtyExpected`] ? <div className={s.fieldError}>{errors[`item:${item.localId}:qtyExpected`]}</div> : null}
                  </td>
                ) : null}
                {isReceipt ? (
                  <td>
                    <label className={s.checkboxRow}>
                      <input type="checkbox" checked={Boolean(item.receiveNow)} onChange={(event) => onItemField(item.localId, 'receiveNow', event.target.checked)} />
                      <span>{t('wms.create.receive', 'Receive')}</span>
                    </label>
                  </td>
                ) : null}
                {isAdjustment ? (
                  <td>
                    <input className={s.input} type="number" min="0" step="0.0001" value={item.qtyDelta} onChange={(event) => onItemField(item.localId, 'qtyDelta', event.target.value)} />
                    {errors[`item:${item.localId}:qtyDelta`] ? <div className={s.fieldError}>{errors[`item:${item.localId}:qtyDelta`]}</div> : null}
                  </td>
                ) : null}
                {isTransfer ? (
                  <td>
                    <input className={s.input} type="number" min="0" step="0.0001" value={item.qty} onChange={(event) => onItemField(item.localId, 'qty', event.target.value)} />
                    {errors[`item:${item.localId}:qty`] ? <div className={s.fieldError}>{errors[`item:${item.localId}:qty`]}</div> : null}
                  </td>
                ) : null}
                <td>
                  <button type="button" className={s.removeButton} onClick={() => onRemoveItem(item.localId)}>
                    {t('documents.lines.remove', 'Remove')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {errors.items ? <div className={s.fieldError} style={{ marginTop: 8 }}>{errors.items}</div> : null}
    </>
  );
}

export default function WmsDocumentCreatePage({ kind = 'receipt', documentConfig = null }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [pickerTargetId, setPickerTargetId] = useState('');
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [actionError, setActionError] = useState('');

  const isReceipt = kind === 'receipt';
  const isAdjustment = kind === 'adjustment';
  const isTransfer = kind === 'transfer';
  const receiptConfig = isReceipt ? documentConfig : null;
  const receiptQtyField = receiptConfig?.qtyField || 'qtyExpected';

  const [header, setHeader] = useState({
    warehouseId: '', inboundLocationId: '', counterpartyId: '', issueDate: '', documentType: 'PW',
    locationId: '', reason: '', fromWarehouseId: '', toWarehouseId: '', fromLocationId: '', toLocationId: '',
  });

  const [items, setItems] = useState(() => {
    if (isReceipt) return [createReceiptItem()];
    if (isAdjustment) return [createAdjustmentItem()];
    return [createTransferItem()];
  });

  const { data: warehousesData } = useListWarehousesQuery({ limit: 200, sort: 'name', dir: 'ASC' });
  const { data: locationsData } = useListLocationsQuery(
    { limit: 200, sort: 'code', dir: 'ASC', warehouseId: isTransfer ? undefined : header.warehouseId || undefined },
    { refetchOnMountOrArgChange: false }
  );
  const { data: counterpartiesData } = useListCounterpartiesQuery(
    { limit: 300, sort: 'shortName', dir: 'ASC', excludeLeadClient: true },
    { skip: !isReceipt }
  );
  const { data: fromLocationsData } = useListLocationsQuery(
    { limit: 200, sort: 'code', dir: 'ASC', warehouseId: isTransfer ? header.fromWarehouseId || undefined : undefined },
    { skip: !isTransfer, refetchOnMountOrArgChange: false }
  );
  const { data: toLocationsData } = useListLocationsQuery(
    { limit: 200, sort: 'code', dir: 'ASC', warehouseId: isTransfer ? header.toWarehouseId || undefined : undefined },
    { skip: !isTransfer, refetchOnMountOrArgChange: false }
  );
  const { data: variantsData } = useListProductVariantsQuery({ page: 1, limit: 200 });

  const [createReceipt, { isLoading: isCreatingReceipt }] = useCreateReceiptMutation();
  const [receiveReceiptLine, { isLoading: isReceivingLine }] = useReceiveReceiptLineMutation();
  const [fetchReceiptById] = useLazyGetReceiptByIdQuery();
  const [createAdjustment, { isLoading: isCreatingAdjustment }] = useCreateAdjustmentMutation();
  const [postAdjustment, { isLoading: isPostingAdjustment }] = usePostAdjustmentMutation();
  const [createTransfer, { isLoading: isCreatingTransfer }] = useCreateTransferMutation();
  const [executeTransferLine, { isLoading: isExecutingTransferLine }] = useExecuteTransferLineMutation();
  const [fetchTransferById] = useLazyGetTransferByIdQuery();

  const isBusy = isCreatingReceipt || isReceivingLine || isCreatingAdjustment || isPostingAdjustment || isCreatingTransfer || isExecutingTransferLine;

  const warehouseOptions = useMemo(() => {
    const rows = Array.isArray(warehousesData?.items) ? warehousesData.items : [];
    return [
      { value: '', label: t('wms.create.selectWarehouse', 'Select warehouse') },
      ...rows.map((row) => ({ value: row.id, label: formatWarehouseLabel(row) })),
    ];
  }, [warehousesData?.items, t]);

  const locationOptions = useMemo(() => {
    const rows = Array.isArray(locationsData?.items) ? locationsData.items : [];
    return [
      warehouseLevelOption(t),
      ...rows.map((row) => ({ value: row.id, label: formatLocationLabel(row) })),
    ];
  }, [locationsData?.items, t]);

  const fromLocationOptions = useMemo(() => {
    const rows = Array.isArray(fromLocationsData?.items) ? fromLocationsData.items : [];
    return [
      warehouseLevelOption(t),
      ...rows.map((row) => ({ value: row.id, label: formatLocationLabel(row) })),
    ];
  }, [fromLocationsData?.items, t]);

  const toLocationOptions = useMemo(() => {
    const rows = Array.isArray(toLocationsData?.items) ? toLocationsData.items : [];
    return [
      warehouseLevelOption(t),
      ...rows.map((row) => ({ value: row.id, label: formatLocationLabel(row) })),
    ];
  }, [toLocationsData?.items, t]);

  const variants = useMemo(() => (Array.isArray(variantsData?.items) ? variantsData.items : []), [variantsData?.items]);

  const counterpartyOptions = useMemo(() => {
    const rows = Array.isArray(counterpartiesData?.items) ? counterpartiesData.items : [];
    return [
      { value: '', label: t('wms.create.noSupplier', 'No supplier') },
      ...rows.map((row) => ({ value: row.id, label: row.shortName || row.fullName || row.name || row.id })),
    ];
  }, [counterpartiesData?.items, t]);

  const setHeaderField = (field, value) => {
    setHeader((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const setItemField = (localId, field, value) => {
    setItems((prev) => prev.map((item) => (item.localId === localId ? { ...item, [field]: value } : item)));
    setErrors((prev) => ({ ...prev, [`item:${localId}:${field}`]: undefined }));
  };

  const addItem = () => {
    setItems((prev) => {
      if (isReceipt) return [...prev, createReceiptItem()];
      if (isAdjustment) return [...prev, createAdjustmentItem()];
      return [...prev, createTransferItem()];
    });
  };

  const removeItem = (localId) => {
    setItems((prev) => {
      const next = prev.filter((item) => item.localId !== localId);
      if (next.length) return next;
      if (isReceipt) return [createReceiptItem()];
      if (isAdjustment) return [createAdjustmentItem()];
      return [createTransferItem()];
    });
  };

  const onPickProduct = (product) => {
    if (!pickerTargetId) return;
    setItems((prev) => prev.map((item) => (item.localId === pickerTargetId ? applyProductToItem(item, product) : item)));
    setPickerOpen(false);
    setPickerTargetId('');
  };

  const validate = ({ forPost = false, receiveMode = 'none', forExecute = false } = {}) => {
    const nextErrors = {};
    if (isReceipt) {
      if (!header.warehouseId) nextErrors.warehouseId = t('wms.validation.warehouseRequired', 'Warehouse is required');
      if (receiveMode === 'selected' && !items.some((item) => item.receiveNow)) {
        nextErrors.items = t('wms.validation.selectLineForReceive', 'Select at least one line for receive');
      }
    }
    if (isAdjustment) {
      if (!header.warehouseId) nextErrors.warehouseId = t('wms.validation.warehouseRequired', 'Warehouse is required');
      if (!header.documentType) nextErrors.documentType = t('wms.validation.typeRequired', 'Type is required');
    }
    if (isTransfer) {
      if (!header.fromWarehouseId) nextErrors.fromWarehouseId = t('wms.validation.fromWarehouseRequired', 'From warehouse is required');
      if (!header.toWarehouseId) nextErrors.toWarehouseId = t('wms.validation.toWarehouseRequired', 'To warehouse is required');
    }
    items.forEach((item) => {
      if (!asText(item.productId)) nextErrors[`item:${item.localId}:productId`] = t('wms.validation.productRequired', 'Product is required');
      if (isReceipt && asNumber(item.qtyExpected, 0) <= 0) nextErrors[`item:${item.localId}:qtyExpected`] = t('wms.validation.qtyExpectedPositive', 'Qty expected must be > 0');
      if (isAdjustment && Math.abs(asNumber(item.qtyDelta, 0)) <= 0) nextErrors[`item:${item.localId}:qtyDelta`] = t('wms.validation.qtyDeltaPositive', 'Qty delta must be > 0');
      if (isTransfer && asNumber(item.qty, 0) <= 0) nextErrors[`item:${item.localId}:qty`] = t('wms.validation.qtyPositive', 'Qty must be > 0');
    });
    if (forPost && isAdjustment && !items.length) {
      nextErrors.items = t('wms.validation.itemRequired', 'At least one item is required');
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const buildReceiptCreatePayload = () => buildReceiptAdapterPayload({ header, rows: items });

  const buildAdjustmentCreatePayload = () => buildAdjustmentAdapterPayload({ header, rows: items });

  const buildTransferCreatePayload = () => buildTransferAdapterPayload({ header, rows: items });

  const handleReceiptSave = async ({ receiveMode = 'none' } = {}) => {
    if (!validate({ receiveMode })) return;
    setSaveError('');
    setActionError('');
    try {
      const created = await createReceipt(buildReceiptCreatePayload()).unwrap();
      const receiptId = created?.id;
      if (!receiptId) throw new Error('Receipt not created');
      if (receiveMode === 'all' || receiveMode === 'selected') {
        const detail = await fetchReceiptById(receiptId, true).unwrap();
        const detailItems = Array.isArray(detail?.items) ? detail.items : [];
        const selectedFlags = items.map((row) => Boolean(row.receiveNow));
        for (let index = 0; index < detailItems.length; index += 1) {
          const line = detailItems[index];
          if (receiveMode === 'selected') {
            if (!selectedFlags[index]) continue;
          }
          const qtyExpected = asNumber(line?.qtyExpected, 0);
          const qtyReceived = asNumber(line?.qtyReceived, 0);
          const qty = round4(qtyExpected - qtyReceived);
          if (qty <= 0) continue;
          // eslint-disable-next-line no-await-in-loop
          await receiveReceiptLine({ itemId: line.id, payload: { qty, toLocationId: asText(header.inboundLocationId) || null, lotId: null } }).unwrap();
        }
      }
      navigate(detailRouteByKind('receipt', receiptId));
    } catch (error) {
      const message = getWmsActionErrorText(error, t, 'Failed to create receipt');
      if (receiveMode !== 'none') setActionError(message);
      else setSaveError(message);
    }
  };

  const handleAdjustmentSave = async ({ post = false } = {}) => {
    if (!validate({ forPost: post })) return;
    setSaveError('');
    setActionError('');
    try {
      const created = await createAdjustment(buildAdjustmentCreatePayload()).unwrap();
      const adjustmentId = created?.id;
      if (!adjustmentId) throw new Error('Adjustment not created');
      if (post) {
        await postAdjustment({ id: adjustmentId }).unwrap();
      }
      navigate(detailRouteByKind('adjustment', adjustmentId));
    } catch (error) {
      const message = getWmsActionErrorText(error, t, 'Failed to create adjustment');
      if (post) setActionError(message);
      else setSaveError(message);
    }
  };

  const handleTransferSave = async ({ execute = false } = {}) => {
    if (!validate({ forExecute: execute })) return;
    setSaveError('');
    setActionError('');
    try {
      const created = await createTransfer(buildTransferCreatePayload()).unwrap();
      const transferId = created?.id;
      if (!transferId) throw new Error('Transfer not created');
      if (execute) {
        const detail = await fetchTransferById(transferId, true).unwrap();
        const detailItems = Array.isArray(detail?.items) ? detail.items : [];
        for (const line of detailItems) {
          const plannedQty = asNumber(line?.qty, 0);
          const movedQty = asNumber(line?.movedQty, 0);
          const qty = round4(plannedQty - movedQty);
          if (qty <= 0) continue;
          // eslint-disable-next-line no-await-in-loop
          await executeTransferLine({ itemId: line.id, payload: { fromLocationId: asText(header.fromLocationId) || null, toLocationId: asText(header.toLocationId) || null, qty } }).unwrap();
        }
      }
      navigate(detailRouteByKind('transfer', transferId));
    } catch (error) {
      const message = getWmsActionErrorText(error, t, 'Failed to create transfer');
      if (execute) setActionError(message);
      else setSaveError(message);
    }
  };

  // ----- DocumentEngine model -----
  const typeLabel = isReceipt ? (receiptConfig?.badge || 'PZ') : isTransfer ? 'MM' : asText(header.documentType || 'PW').toUpperCase();
  const title = `${t('common.new', 'New')} ${typeLabel}`;
  const subtitle = isReceipt
    ? t('wms.create.subtitleReceipt', 'Create receipt and optionally receive lines')
    : isAdjustment
      ? t('wms.create.subtitleAdjustment', 'Create RW/PW adjustment and optionally post')
      : t('wms.create.subtitleTransfer', 'Create transfer and optionally execute lines');

  let primaryFields = [];
  let secondaryFields = [];
  if (isReceipt) {
    primaryFields = [
      { label: t('wms.print.warehouse', 'Warehouse'), type: 'select', required: true, value: header.warehouseId, onChange: (v) => setHeaderField('warehouseId', v), options: warehouseOptions, error: errors.warehouseId },
      { label: locationOptionalLabel(t, 'inboundLabel'), type: 'select', value: header.inboundLocationId, onChange: (v) => setHeaderField('inboundLocationId', v), options: locationOptions, error: errors.inboundLocationId },
    ];
    secondaryFields = [
      { label: t('wms.fields.supplier', 'Supplier'), type: 'select', value: header.counterpartyId, onChange: (v) => setHeaderField('counterpartyId', v), options: counterpartyOptions },
      { label: t('wms.fields.date', 'Date'), type: 'date', value: header.issueDate, onChange: (v) => setHeaderField('issueDate', v) },
    ];
  } else if (isAdjustment) {
    primaryFields = [
      { label: t('wms.fields.documentType', 'Document type'), type: 'select', required: true, value: header.documentType, onChange: (v) => setHeaderField('documentType', v), options: [{ value: 'PW', label: 'PW' }, { value: 'RW', label: 'RW' }], error: errors.documentType },
      { label: t('wms.print.warehouse', 'Warehouse'), type: 'select', required: true, value: header.warehouseId, onChange: (v) => setHeaderField('warehouseId', v), options: warehouseOptions, error: errors.warehouseId },
      { label: locationOptionalLabel(t), type: 'select', value: header.locationId, onChange: (v) => setHeaderField('locationId', v), options: locationOptions, error: errors.locationId },
    ];
    secondaryFields = [
      { label: t('wms.fields.date', 'Date'), type: 'date', value: header.issueDate, onChange: (v) => setHeaderField('issueDate', v) },
      { label: t('wms.fields.reason', 'Reason'), type: 'text', value: header.reason, onChange: (v) => setHeaderField('reason', v) },
    ];
  } else {
    primaryFields = [
      { label: t('wms.fields.fromWarehouse', 'From warehouse'), type: 'select', required: true, value: header.fromWarehouseId, onChange: (v) => setHeaderField('fromWarehouseId', v), options: warehouseOptions, error: errors.fromWarehouseId },
      { label: t('wms.fields.toWarehouse', 'To warehouse'), type: 'select', required: true, value: header.toWarehouseId, onChange: (v) => setHeaderField('toWarehouseId', v), options: warehouseOptions, error: errors.toWarehouseId },
    ];
    secondaryFields = [
      { label: locationOptionalLabel(t, 'fromLabel'), type: 'select', value: header.fromLocationId, onChange: (v) => setHeaderField('fromLocationId', v), options: fromLocationOptions, error: errors.fromLocationId },
      { label: locationOptionalLabel(t, 'toLabel'), type: 'select', value: header.toLocationId, onChange: (v) => setHeaderField('toLocationId', v), options: toLocationOptions, error: errors.toLocationId },
      { label: t('wms.fields.date', 'Date'), type: 'date', value: header.issueDate, onChange: (v) => setHeaderField('issueDate', v) },
    ];
  }

  const summaryRows = (() => {
    const rows = [{ label: t('wms.summary.items', 'Items'), value: String(items.length) }];
    if (isReceipt) {
      const totalExpected = items.reduce((acc, it) => acc + asNumber(it[receiptQtyField], 0), 0);
      rows.push({ label: t('wms.summary.qtyTotal', 'Total qty'), value: round4(totalExpected), strong: true });
    } else if (isAdjustment) {
      const totalDelta = items.reduce((acc, it) => acc + Math.abs(asNumber(it.qtyDelta, 0)), 0);
      rows.push({ label: t('wms.summary.qtyTotal', 'Total qty'), value: round4(totalDelta), strong: true });
      rows.push({ label: t('wms.adjustments.filters.documentType', 'Type'), value: typeLabel });
    } else {
      const totalQty = items.reduce((acc, it) => acc + asNumber(it.qty, 0), 0);
      rows.push({ label: t('wms.summary.qtyTotal', 'Total qty'), value: round4(totalQty), strong: true });
    }
    return rows.map((r) => ({ ...r, value: String(r.value) }));
  })();

  const actions = [];
  if (isReceipt) {
    actions.push({ key: 'save', label: t('wms.create.create', 'Create'), disabled: isBusy, onClick: () => handleReceiptSave({ receiveMode: 'none' }) });
    actions.push({ key: 'receiveSelected', label: t('wms.create.receiveSelected', 'Receive selected'), disabled: isBusy, onClick: () => handleReceiptSave({ receiveMode: 'selected' }) });
    actions.push({ key: 'receiveAll', label: t('wms.create.receiveAll', 'Receive all'), variant: 'primary', loading: isBusy, disabled: isBusy, onClick: () => handleReceiptSave({ receiveMode: 'all' }) });
  } else if (isAdjustment) {
    actions.push({ key: 'save', label: t('wms.create.saveDraft', 'Save draft'), disabled: isBusy, onClick: () => handleAdjustmentSave({ post: false }) });
    actions.push({ key: 'post', label: t('wms.create.post', 'Post'), variant: 'primary', loading: isBusy, disabled: isBusy, onClick: () => handleAdjustmentSave({ post: true }) });
  } else {
    actions.push({ key: 'create', label: t('wms.create.create', 'Create'), disabled: isBusy, onClick: () => handleTransferSave({ execute: false }) });
    actions.push({ key: 'execute', label: t('wms.create.execute', 'Execute'), variant: 'primary', loading: isBusy, disabled: isBusy, onClick: () => handleTransferSave({ execute: true }) });
  }

  return (
    <>
      <DocumentEnginePage
        mode="edit"
        typeLabel={typeLabel}
        title={title}
        subtitle={subtitle}
        statusLabel={t('statuses.draft', 'Draft')}
        summaryStatusLabel={t('statuses.draft', 'Draft')}
        back={{ label: t('common.cancel', 'Cancel'), onClick: () => navigate(listRouteByKind(kind)) }}
        breadcrumb={`${typeLabel} / ${t('common.new', 'New')}`}
        showViewModeToggle
        viewMode="edit"
        viewModeDisabledModes={['split', 'preview']}
        onViewModeChange={() => {}}
        paramsTitle={t('documents.editor.header', 'Header')}
        primaryFields={primaryFields}
        secondaryFields={secondaryFields}
        summaryTitle={t('wms.tabs.summary', 'Summary')}
        summaryRows={summaryRows}
        actions={actions}
        actionError={saveError || actionError}
        itemsSlot={(
          <WmsCreateItemsTable
            items={items}
            kind={kind}
            errors={errors}
            t={t}
            variants={variants}
            onAddItem={addItem}
            onRemoveItem={removeItem}
            onItemField={setItemField}
            onOpenPicker={(localId) => { setPickerTargetId(localId); setPickerOpen(true); }}
          />
        )}
      />
      <OmsProductPicker
        open={isPickerOpen}
        onClose={() => { setPickerOpen(false); setPickerTargetId(''); }}
        onSelect={onPickProduct}
        title={t('wms.create.selectProduct', 'Select product')}
      />
    </>
  );
}
