import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import ThemedSelect from '../../../components/inputs/RadixSelect';
import DateTimePicker from '../../../components/inputs/DateTimePicker';
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
import { useListCounterpartiesQuery } from '../../../store/rtk/counterpartyApi';
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

function getWmsActionErrorText(error, fallback) {
  if (isCostingNotInitializedError(error)) {
    return 'FIFO costing is not initialized for this company. Go to Company Settings → Warehouse/WMS → Wycena.';
  }
  return getErrorText(error, fallback);
}

function createReceiptItem() {
  return {
    localId: uid(),
    productId: '',
    productName: '',
    sku: '',
    variantId: '',
    lotNumber: '',
    qtyExpected: '1',
    receiveNow: false,
  };
}

function createAdjustmentItem() {
  return {
    localId: uid(),
    productId: '',
    productName: '',
    sku: '',
    variantId: '',
    qtyDelta: '1',
  };
}

function createTransferItem() {
  return {
    localId: uid(),
    productId: '',
    productName: '',
    sku: '',
    variantId: '',
    qty: '1',
  };
}

function applyProductToItem(item, product) {
  return {
    ...item,
    productId: asText(product?.id),
    productName: asText(product?.name),
    sku: asText(product?.sku),
    variantId: asText(product?.defaultVariantId || product?.variantId || product?.defaultVariant?.id),
  };
}

function titleByKind(kind) {
  if (kind === 'receipt') return 'New PZ receipt';
  if (kind === 'adjustment') return 'New RW/PW adjustment';
  return 'New MM transfer';
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

export default function WmsDocumentCreatePage({ kind = 'receipt' }) {
  const navigate = useNavigate();
  const { i18n, t } = useTranslation();
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [pickerTargetId, setPickerTargetId] = useState('');
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionErrorCode, setActionErrorCode] = useState('');

  const isReceipt = kind === 'receipt';
  const isAdjustment = kind === 'adjustment';
  const isTransfer = kind === 'transfer';

  const [header, setHeader] = useState({
    warehouseId: '',
    inboundLocationId: '',
    counterpartyId: '',
    issueDate: '',
    documentType: 'PW',
    locationId: '',
    reason: '',
    fromWarehouseId: '',
    toWarehouseId: '',
    fromLocationId: '',
    toLocationId: '',
  });

  const [items, setItems] = useState(() => {
    if (isReceipt) return [createReceiptItem()];
    if (isAdjustment) return [createAdjustmentItem()];
    return [createTransferItem()];
  });

  const { data: warehousesData } = useListWarehousesQuery({
    limit: 200,
    sort: 'name',
    dir: 'ASC',
  });
  const { data: locationsData } = useListLocationsQuery(
    {
      limit: 200,
      sort: 'code',
      dir: 'ASC',
      warehouseId: isTransfer ? undefined : header.warehouseId || undefined,
    },
    { refetchOnMountOrArgChange: false }
  );
  const { data: counterpartiesData } = useListCounterpartiesQuery(
    { limit: 300, sort: 'shortName', dir: 'ASC', excludeLeadClient: true },
    { skip: !isReceipt }
  );
  const { data: fromLocationsData } = useListLocationsQuery(
    {
      limit: 200,
      sort: 'code',
      dir: 'ASC',
      warehouseId: isTransfer ? header.fromWarehouseId || undefined : undefined,
    },
    { skip: !isTransfer, refetchOnMountOrArgChange: false }
  );
  const { data: toLocationsData } = useListLocationsQuery(
    {
      limit: 200,
      sort: 'code',
      dir: 'ASC',
      warehouseId: isTransfer ? header.toWarehouseId || undefined : undefined,
    },
    { skip: !isTransfer, refetchOnMountOrArgChange: false }
  );

  const [createReceipt, { isLoading: isCreatingReceipt }] = useCreateReceiptMutation();
  const [receiveReceiptLine, { isLoading: isReceivingLine }] = useReceiveReceiptLineMutation();
  const [fetchReceiptById] = useLazyGetReceiptByIdQuery();

  const [createAdjustment, { isLoading: isCreatingAdjustment }] = useCreateAdjustmentMutation();
  const [postAdjustment, { isLoading: isPostingAdjustment }] = usePostAdjustmentMutation();

  const [createTransfer, { isLoading: isCreatingTransfer }] = useCreateTransferMutation();
  const [executeTransferLine, { isLoading: isExecutingTransferLine }] = useExecuteTransferLineMutation();
  const [fetchTransferById] = useLazyGetTransferByIdQuery();

  const isBusy = isCreatingReceipt
    || isReceivingLine
    || isCreatingAdjustment
    || isPostingAdjustment
    || isCreatingTransfer
    || isExecutingTransferLine;

  const warehouseOptions = useMemo(() => {
    const rows = Array.isArray(warehousesData?.items) ? warehousesData.items : [];
    return [
      { value: '', label: 'Select warehouse' },
      ...rows.map((row) => ({
        value: row.id,
        label: [asText(row.code), asText(row.name)].filter(Boolean).join(' · ') || row.id,
      })),
    ];
  }, [warehousesData?.items]);

  const locationOptions = useMemo(() => {
    const rows = Array.isArray(locationsData?.items) ? locationsData.items : [];
    return [
      { value: '', label: 'Select location' },
      ...rows.map((row) => ({
        value: row.id,
        label: [asText(row.code), asText(row.type)].filter(Boolean).join(' · ') || row.id,
      })),
    ];
  }, [locationsData?.items]);

  const fromLocationOptions = useMemo(() => {
    const rows = Array.isArray(fromLocationsData?.items) ? fromLocationsData.items : [];
    return [
      { value: '', label: 'Select from location' },
      ...rows.map((row) => ({
        value: row.id,
        label: [asText(row.code), asText(row.type)].filter(Boolean).join(' · ') || row.id,
      })),
    ];
  }, [fromLocationsData?.items]);

  const toLocationOptions = useMemo(() => {
    const rows = Array.isArray(toLocationsData?.items) ? toLocationsData.items : [];
    return [
      { value: '', label: 'Select to location' },
      ...rows.map((row) => ({
        value: row.id,
        label: [asText(row.code), asText(row.type)].filter(Boolean).join(' · ') || row.id,
      })),
    ];
  }, [toLocationsData?.items]);

  const counterpartyOptions = useMemo(() => {
    const rows = Array.isArray(counterpartiesData?.items) ? counterpartiesData.items : [];
    return [
      { value: '', label: 'No supplier' },
      ...rows.map((row) => ({
        value: row.id,
        label: row.shortName || row.fullName || row.name || row.id,
      })),
    ];
  }, [counterpartiesData?.items]);

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
    setItems((prev) => prev.map((item) => (
      item.localId === pickerTargetId ? applyProductToItem(item, product) : item
    )));
    setPickerOpen(false);
    setPickerTargetId('');
  };

  const validate = ({ forPost = false, receiveMode = 'none', forExecute = false } = {}) => {
    const nextErrors = {};

    if (isReceipt) {
      if (!header.warehouseId) nextErrors.warehouseId = 'Warehouse is required';
      const isReceiveAction = receiveMode === 'all' || receiveMode === 'selected';
      if (isReceiveAction && !header.inboundLocationId) nextErrors.inboundLocationId = 'Inbound location is required';
      if (receiveMode === 'selected' && !items.some((item) => item.receiveNow)) {
        nextErrors.items = 'Select at least one line for receive';
      }
    }
    if (isAdjustment) {
      if (!header.warehouseId) nextErrors.warehouseId = 'Warehouse is required';
      if (!header.locationId) nextErrors.locationId = 'Location is required';
      if (!header.documentType) nextErrors.documentType = 'Type is required';
    }
    if (isTransfer) {
      if (!header.fromWarehouseId) nextErrors.fromWarehouseId = 'From warehouse is required';
      if (!header.toWarehouseId) nextErrors.toWarehouseId = 'To warehouse is required';
      if (forExecute && !header.fromLocationId) nextErrors.fromLocationId = 'From location is required';
      if (forExecute && !header.toLocationId) nextErrors.toLocationId = 'To location is required';
    }

    items.forEach((item) => {
      if (!asText(item.productId)) nextErrors[`item:${item.localId}:productId`] = 'Product is required';
      if (isReceipt && asNumber(item.qtyExpected, 0) <= 0) nextErrors[`item:${item.localId}:qtyExpected`] = 'Qty expected must be > 0';
      if (isAdjustment && Math.abs(asNumber(item.qtyDelta, 0)) <= 0) nextErrors[`item:${item.localId}:qtyDelta`] = 'Qty delta must be > 0';
      if (isTransfer && asNumber(item.qty, 0) <= 0) nextErrors[`item:${item.localId}:qty`] = 'Qty must be > 0';
    });

    if (forPost && isAdjustment && !items.length) {
      nextErrors.items = 'At least one item is required';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const buildReceiptPayload = () => ({
    warehouseId: header.warehouseId,
    inboundLocationId: header.inboundLocationId || null,
    issueDate: header.issueDate || null,
    items: items.map((item) => ({
      productId: item.productId,
      variantId: asText(item.variantId) || null,
      lotNumber: asText(item.lotNumber) || null,
      qtyExpected: round4(asNumber(item.qtyExpected, 0)),
    })),
  });

  const buildAdjustmentPayload = () => {
    const type = asText(header.documentType || 'PW').toUpperCase();
    return {
      documentType: type,
      warehouseId: header.warehouseId,
      reason: asText(header.reason) || null,
      issueDate: header.issueDate || null,
      items: items.map((item) => {
        const absQty = Math.abs(round4(asNumber(item.qtyDelta, 0)));
        return {
          productId: item.productId,
          variantId: asText(item.variantId) || null,
          locationId: header.locationId,
          qtyDelta: type === 'RW' ? -absQty : absQty,
        };
      }),
    };
  };

  const buildTransferPayload = () => ({
    fromWarehouseId: header.fromWarehouseId,
    toWarehouseId: header.toWarehouseId,
    issueDate: header.issueDate || null,
    items: items.map((item) => ({
      productId: item.productId,
      variantId: asText(item.variantId) || null,
      qty: round4(asNumber(item.qty, 0)),
    })),
  });

  const handleReceiptSave = async ({ receiveMode = 'none' } = {}) => {
    if (!validate({ receiveMode })) return;
    setSaveError('');
    setActionError('');
    setActionErrorCode('');
    try {
      const created = await createReceipt(buildReceiptPayload()).unwrap();
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
          await receiveReceiptLine({
            itemId: line.id,
            payload: {
              qty,
              toLocationId: header.inboundLocationId,
              lotId: null,
            },
          }).unwrap();
        }
      }

      navigate(detailRouteByKind('receipt', receiptId));
    } catch (error) {
      const message = getWmsActionErrorText(error, 'Failed to create receipt');
      if (receiveMode !== 'none') setActionError(message);
      else setSaveError(message);
      setActionErrorCode(error?.data?.code || '');
    }
  };

  const handleAdjustmentSave = async ({ post = false } = {}) => {
    if (!validate({ forPost: post })) return;
    setSaveError('');
    setActionError('');
    setActionErrorCode('');
    try {
      const created = await createAdjustment(buildAdjustmentPayload()).unwrap();
      const adjustmentId = created?.id;
      if (!adjustmentId) throw new Error('Adjustment not created');

      if (post) {
        await postAdjustment({ id: adjustmentId }).unwrap();
      }

      navigate(detailRouteByKind('adjustment', adjustmentId));
    } catch (error) {
      const message = getWmsActionErrorText(error, 'Failed to create adjustment');
      if (post) setActionError(message);
      else setSaveError(message);
      setActionErrorCode(error?.data?.code || '');
    }
  };

  const handleTransferSave = async ({ execute = false } = {}) => {
    if (!validate({ forExecute: execute })) return;
    setSaveError('');
    setActionError('');
    setActionErrorCode('');
    try {
      const created = await createTransfer(buildTransferPayload()).unwrap();
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
          await executeTransferLine({
            itemId: line.id,
            payload: {
              fromLocationId: header.fromLocationId,
              toLocationId: header.toLocationId,
              qty,
            },
          }).unwrap();
        }
      }

      navigate(detailRouteByKind('transfer', transferId));
    } catch (error) {
      const message = getWmsActionErrorText(error, 'Failed to create transfer');
      if (execute) setActionError(message);
      else setSaveError(message);
      setActionErrorCode(error?.data?.code || '');
    }
  };

  return (
    <div className={s.page}>
      <section className={s.mainCard}>
        <div className={s.header}>
          <div>
            <h1 className={s.title}>{titleByKind(kind)}</h1>
            <p className={s.subtle}>
              {isReceipt
                ? 'Create receipt and optionally receive all lines'
                : isAdjustment
                  ? 'Create RW/PW adjustment and optionally post'
                  : 'Create transfer and optionally execute all lines'}
            </p>
          </div>
          <div className={s.headerActions}>
            <button
              type="button"
              className={s.button}
              onClick={() => navigate(listRouteByKind(kind))}
              disabled={isBusy}
            >
              {t('common.cancel', 'Cancel')}
            </button>
            {isReceipt ? (
              <>
                <button type="button" className={s.button} onClick={() => handleReceiptSave({ receiveMode: 'none' })} disabled={isBusy}>
                  {isBusy ? t('common.saving', 'Saving...') : 'Save draft / Create'}
                </button>
                <button type="button" className={s.button} onClick={() => handleReceiptSave({ receiveMode: 'selected' })} disabled={isBusy}>
                  {isBusy ? t('common.saving', 'Saving...') : 'Receive selected'}
                </button>
                <button type="button" className={s.primaryButton} onClick={() => handleReceiptSave({ receiveMode: 'all' })} disabled={isBusy}>
                  {isBusy ? t('common.saving', 'Saving...') : 'Receive all'}
                </button>
              </>
            ) : null}
            {isAdjustment ? (
              <>
                <button type="button" className={s.button} onClick={() => handleAdjustmentSave({ post: false })} disabled={isBusy}>
                  {isBusy ? t('common.saving', 'Saving...') : 'Save draft'}
                </button>
                <button type="button" className={s.primaryButton} onClick={() => handleAdjustmentSave({ post: true })} disabled={isBusy}>
                  {isBusy ? t('common.saving', 'Saving...') : 'Post'}
                </button>
              </>
            ) : null}
            {isTransfer ? (
              <>
                <button type="button" className={s.button} onClick={() => handleTransferSave({ execute: false })} disabled={isBusy}>
                  {isBusy ? t('common.saving', 'Saving...') : 'Create'}
                </button>
                <button type="button" className={s.primaryButton} onClick={() => handleTransferSave({ execute: true })} disabled={isBusy}>
                  {isBusy ? t('common.saving', 'Saving...') : 'Execute'}
                </button>
              </>
            ) : null}
          </div>
        </div>

        {saveError ? <div className={s.errorBanner}>{saveError}</div> : null}
        {actionError ? (
          <div className={s.errorBanner}>
            {actionError}
            {actionErrorCode === 'COSTING_NOT_INITIALIZED' ? (
              <>
                {' '}
                <Link to="/main/company-settings/warehouse">Open settings</Link>
              </>
            ) : null}
          </div>
        ) : null}

        <div className={s.section}>
          <h2 className={s.sectionTitle}>Header</h2>
          <div className={s.grid}>
            {isReceipt ? (
              <>
                <div className={s.field}>
                  <label className={s.fieldLabel}>Warehouse *</label>
                  <ThemedSelect value={header.warehouseId} onChange={(value) => setHeaderField('warehouseId', value)} options={warehouseOptions} placeholder="Select warehouse" />
                  {errors.warehouseId ? <span className={s.fieldError}>{errors.warehouseId}</span> : null}
                </div>
                <div className={s.field}>
                  <label className={s.fieldLabel}>Inbound location</label>
                  <ThemedSelect value={header.inboundLocationId} onChange={(value) => setHeaderField('inboundLocationId', value)} options={locationOptions} placeholder="Select location" />
                  {errors.inboundLocationId ? <span className={s.fieldError}>{errors.inboundLocationId}</span> : null}
                </div>
                <div className={s.field}>
                  <label className={s.fieldLabel}>Supplier (optional)</label>
                  <ThemedSelect value={header.counterpartyId} onChange={(value) => setHeaderField('counterpartyId', value)} options={counterpartyOptions} placeholder="No supplier" />
                </div>
                <div className={s.field}>
                  <label className={s.fieldLabel}>Date</label>
                  <DateTimePicker
                    value={header.issueDate}
                    onChange={(value) => setHeaderField('issueDate', value)}
                    withTime={false}
                    locale={i18n.language === 'pl' ? 'pl-PL' : 'en-US'}
                  />
                </div>
              </>
            ) : null}

            {isAdjustment ? (
              <>
                <div className={s.field}>
                  <label className={s.fieldLabel}>Document type *</label>
                  <ThemedSelect
                    value={header.documentType}
                    onChange={(value) => setHeaderField('documentType', value)}
                    options={[
                      { value: 'PW', label: 'PW' },
                      { value: 'RW', label: 'RW' },
                    ]}
                    placeholder="Select type"
                  />
                  {errors.documentType ? <span className={s.fieldError}>{errors.documentType}</span> : null}
                </div>
                <div className={s.field}>
                  <label className={s.fieldLabel}>Warehouse *</label>
                  <ThemedSelect value={header.warehouseId} onChange={(value) => setHeaderField('warehouseId', value)} options={warehouseOptions} placeholder="Select warehouse" />
                  {errors.warehouseId ? <span className={s.fieldError}>{errors.warehouseId}</span> : null}
                </div>
                <div className={s.field}>
                  <label className={s.fieldLabel}>Location *</label>
                  <ThemedSelect value={header.locationId} onChange={(value) => setHeaderField('locationId', value)} options={locationOptions} placeholder="Select location" />
                  {errors.locationId ? <span className={s.fieldError}>{errors.locationId}</span> : null}
                </div>
                <div className={s.field}>
                  <label className={s.fieldLabel}>Date</label>
                  <DateTimePicker
                    value={header.issueDate}
                    onChange={(value) => setHeaderField('issueDate', value)}
                    withTime={false}
                    locale={i18n.language === 'pl' ? 'pl-PL' : 'en-US'}
                  />
                </div>
              </>
            ) : null}

            {isTransfer ? (
              <>
                <div className={s.field}>
                  <label className={s.fieldLabel}>From warehouse *</label>
                  <ThemedSelect value={header.fromWarehouseId} onChange={(value) => setHeaderField('fromWarehouseId', value)} options={warehouseOptions} placeholder="Select from warehouse" />
                  {errors.fromWarehouseId ? <span className={s.fieldError}>{errors.fromWarehouseId}</span> : null}
                </div>
                <div className={s.field}>
                  <label className={s.fieldLabel}>To warehouse *</label>
                  <ThemedSelect value={header.toWarehouseId} onChange={(value) => setHeaderField('toWarehouseId', value)} options={warehouseOptions} placeholder="Select to warehouse" />
                  {errors.toWarehouseId ? <span className={s.fieldError}>{errors.toWarehouseId}</span> : null}
                </div>
                <div className={s.field}>
                  <label className={s.fieldLabel}>From location</label>
                  <ThemedSelect value={header.fromLocationId} onChange={(value) => setHeaderField('fromLocationId', value)} options={fromLocationOptions} placeholder="Select from location" />
                  {errors.fromLocationId ? <span className={s.fieldError}>{errors.fromLocationId}</span> : null}
                </div>
                <div className={s.field}>
                  <label className={s.fieldLabel}>To location</label>
                  <ThemedSelect value={header.toLocationId} onChange={(value) => setHeaderField('toLocationId', value)} options={toLocationOptions} placeholder="Select to location" />
                  {errors.toLocationId ? <span className={s.fieldError}>{errors.toLocationId}</span> : null}
                </div>
                <div className={s.field}>
                  <label className={s.fieldLabel}>Date</label>
                  <DateTimePicker
                    value={header.issueDate}
                    onChange={(value) => setHeaderField('issueDate', value)}
                    withTime={false}
                    locale={i18n.language === 'pl' ? 'pl-PL' : 'en-US'}
                  />
                </div>
              </>
            ) : null}
          </div>

          {isAdjustment ? (
            <div className={s.field} style={{ marginTop: 10 }}>
              <label className={s.fieldLabel}>Reason</label>
              <input
                className={s.input}
                value={header.reason}
                onChange={(event) => setHeaderField('reason', event.target.value)}
                placeholder="Reason"
              />
            </div>
          ) : null}
        </div>

        <div className={s.section}>
          <div className={s.itemsHeader}>
            <h2 className={s.sectionTitle}>Items</h2>
            <button type="button" className={s.addRowButton} onClick={addItem}>
              Add line
            </button>
          </div>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Product *</th>
                  <th>Variant (optional)</th>
                  {isReceipt ? <th>Lot (optional)</th> : null}
                  {isReceipt ? <th>Qty expected</th> : null}
                  {isReceipt ? <th>Receive line</th> : null}
                  {isAdjustment ? <th>Qty delta</th> : null}
                  {isTransfer ? <th>Qty</th> : null}
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.localId}>
                    <td>
                      <div className={s.productCell}>
                        <button
                          type="button"
                          className={s.pickButton}
                          onClick={() => {
                            setPickerTargetId(item.localId);
                            setPickerOpen(true);
                          }}
                        >
                          {item.productId ? 'Change product' : 'Select product'}
                        </button>
                        <div className={s.productText}>
                          {item.productName || 'No product selected'}
                          {item.sku ? <span className={s.productSub}>SKU: {item.sku}</span> : null}
                        </div>
                      </div>
                      {errors[`item:${item.localId}:productId`] ? <div className={s.fieldError}>{errors[`item:${item.localId}:productId`]}</div> : null}
                    </td>
                    <td>
                      <input
                        className={s.input}
                        value={item.variantId}
                        onChange={(event) => setItemField(item.localId, 'variantId', event.target.value)}
                        placeholder="Variant ID"
                      />
                    </td>
                    {isReceipt ? (
                      <td>
                        <input
                          className={s.input}
                          value={item.lotNumber}
                          onChange={(event) => setItemField(item.localId, 'lotNumber', event.target.value)}
                          placeholder="Lot number"
                        />
                      </td>
                    ) : null}
                    {isReceipt ? (
                      <td>
                        <input
                          className={s.input}
                          type="number"
                          min="0"
                          step="0.0001"
                          value={item.qtyExpected}
                          onChange={(event) => setItemField(item.localId, 'qtyExpected', event.target.value)}
                        />
                        {errors[`item:${item.localId}:qtyExpected`] ? <div className={s.fieldError}>{errors[`item:${item.localId}:qtyExpected`]}</div> : null}
                      </td>
                    ) : null}
                    {isReceipt ? (
                      <td>
                        <label className={s.checkboxRow}>
                          <input
                            type="checkbox"
                            checked={Boolean(item.receiveNow)}
                            onChange={(event) => setItemField(item.localId, 'receiveNow', event.target.checked)}
                          />
                          <span>Receive</span>
                        </label>
                      </td>
                    ) : null}
                    {isAdjustment ? (
                      <td>
                        <input
                          className={s.input}
                          type="number"
                          min="0"
                          step="0.0001"
                          value={item.qtyDelta}
                          onChange={(event) => setItemField(item.localId, 'qtyDelta', event.target.value)}
                        />
                        {errors[`item:${item.localId}:qtyDelta`] ? <div className={s.fieldError}>{errors[`item:${item.localId}:qtyDelta`]}</div> : null}
                      </td>
                    ) : null}
                    {isTransfer ? (
                      <td>
                        <input
                          className={s.input}
                          type="number"
                          min="0"
                          step="0.0001"
                          value={item.qty}
                          onChange={(event) => setItemField(item.localId, 'qty', event.target.value)}
                        />
                        {errors[`item:${item.localId}:qty`] ? <div className={s.fieldError}>{errors[`item:${item.localId}:qty`]}</div> : null}
                      </td>
                    ) : null}
                    <td>
                      <button type="button" className={s.removeButton} onClick={() => removeItem(item.localId)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {errors.items ? <div className={s.fieldError} style={{ marginTop: 8 }}>{errors.items}</div> : null}
        </div>
      </section>

      <OmsProductPicker
        open={isPickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setPickerTargetId('');
        }}
        onSelect={onPickProduct}
        title="Select product"
      />
    </div>
  );
}
