import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import DocumentEnginePage, { WMS_DOCUMENT_ADAPTERS } from '../../../components/documents/DocumentEngine';
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
  if (getParentDocumentId(entity) || getCorrectedById(entity)) return false;
  if (kind === 'receipt') return status !== 'corrected';
  return status === 'shipped';
}

function correctionQty(item, kind) {
  if (kind === 'receipt') return asNumber(item?.qtyReceived ?? item?.qty ?? item?.qtyExpected, 0);
  return asNumber(item?.qty ?? item?.qtyShipped, 0);
}

// --- read-only items table (WMS shape) rendered inside the engine itemsSlot ---
function WmsItemsTable({ items, kind, locale, t }) {
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
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id || `${item.productId || 'product'}-${item.variantId || 'variant'}`}>
                  <td>{itemName(item)}</td>
                  <td>{asText(item?.variantId) || '—'}</td>
                  <td className={s.textRight}>{formatQty(itemQty(item, kind), locale)}</td>
                  <td className={s.textRight}>{itemProgress(item) === null ? '—' : formatQty(itemProgress(item), locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function HistorySection({ historyItems, locale, t }) {
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
  );
}

function CorrectionModal({ open, onClose, onSubmit, document, kind, locale, t, isSubmitting, error }) {
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
  const locale = i18n.language;

  const [actionError, setActionError] = useState('');
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionError, setCorrectionError] = useState('');

  const [postAdjustment, { isLoading: isPostingAdjustment }] = usePostAdjustmentMutation();
  const [createReceiptCorrection, { isLoading: isCreatingReceiptCorrection }] = useCreateReceiptCorrectionMutation();
  const [createShipmentCorrection, { isLoading: isCreatingShipmentCorrection }] = useCreateShipmentCorrectionMutation();

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
  const correctionActionAvailable = canCreateCorrection(kind, base);
  const isCreatingCorrection = isCreatingReceiptCorrection || isCreatingShipmentCorrection;
  const historyItems = useMemo(
    () => (Array.isArray(activeHistoryQuery?.data?.items) ? activeHistoryQuery.data.items : []),
    [activeHistoryQuery?.data?.items]
  );

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
  const model = adapter(base, { t, locale });
  const items = Array.isArray(base?.items) ? base.items : [];
  const routeBase = ROUTE_BASE[kind] || ROUTE_BASE.receipt;

  const actions = [];
  if (kind === 'adjustment' && asText(base.status).toLowerCase() === 'draft') {
    actions.push({
      key: 'post',
      label: isPostingAdjustment ? t('common.saving', 'Saving...') : t('wms.adjustments.actions.post', 'Post'),
      variant: 'primary',
      loading: isPostingAdjustment,
      onClick: onPost,
    });
  }
  if (correctionActionAvailable) {
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
    content: <HistorySection historyItems={historyItems} locale={locale} t={t} />,
  });

  return (
    <>
      <DocumentEnginePage
        model={model}
        mode="preview"
        back={{ label: t('wms.backToList', 'Back to list'), onClick: () => navigate(routeBase) }}
        breadcrumb={`${model.typeLabel} / ${model.number}`}
        paramsTitle={t('documents.editor.header', 'Header')}
        showViewModeToggle
        viewMode="preview"
        viewModeDisabledModes={['edit', 'split']}
        showPrintButton
        onPrint={() => navigate(`${routeBase}/${id}/print`)}
        actions={actions}
        actionError={actionError}
        summaryTitle={t('wms.tabs.summary', 'Summary')}
        itemsSlot={<WmsItemsTable items={items} kind={kind} locale={locale} t={t} />}
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
      />
    </>
  );
}
