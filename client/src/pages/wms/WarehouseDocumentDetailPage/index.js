import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Printer } from 'lucide-react';

import EntityDetailPage from '../../_scaffold/EntityDetailPage';
import s from '../../oms/OmsReadOnlyDetail.module.css';
import Modal from '../../../components/Modal';
import {
  useCreateReceiptCorrectionMutation,
  useCreateShipmentCorrectionMutation,
  useGetAdjustmentByIdQuery,
  useGetAdjustmentStockMovesQuery,
  usePostAdjustmentMutation,
  useGetReceiptByIdQuery,
  useGetReceiptStockMovesQuery,
  useGetShipmentByIdQuery,
  useGetShipmentStockMovesQuery,
  useGetTransferByIdQuery,
  useGetTransferStockMovesQuery,
} from '../../../store/rtk/wmsDocumentsApi';

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function asNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function formatDate(value, locale = 'en') {
  const text = asText(value);
  if (!text) return '—';
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function formatQty(value, locale = 'en') {
  const qty = asNumber(value, NaN);
  if (!Number.isFinite(qty)) return '—';
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(qty);
}

function statusLabel(status, t) {
  const normalized = asText(status).toLowerCase();
  if (!normalized) return '—';
  return t(`statuses.${normalized}`, normalized);
}

function itemName(item) {
  return item?.nameSnapshot || item?.skuSnapshot || item?.productId || '—';
}

function itemQty(item, kind) {
  if (kind === 'adjustment') return item?.qtyDelta ?? 0;
  return item?.qty ?? item?.qtyExpected ?? 0;
}

function itemProgress(item) {
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

function documentLinkLabel(summary, id) {
  return summary?.number || (id ? `#${String(id).slice(0, 8)}` : '—');
}

function getCorrectedById(entity) {
  return entity?.correctedById || entity?.corrected_by_id || null;
}

function getParentDocumentId(entity) {
  return entity?.parentDocumentId || entity?.parent_document_id || null;
}

function canCreateCorrection(kind, entity) {
  if (kind !== 'receipt' && kind !== 'shipment') return false;
  if (!entity) return false;
  const status = asText(entity.status).toLowerCase();
  const parentDocumentId = getParentDocumentId(entity);
  const correctedById = getCorrectedById(entity);
  if (parentDocumentId || correctedById) return false;
  if (kind === 'receipt') return status !== 'corrected';
  return status === 'shipped';
}

function correctionQty(item, kind) {
  if (kind === 'receipt') {
    return asNumber(item?.qtyReceived ?? item?.qty ?? item?.qtyExpected, 0);
  }
  return asNumber(item?.qty ?? item?.qtyShipped, 0);
}

function buildConfig(kind, t) {
  if (kind === 'receipt') {
    return {
      title: t('wms.receipts.detailTitle', 'Receipt details'),
      label: 'PZ',
      listRoute: '/main/wms/receipts',
      detailRoute: '/main/wms/receipts',
      tabsNamespace: 'wms.receipt.detail',
      tabs: [
        { key: 'items', label: t('wms.tabs.items', 'Items') },
        { key: 'history', label: t('wms.tabs.history', 'History') },
        { key: 'summary', label: t('wms.tabs.summary', 'Summary') },
      ],
      schema: [
        { kind: 'section', title: 'Document' },
        { name: 'number', label: 'Number', type: 'text', cols: 2, disabled: true },
        { name: 'status', label: 'Status', type: 'text', cols: 2, disabled: true },
        { name: 'warehouseId', label: 'Warehouse', type: 'text', cols: 2, disabled: true },
        { name: 'createdAt', label: 'Created at', type: 'text', cols: 2, disabled: true },
        { name: 'updatedAt', label: 'Updated at', type: 'text', cols: 2, disabled: true },
      ],
    };
  }

  if (kind === 'transfer') {
    return {
      title: t('wms.transfers.detailTitle', 'Transfer details'),
      label: 'MM',
      listRoute: '/main/wms/transfers',
      detailRoute: '/main/wms/transfers',
      tabsNamespace: 'wms.transfer.detail',
      tabs: [
        { key: 'items', label: t('wms.tabs.items', 'Items') },
        { key: 'history', label: t('wms.tabs.history', 'History') },
        { key: 'summary', label: t('wms.tabs.summary', 'Summary') },
      ],
      schema: [
        { kind: 'section', title: 'Document' },
        { name: 'number', label: 'Number', type: 'text', cols: 2, disabled: true },
        { name: 'status', label: 'Status', type: 'text', cols: 2, disabled: true },
        { name: 'fromWarehouseId', label: 'From warehouse', type: 'text', cols: 2, disabled: true },
        { name: 'toWarehouseId', label: 'To warehouse', type: 'text', cols: 2, disabled: true },
        { name: 'createdAt', label: 'Created at', type: 'text', cols: 2, disabled: true },
        { name: 'updatedAt', label: 'Updated at', type: 'text', cols: 2, disabled: true },
      ],
    };
  }

  if (kind === 'adjustment') {
    return {
      title: t('wms.adjustments.detailTitle', 'Adjustment details'),
      label: 'RW/PW',
      listRoute: '/main/wms/adjustments',
      detailRoute: '/main/wms/adjustments',
      tabsNamespace: 'wms.adjustment.detail',
      tabs: [
        { key: 'items', label: t('wms.tabs.items', 'Items') },
        { key: 'history', label: t('wms.tabs.history', 'History') },
        { key: 'summary', label: t('wms.tabs.summary', 'Summary') },
      ],
      schema: [
        { kind: 'section', title: 'Document' },
        { name: 'number', label: 'Number', type: 'text', cols: 2, disabled: true },
        { name: 'documentType', label: 'Type', type: 'text', cols: 2, disabled: true },
        { name: 'status', label: 'Status', type: 'text', cols: 2, disabled: true },
        { name: 'warehouseId', label: 'Warehouse', type: 'text', cols: 2, disabled: true },
        { name: 'reason', label: 'Reason', type: 'text', cols: 2, disabled: true },
        { name: 'createdAt', label: 'Created at', type: 'text', cols: 2, disabled: true },
        { name: 'postedAt', label: 'Posted at', type: 'text', cols: 2, disabled: true },
      ],
    };
  }

  return {
    title: t('wms.shipments.detailTitle', 'Shipment details'),
    label: 'WZ',
    listRoute: '/main/wms/shipments',
    detailRoute: '/main/wms/shipments',
    tabsNamespace: 'wms.shipment.detail',
    tabs: [
      { key: 'items', label: t('wms.tabs.items', 'Items') },
      { key: 'history', label: t('wms.tabs.history', 'History') },
      { key: 'summary', label: t('wms.tabs.summary', 'Summary') },
    ],
    schema: [
      { kind: 'section', title: 'Document' },
      { name: 'number', label: 'Number', type: 'text', cols: 2, disabled: true },
      { name: 'status', label: 'Status', type: 'text', cols: 2, disabled: true },
      { name: 'warehouseId', label: 'Warehouse', type: 'text', cols: 2, disabled: true },
      { name: 'orderId', label: 'Order', type: 'text', cols: 2, disabled: true },
      { name: 'createdAt', label: 'Created at', type: 'text', cols: 2, disabled: true },
      { name: 'updatedAt', label: 'Updated at', type: 'text', cols: 2, disabled: true },
    ],
  };
}

function toFormEntity(entity, kind, t, locale) {
  const base = {
    number: entity?.number || '',
    documentType: entity?.documentType || '',
    status: statusLabel(entity?.status, t),
    warehouseId: entity?.warehouseId || '',
    reason: entity?.reason || '',
    createdAt: formatDate(entity?.createdAt, locale),
    updatedAt: formatDate(entity?.updatedAt, locale),
    postedAt: formatDate(entity?.postedAt, locale),
  };
  if (kind === 'transfer') {
    return {
      ...base,
      fromWarehouseId: entity?.fromWarehouseId || '',
      toWarehouseId: entity?.toWarehouseId || '',
    };
  }
  if (kind === 'shipment') {
    return {
      ...base,
      orderId: entity?.orderId || '',
    };
  }
  return base;
}

function RightTabs({ tab, data, historyItems, kind, locale, t }) {
  const items = Array.isArray(data?.items) ? data.items : [];

  if (tab === 'items') {
    return (
      <section className={s.section}>
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
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id || `${item.productId || 'product'}-${item.variantId || 'variant'}`}>
                    <td>{itemName(item)}</td>
                    <td>{asText(item?.variantId) || '—'}</td>
                    <td className={s.textRight}>{formatQty(itemQty(item, kind), locale)}</td>
                    <td className={s.textRight}>
                      {itemProgress(item) === null ? '—' : formatQty(itemProgress(item), locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  if (tab === 'history') {
    return (
      <section className={s.section}>
        <h3 className={s.sectionTitle}>{t('wms.tabs.history', 'History')}</h3>
        {!historyItems.length ? (
          <p className={s.empty}>{t('wms.history.empty', 'No stock moves')}</p>
        ) : (
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
                    <td>{asText(move?.productId) || '—'}</td>
                    <td className={s.textRight}>{formatQty(move?.qty, locale)}</td>
                    <td>{asText(move?.fromLocationId) || '—'}</td>
                    <td>{asText(move?.toLocationId) || '—'}</td>
                    <td>{asText(move?.refItemId) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  const totalQty = items.reduce((acc, item) => acc + asNumber(itemQty(item, kind), 0), 0);
  const processedQty = items.reduce((acc, item) => acc + asNumber(itemProgress(item), 0), 0);

  return (
    <section className={s.section}>
      <h3 className={s.sectionTitle}>{t('wms.tabs.summary', 'Summary')}</h3>
      <div className={s.kvList}>
        <div className={s.kvRow}><span className={s.kvLabel}>{t('wms.summary.items', 'Items')}</span><span className={s.kvValue}>{items.length}</span></div>
        <div className={s.kvRow}><span className={s.kvLabel}>{t('wms.summary.qtyTotal', 'Total qty')}</span><span className={s.kvValue}>{formatQty(totalQty, locale)}</span></div>
        <div className={s.kvRow}><span className={s.kvLabel}>{t('wms.summary.qtyProcessed', 'Processed qty')}</span><span className={s.kvValue}>{formatQty(processedQty, locale)}</span></div>
        {kind === 'adjustment' ? (
          <div className={s.kvRow}>
            <span className={s.kvLabel}>{t('wms.adjustments.filters.documentType', 'Type')}</span>
            <span className={s.kvValue}>{asText(data?.documentType) || '—'}</span>
          </div>
        ) : null}
        {kind === 'shipment' && data?.orderId ? (
          <div className={s.kvRow}>
            <span className={s.kvLabel}>{t('wms.summary.order', 'Order')}</span>
            <span className={`${s.kvValue} ${s.kvValueLeft}`}>
              <Link className={s.entityLink} to={`/main/oms/orders/${data.orderId}`}>{data.orderId}</Link>
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CorrectionModal({
  open,
  onClose,
  onSubmit,
  document,
  kind,
  locale,
  t,
  isSubmitting,
  error,
}) {
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
    setSelectedIds((prev) => (
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    ));
  }, []);

  const selectedCount = selectedIds.length;
  const canSubmit = selectedCount > 0 && !isSubmitting;

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
            items: selected.map((item) => ({
              originalItemId: item.id,
              qty: correctionQty(item, kind),
            })),
          });
        }}
      >
        {isSubmitting
          ? t('common.saving', 'Saving...')
          : t('wms.corrections.submit', 'Create correction')}
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
          {t(
            'wms.corrections.fullLineHint',
            'MVP supports full-line correction only. Quantity is read-only and equals the original processed quantity.'
          )}
        </p>
        {error ? <div className={s.errorBox}>{error}</div> : null}
        <label className={s.fieldLabel} htmlFor="wms-correction-reason">
          {t('wms.corrections.reason', 'Reason')}
        </label>
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
                    <td>{itemName(item)}</td>
                    <td>{asText(item?.variantId) || '—'}</td>
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

  const [actionError, setActionError] = useState('');
  const [actionErrorCode, setActionErrorCode] = useState('');
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionError, setCorrectionError] = useState('');

  const config = useMemo(() => buildConfig(kind, t), [kind, t]);

  const [postAdjustment, { isLoading: isPostingAdjustment }] = usePostAdjustmentMutation();
  const [createReceiptCorrection, { isLoading: isCreatingReceiptCorrection }] = useCreateReceiptCorrectionMutation();
  const [createShipmentCorrection, { isLoading: isCreatingShipmentCorrection }] = useCreateShipmentCorrectionMutation();

  const adjustmentQuery = useGetAdjustmentByIdQuery(id, { skip: kind !== 'adjustment' || !id, refetchOnMountOrArgChange: true });
  const receiptQuery = useGetReceiptByIdQuery(id, { skip: kind !== 'receipt' || !id, refetchOnMountOrArgChange: true });
  const transferQuery = useGetTransferByIdQuery(id, { skip: kind !== 'transfer' || !id, refetchOnMountOrArgChange: true });
  const shipmentQuery = useGetShipmentByIdQuery(id, { skip: kind !== 'shipment' || !id, refetchOnMountOrArgChange: true });

  const adjustmentHistoryQuery = useGetAdjustmentStockMovesQuery(
    { id, page: 1, limit: 200 },
    { skip: kind !== 'adjustment' || !id, refetchOnMountOrArgChange: true }
  );
  const receiptHistoryQuery = useGetReceiptStockMovesQuery(
    { id, page: 1, limit: 200 },
    { skip: kind !== 'receipt' || !id, refetchOnMountOrArgChange: true }
  );
  const transferHistoryQuery = useGetTransferStockMovesQuery(
    { id, page: 1, limit: 200 },
    { skip: kind !== 'transfer' || !id, refetchOnMountOrArgChange: true }
  );
  const shipmentHistoryQuery = useGetShipmentStockMovesQuery(
    { id, page: 1, limit: 200 },
    { skip: kind !== 'shipment' || !id, refetchOnMountOrArgChange: true }
  );

  const activeQuery = kind === 'adjustment'
    ? adjustmentQuery
    : kind === 'receipt'
      ? receiptQuery
      : kind === 'transfer'
        ? transferQuery
        : shipmentQuery;
  const activeHistoryQuery = kind === 'adjustment'
    ? adjustmentHistoryQuery
    : kind === 'receipt'
      ? receiptHistoryQuery
      : kind === 'transfer'
        ? transferHistoryQuery
        : shipmentHistoryQuery;

  const base = activeQuery?.data || null;
  const correctionActionAvailable = canCreateCorrection(kind, base);
  const isCreatingCorrection = isCreatingReceiptCorrection || isCreatingShipmentCorrection;
  const historyItems = useMemo(
    () => (Array.isArray(activeHistoryQuery?.data?.items) ? activeHistoryQuery.data.items : []),
    [activeHistoryQuery?.data?.items]
  );

  const schemaBuilder = useCallback(() => config.schema, [config.schema]);
  const toForm = useCallback(
    (entity) => toFormEntity(entity, kind, t, i18n.language),
    [kind, t, i18n.language]
  );
  const load = useCallback(async () => base, [base]);
  const save = useCallback(async (_id, payload) => payload, []);

  const rightTabs = useCallback(
    ({ tab, data }) => (
      <RightTabs
        tab={tab}
        data={data}
        historyItems={historyItems}
        kind={kind}
        locale={i18n.language}
        t={t}
      />
    ),
    [historyItems, kind, i18n.language, t]
  );

  const onPost = useCallback(async () => {
    if (!id || kind !== 'adjustment') return;
    setActionError('');
    setActionErrorCode('');
    try {
      await postAdjustment({ id }).unwrap();
      await Promise.all([activeQuery.refetch?.(), activeHistoryQuery.refetch?.()]);
    } catch (err) {
      const message = getWmsActionErrorText(err, t);
      setActionError(message);
      setActionErrorCode(err?.data?.code || '');
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(message);
      }
    }
  }, [activeHistoryQuery, activeQuery, id, kind, postAdjustment, t]);

  const onCreateCorrection = useCallback(async (payload) => {
    if (!id || (kind !== 'receipt' && kind !== 'shipment')) return;
    setActionError('');
    setActionErrorCode('');
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
      setActionErrorCode(err?.data?.code || '');
    }
  }, [
    activeHistoryQuery,
    activeQuery,
    createReceiptCorrection,
    createShipmentCorrection,
    id,
    kind,
    navigate,
    t,
  ]);

  const relationPanel = useMemo(() => {
    if (kind !== 'receipt' && kind !== 'shipment') return null;
    const parentId = getParentDocumentId(base);
    const correctedById = getCorrectedById(base);
    if (!parentId && !correctedById) return null;

    const parentRoute = correctionRoute(kind, parentId);
    const correctedRoute = correctionRoute(kind, correctedById);
    const parentSummary = base?.parentDocument || null;
    const correctedSummary = base?.correctedBy || null;

    return (
      <div className={s.relationPanel}>
        {parentId ? (
          <div className={s.relationRow}>
            <span className={s.relationLabel}>{t('wms.relations.originalDocument', 'Original document')}</span>
            {parentRoute ? (
              <Link className={s.entityLink} to={parentRoute}>
                {documentLinkLabel(parentSummary, parentId)}
              </Link>
            ) : (
              <span>{documentLinkLabel(parentSummary, parentId)}</span>
            )}
          </div>
        ) : null}
        {correctedById ? (
          <div className={s.relationRow}>
            <span className={s.relationLabel}>{t('wms.relations.correctionDocument', 'Correction document')}</span>
            {correctedRoute ? (
              <Link className={s.entityLink} to={correctedRoute}>
                {documentLinkLabel(correctedSummary, correctedById)}
              </Link>
            ) : (
              <span>{documentLinkLabel(correctedSummary, correctedById)}</span>
            )}
          </div>
        ) : null}
      </div>
    );
  }, [base, kind, t]);

  if (activeQuery.isLoading || activeQuery.isFetching) {
    return <div style={{ padding: 16, color: 'var(--ui-text-2)' }}>{t('common.loading', 'Loading...')}</div>;
  }

  if (activeQuery.isError) {
    const message = activeQuery?.error?.data?.message || activeQuery?.error?.data?.error || activeQuery?.error?.message || t('common.error', 'Error');
    return <div style={{ padding: 16, color: 'var(--danger)' }}>{message}</div>;
  }

  if (!base) {
    return <div style={{ padding: 16, color: 'var(--ui-text-2)' }}>{t('common.notFound', 'Not found')}</div>;
  }

  return (
    <>
      <EntityDetailPage
        id={id}
        tabs={config.tabs}
        tabsNamespace={config.tabsNamespace}
        schemaBuilder={schemaBuilder}
        toForm={toForm}
        toApi={(vals) => vals}
        load={load}
        save={save}
        storageKeyPrefix={`wms-${kind}-readonly`}
        autosave={{ debounceMs: 1000 }}
        saveOnExit={false}
        clearDraftOnUnmount
        leftTop={(
          <div className={s.headerCard}>
            <div className={s.eyebrow}>
              {kind === 'adjustment' && asText(base.documentType)
                ? `${config.label} · ${asText(base.documentType).toUpperCase()}`
                : config.label}
            </div>
            <div className={s.titleRow}>
              <h1 className={s.title}>{base.number || `#${String(base.id || '').slice(0, 8)}`}</h1>
              <span className={s.statusBadge}>{statusLabel(base.status, t)}</span>
            </div>
            <div className={s.total}>
              <button
                type="button"
                className={s.actionChip}
                onClick={() => navigate(config.listRoute)}
              >
                {t('wms.backToList', 'Back to list')}
              </button>
              <button
                type="button"
                className={s.actionChip}
                onClick={() => navigate(`${config.detailRoute}/${id}/print`)}
              >
                <Printer size={14} aria-hidden="true" />
                {t('wms.print.print', 'Print')}
              </button>
              {kind === 'adjustment' && String(base.status || '').toLowerCase() === 'draft' ? (
                <button
                  type="button"
                  className={s.actionChip}
                  onClick={onPost}
                  disabled={isPostingAdjustment}
                >
                  {isPostingAdjustment
                    ? t('common.saving', 'Saving...')
                    : t('wms.adjustments.actions.post', 'Post')}
                </button>
              ) : null}
              {correctionActionAvailable ? (
                <button
                  type="button"
                  className={`${s.actionChip} ${s.actionEnabled}`}
                  onClick={() => {
                    setCorrectionError('');
                    setCorrectionOpen(true);
                  }}
                  disabled={isCreatingCorrection}
                >
                  {t('wms.corrections.create', 'Create correction')}
                </button>
              ) : null}
              {relationPanel}
              {actionError ? (
                <div style={{ marginTop: 8, color: 'var(--danger)' }}>
                  {actionError}
                  {actionErrorCode === 'COSTING_NOT_INITIALIZED' ? (
                    <>
                      {' '}
                      <Link className={s.entityLink} to="/main/company-settings/warehouse">
                        {t('wms.costing.actions.openSettings', 'Open settings')}
                      </Link>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        )}
        RightTabsComponent={rightTabs}
      />
      <CorrectionModal
        open={correctionOpen}
        onClose={() => setCorrectionOpen(false)}
        onSubmit={onCreateCorrection}
        document={base}
        kind={kind}
        locale={i18n.language}
        t={t}
        isSubmitting={isCreatingCorrection}
        error={correctionError}
      />
    </>
  );
}
