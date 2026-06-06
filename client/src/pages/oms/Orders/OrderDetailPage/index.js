import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import DocumentEnginePage, { mapOrderToDocumentModel } from '../../../../components/documents/DocumentEngine';
import LineItemsEditor from '../../../../components/documents/LineItemsEditor';
import {
  asNumber,
  asText,
  calculateTotals,
  mapLinesToPayload,
  toEditorItem,
} from '../../../../components/documents/LineItemsEditor/lineModel';
import { normalizeItemSortOrder, sortItemsBySortOrder } from '../../../../components/oms/useReorderItems';
import { isOrderEditable } from '../../../../components/oms/documentEditability';
import { DocumentRelations, DocumentTimeline } from '../../../../components/documents/DocumentShell';
import useAclPermissions from '../../../../hooks/useAclPermissions';
import {
  useCancelOrderMutation,
  useCompleteOrderMutation,
  useConfirmOrderMutation,
  useConvertOrderToInvoiceMutation,
  useGetOrderByIdQuery,
  useReturnOrderMutation,
  useSaveOrderItemsMutation,
  useShipOrderMutation,
  useUpdateOrderMutation,
} from '../../../../store/rtk/ordersApi';
import s from '../../OmsReadOnlyDetail.module.css';

const DISCOUNT_TYPE_OPTIONS = [
  { value: 'none', label: 'none' },
  { value: 'fixed', label: 'fixed' },
  { value: 'percent', label: 'percent' },
];

function statusLabel(status, t) {
  const normalized = asText(status).toLowerCase();
  if (!normalized) return '—';
  return t(`statuses.${normalized}`, normalized);
}

function getErrorText(error, fallback, t) {
  if (error?.data?.code === 'COSTING_NOT_INITIALIZED') return t('oms.errors.costingNotInitialized');
  return error?.data?.message || error?.data?.error || error?.error || error?.message || fallback;
}

function renderInvoiceLinks(data) {
  const list = [];
  if (Array.isArray(data?.invoices)) list.push(...data.invoices.filter(Boolean));
  if (data?.invoice) list.push(data.invoice);
  if (data?.convertedInvoice) list.push(data.convertedInvoice);
  const map = new Map();
  list.forEach((item) => { if (item?.id && !map.has(item.id)) map.set(item.id, item); });
  return [...map.values()];
}

function buildDocumentRelations(data, t) {
  const relations = [];
  if (data?.sourceOffer?.id) {
    relations.push({
      type: t('documents.types.offer'),
      number: data.sourceOffer.number || data.sourceOffer.id,
      status: data.sourceOffer.status,
      statusLabel: data.sourceOffer.status ? statusLabel(data.sourceOffer.status, t) : undefined,
      to: `/main/oms/offers/${data.sourceOffer.id}`,
    });
  }
  renderInvoiceLinks(data).forEach((invoice) => {
    relations.push({
      type: t('documents.types.invoice'),
      number: invoice.number || invoice.id,
      status: invoice.status,
      statusLabel: invoice.status ? statusLabel(invoice.status, t) : undefined,
      to: `/main/documents/${invoice.id}`,
    });
  });
  return relations;
}

function buildTimelineEvents(data, t) {
  const actorName = data?.owner?.name || data?.owner?.email || '';
  return [
    data?.createdAt ? { id: 'created', actorName, action: t('documents.timeline.created'), timestamp: data.createdAt } : null,
    data?.statusMetadata?.confirmedAt ? { id: 'confirmed', actorName, action: t('documents.timeline.confirmed'), timestamp: data.statusMetadata.confirmedAt } : null,
    data?.updatedAt ? { id: 'updated', actorName, action: t('documents.timeline.updated'), timestamp: data.updatedAt } : null,
  ].filter(Boolean);
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { can } = useAclPermissions();
  const canReadOrder = can('order:read');
  const canUpdateOrder = can('order:update');
  const canConvertOrder = can('order:convert');

  const [actionLoadingKey, setActionLoadingKey] = useState('');
  const [actionError, setActionError] = useState('');

  // Inline-edit state
  const [viewMode, setViewMode] = useState('preview');
  const [form, setForm] = useState(null);
  const [items, setItems] = useState([]);
  const [dirty, setDirty] = useState(false);
  const initRef = useRef(null);

  const { data: base, isLoading, isFetching, isError, error, refetch } = useGetOrderByIdQuery(id, {
    skip: !id,
    refetchOnMountOrArgChange: true,
  });

  const [confirmOrder] = useConfirmOrderMutation();
  const [shipOrder] = useShipOrderMutation();
  const [completeOrder] = useCompleteOrderMutation();
  const [cancelOrder] = useCancelOrderMutation();
  const [returnOrder] = useReturnOrderMutation();
  const [convertOrderToInvoice] = useConvertOrderToInvoiceMutation();
  const [updateOrder, { isLoading: isUpdating }] = useUpdateOrderMutation();
  const [saveOrderItems, { isLoading: isSavingItems }] = useSaveOrderItemsMutation();
  const isSaving = isUpdating || isSavingItems;

  const editable = isOrderEditable(base);

  // Initialise editable state once per loaded document.
  useEffect(() => {
    if (!base?.id || initRef.current === base.id) return;
    initRef.current = base.id;
    setForm({
      currencyCode: base.currencyCode || base.currency || 'PLN',
      placedAt: asText(base.placedAt).slice(0, 10),
      notes: base.notes || '',
      paymentTerms: base.paymentTerms || '',
      deliveryTerms: base.deliveryTerms || '',
      leadTime: base.leadTime || '',
    });
    const mapped = Array.isArray(base.items) && base.items.length
      ? normalizeItemSortOrder(sortItemsBySortOrder(base.items).map(toEditorItem))
      : [];
    setItems(mapped);
    setDirty(false);
    setViewMode(isOrderEditable(base) ? 'edit' : 'preview');
  }, [base]);

  const setField = useCallback((key, value) => {
    setForm((prev) => ({ ...(prev || {}), [key]: value }));
    setDirty(true);
  }, []);

  const onItemsChange = useCallback((next) => {
    setItems(next);
    setDirty(true);
  }, []);

  const currencyOptions = useMemo(() => {
    const list = ['PLN', 'EUR', 'USD'];
    const cur = asText(form?.currencyCode).toUpperCase();
    if (cur && !list.includes(cur)) list.unshift(cur);
    return list.map((c) => ({ value: c, label: c }));
  }, [form?.currencyCode]);

  const runAction = useCallback(async (key, runner, options = {}) => {
    if (!id) return;
    setActionError('');
    setActionLoadingKey(key);
    try {
      const result = await runner().unwrap();
      const redirect = typeof options.redirect === 'function' ? options.redirect(result) : null;
      if (redirect) { navigate(redirect); return result; }
      await refetch();
      return result;
    } catch (err) {
      const message = getErrorText(err, t('oms.errors.actionFailed'), t);
      setActionError(message);
      if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(message);
    } finally {
      setActionLoadingKey('');
    }
  }, [id, navigate, refetch, t]);

  const onSave = useCallback(async () => {
    setActionError('');
    const invalid = !items.length || items.some((it) => (
      !asText(it.name) || asNumber(it.qty, 0) <= 0 || asNumber(it.priceNet, -1) < 0
    ));
    if (invalid) { setActionError(t('documents.editor.validation.itemNameRequired')); return; }
    try {
      const header = {
        counterpartyId: base?.counterpartyId || base?.counterparty?.id || base?.customerId,
        contactId: base?.contactId || base?.contact?.id || null,
        ownerId: base?.ownerId || base?.owner?.id || null,
        currencyCode: asText(form?.currencyCode).toUpperCase() || 'PLN',
        placedAt: form?.placedAt || null,
        notes: form?.notes || '',
        paymentTerms: form?.paymentTerms || '',
        deliveryTerms: form?.deliveryTerms || '',
        leadTime: form?.leadTime || '',
      };
      await updateOrder({ id, payload: header }).unwrap();
      await saveOrderItems({ id, items: mapLinesToPayload(items) }).unwrap();
      await refetch();
      setDirty(false);
    } catch (err) {
      setActionError(getErrorText(err, t('documents.editor.saveFailed'), t));
    }
  }, [base, form, items, id, updateOrder, saveOrderItems, refetch, t]);

  const handleAction = useCallback((action) => {
    if (!action?.key) return;
    if (action.key === 'confirm') return void runAction('confirm', () => confirmOrder({ id, payload: {} }));
    if (action.key === 'ship') return void runAction('ship', () => shipOrder({ id, payload: {} }));
    if (action.key === 'complete') return void runAction('complete', () => completeOrder({ id, payload: {} }));
    if (action.key === 'cancel') return void runAction('cancel', () => cancelOrder({ id, payload: {} }));
    if (action.key === 'return') return void runAction('return', () => returnOrder({ id, payload: {} }));
    if (action.key === 'convert-to-invoice') {
      return void runAction('convert-to-invoice', () => convertOrderToInvoice({ id, payload: {} }), {
        redirect: (result) => {
          const invoiceId = result?.invoice?.id || result?.data?.invoice?.id;
          return invoiceId ? `/main/documents/${invoiceId}` : null;
        },
      });
    }
  }, [id, runAction, confirmOrder, shipOrder, completeOrder, cancelOrder, returnOrder, convertOrderToInvoice]);

  const headerActions = useMemo(() => {
    const available = base?.availableActions || {};
    const defs = [
      { key: 'confirm', label: t('oms.actionLabels.confirm'), enabled: canUpdateOrder && Boolean(available.canConfirm) },
      { key: 'ship', label: t('oms.actionLabels.ship'), enabled: canUpdateOrder && Boolean(available.canShip) },
      { key: 'complete', label: t('oms.actionLabels.complete'), enabled: canUpdateOrder && Boolean(available.canComplete) },
      {
        key: 'cancel', label: t('oms.actionLabels.cancel'), enabled: canUpdateOrder && Boolean(available.canCancel), destructive: true,
        confirm: { title: t('oms.confirm.orderCancelTitle'), text: t('oms.confirm.orderCancelText'), okText: t('oms.confirm.orderCancelOk') },
      },
      {
        key: 'return', label: t('oms.actionLabels.return'), enabled: canUpdateOrder && Boolean(available.canReturn), destructive: true,
        confirm: { title: t('oms.confirm.orderReturnTitle'), text: t('oms.confirm.orderReturnText'), okText: t('oms.confirm.orderReturnOk') },
      },
      { key: 'convert-to-invoice', label: t('oms.actionLabels.convertToInvoice'), enabled: canConvertOrder && Boolean(available.canConvertToInvoice), variant: 'primary' },
    ];
    return defs
      .filter((a) => a.enabled)
      .map((a) => ({ ...a, loadingLabel: t('common.loading'), onClick: handleAction }));
  }, [base?.availableActions, canConvertOrder, canUpdateOrder, handleAction, t]);

  if (!canReadOrder) {
    return <DocumentEnginePage.State title={t('common.noPermission')} text={t('documents.editor.noPermissionHint')} />;
  }
  if (isLoading || (isFetching && !base)) {
    return <DocumentEnginePage.State title={t('common.loading')} text={t('documents.editor.loadingHint')} />;
  }
  if (isError) {
    const message = error?.data?.message || error?.data?.error || error?.message || t('oms.errors.orderLoadFailed');
    return <DocumentEnginePage.State title={t('oms.errors.orderLoadFailed')} text={message} />;
  }
  if (!base) {
    return <DocumentEnginePage.State title={t('oms.errors.orderNotFound')} text={t('documents.editor.notFoundHint')} />;
  }

  const isEdit = viewMode === 'edit' && editable;
  const model = mapOrderToDocumentModel(base, { t, locale });
  const documentRelations = buildDocumentRelations(base, t);
  const timelineEvents = buildTimelineEvents(base, t);
  const counterparty = base?.counterparty || base?.customer;
  const counterpartyName = counterparty?.name || counterparty?.shortName || counterparty?.fullName || '';
  const invoiceLinks = renderInvoiceLinks(base);

  const relationsContent = (
    <>
      {documentRelations.length ? <DocumentRelations relations={documentRelations} /> : null}
      <div className={s.kvList}>
        <div className={s.kvRow}>
          <span className={s.kvLabel}>{t('oms.relations.counterparty')}</span>
          <span className={`${s.kvValue} ${s.kvValueLeft}`}>
            {counterparty?.id ? (
              <Link className={s.entityLink} to={`/main/counterparties/${counterparty.id}`}>{counterpartyName || counterparty.id}</Link>
            ) : '—'}
          </span>
        </div>
        <div className={s.kvRow}>
          <span className={s.kvLabel}>{t('oms.relations.contact')}</span>
          <span className={`${s.kvValue} ${s.kvValueLeft}`}>
            {base?.contact?.id ? (
              <Link className={s.entityLink} to={`/main/contacts/${base.contact.id}`}>{base.contact.name || base.contact.email || base.contact.id}</Link>
            ) : (base?.contact?.name || base?.contact?.email || '—')}
          </span>
        </div>
        {invoiceLinks.length ? (
          <div className={s.kvRow}>
            <span className={s.kvLabel}>{t('oms.relations.invoices')}</span>
            <span className={`${s.kvValue} ${s.kvValueLeft}`}>
              <span className={s.inlineLinks}>
                {invoiceLinks.map((invoice) => (
                  <Link key={invoice.id} className={s.entityLink} to={`/main/documents/${invoice.id}`}>{invoice.number || invoice.id}</Link>
                ))}
              </span>
            </span>
          </div>
        ) : null}
      </div>
    </>
  );

  // Edit-mode overrides (editable fields + LineItemsEditor + live totals)
  const editOverrides = isEdit && form ? {
    primaryFields: [
      { label: t('oms.detailLabels.counterparty'), value: counterpartyName },
      { label: t('oms.detailLabels.contact'), value: base?.contact?.name || base?.contact?.email || '' },
      { label: t('oms.detailLabels.owner'), value: base?.owner?.name || base?.owner?.email || '' },
      { label: t('oms.detailLabels.notes'), type: 'textarea', value: form.notes, onChange: (v) => setField('notes', v) },
    ],
    secondaryFields: [
      { label: t('oms.detailLabels.placedAt'), type: 'date', value: form.placedAt, onChange: (v) => setField('placedAt', v) },
      { label: t('oms.summaryLabels.currency'), type: 'select', value: form.currencyCode, onChange: (v) => setField('currencyCode', v), options: currencyOptions },
      { label: t('oms.detailLabels.paymentStatus'), value: statusLabel(base?.paymentStatus, t) },
      { label: t('oms.detailLabels.fulfillmentStatus'), value: statusLabel(base?.fulfillmentStatus, t) },
      { label: t('oms.detailLabels.paymentTerms'), type: 'text', value: form.paymentTerms, onChange: (v) => setField('paymentTerms', v) },
      { label: t('oms.detailLabels.deliveryTerms'), type: 'text', value: form.deliveryTerms, onChange: (v) => setField('deliveryTerms', v) },
      { label: t('oms.detailLabels.leadTime'), type: 'text', value: form.leadTime, onChange: (v) => setField('leadTime', v) },
    ],
    itemsSlot: (
      <LineItemsEditor
        lines={items}
        onChange={onItemsChange}
        discountTypeOptions={DISCOUNT_TYPE_OPTIONS}
        productPickerTitle={t('documents.lines.productPickerTitle')}
      />
    ),
    totals: {
      netLabel: t('oms.summaryLabels.net'),
      vatLabel: t('oms.summaryLabels.vat'),
      grossLabel: t('oms.summaryLabels.gross'),
      ...calculateTotals(items),
    },
  } : {};

  return (
    <DocumentEnginePage
      model={model}
      mode={isEdit ? 'edit' : 'preview'}
      back={{ label: t('oms.orders.title'), onClick: () => navigate('/main/oms/orders') }}
      breadcrumb={`${t('oms.orders.title')} / ${model.number}`}
      showViewModeToggle
      viewMode={viewMode}
      viewModeDisabledModes={editable ? ['split'] : ['edit', 'split']}
      onViewModeChange={(mode) => {
        if (mode === 'split') return;
        if (mode === 'edit' && !editable) return;
        setViewMode(mode);
      }}
      showPrintButton
      onPrint={() => { if (typeof window !== 'undefined') window.print(); }}
      showSaveButton={isEdit}
      onSave={onSave}
      saveDisabled={!dirty || isSaving}
      saveLoading={isSaving}
      actions={headerActions}
      actionLoadingKey={actionLoadingKey}
      actionError={actionError}
      itemsTitle={t('documents.lines.title')}
      emptyItemsLabel={t('oms.itemsTable.empty')}
      summaryTitle={t('documents.editor.summaryTitle')}
      lockedNote={!editable ? { label: t('documents.locked.label'), text: t('documents.locked.text') } : undefined}
      sections={[
        { key: 'relations', title: t('oms.relations.title'), content: relationsContent },
        { key: 'history', title: t('oms.tabs.history'), content: <DocumentTimeline events={timelineEvents} /> },
      ]}
      {...editOverrides}
    />
  );
}
