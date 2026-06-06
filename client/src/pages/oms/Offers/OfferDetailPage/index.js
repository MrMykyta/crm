import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import DocumentEnginePage, { mapOfferToDocumentModel } from '../../../../components/documents/DocumentEngine';
import LineItemsEditor from '../../../../components/documents/LineItemsEditor';
import {
  asNumber,
  asText,
  calculateTotals,
  mapLinesToPayload,
  toEditorItem,
} from '../../../../components/documents/LineItemsEditor/lineModel';
import { normalizeItemSortOrder, sortItemsBySortOrder } from '../../../../components/oms/useReorderItems';
import { isOfferEditable } from '../../../../components/oms/documentEditability';
import { DocumentRelations, DocumentTimeline } from '../../../../components/documents/DocumentShell';
import useAclPermissions from '../../../../hooks/useAclPermissions';
import {
  useAcceptOfferMutation,
  useCancelOfferMutation,
  useConvertOfferToOrderMutation,
  useDuplicateOfferMutation,
  useExpireOfferMutation,
  useGetOfferByIdQuery,
  useRejectOfferMutation,
  useSaveOfferItemsMutation,
  useSendOfferMutation,
  useUpdateOfferMutation,
} from '../../../../store/rtk/offersApi';
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

function getErrorText(error, fallback) {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || fallback;
}

function collectOfferInvoices(data) {
  const list = [];
  if (Array.isArray(data?.invoices)) list.push(...data.invoices.filter(Boolean));
  if (data?.convertedInvoice) list.push(data.convertedInvoice);
  const map = new Map();
  list.forEach((item) => { if (item?.id && !map.has(item.id)) map.set(item.id, item); });
  return [...map.values()];
}

function buildDocumentRelations(data, t) {
  const relations = [];
  const convertedOrder = data?.convertedOrder;
  if (convertedOrder?.id || data?.convertedOrderId) {
    const orderId = convertedOrder?.id || data.convertedOrderId;
    relations.push({
      type: t('documents.types.order'),
      number: convertedOrder?.number || orderId,
      status: convertedOrder?.status,
      statusLabel: convertedOrder?.status ? statusLabel(convertedOrder.status, t) : undefined,
      to: `/main/oms/orders/${orderId}`,
    });
  }
  collectOfferInvoices(data).forEach((invoice) => {
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
    data?.issueDate ? { id: 'issued', actorName, action: t('documents.timeline.issued'), timestamp: data.issueDate } : null,
    data?.updatedAt ? { id: 'updated', actorName, action: t('documents.timeline.updated'), timestamp: data.updatedAt } : null,
  ].filter(Boolean);
}

export default function OfferDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { can } = useAclPermissions();
  const canReadOffer = can('offer:read');
  const canUpdateOffer = can('offer:update');
  const canCreateOffer = can('offer:create');
  const canConvertOffer = can('offer:convert');
  const canCreateOrder = can('order:create');

  const [actionLoadingKey, setActionLoadingKey] = useState('');
  const [actionError, setActionError] = useState('');

  const [viewMode, setViewMode] = useState('preview');
  const [form, setForm] = useState(null);
  const [items, setItems] = useState([]);
  const [dirty, setDirty] = useState(false);
  const initRef = useRef(null);

  const { data: base, isLoading, isFetching, isError, error, refetch } = useGetOfferByIdQuery(id, {
    skip: !id,
    refetchOnMountOrArgChange: true,
  });

  const [sendOffer] = useSendOfferMutation();
  const [acceptOffer] = useAcceptOfferMutation();
  const [rejectOffer] = useRejectOfferMutation();
  const [cancelOffer] = useCancelOfferMutation();
  const [expireOffer] = useExpireOfferMutation();
  const [duplicateOffer] = useDuplicateOfferMutation();
  const [convertOfferToOrder] = useConvertOfferToOrderMutation();
  const [updateOffer, { isLoading: isUpdating }] = useUpdateOfferMutation();
  const [saveOfferItems, { isLoading: isSavingItems }] = useSaveOfferItemsMutation();
  const isSaving = isUpdating || isSavingItems;

  const editable = isOfferEditable(base);

  useEffect(() => {
    if (!base?.id || initRef.current === base.id) return;
    initRef.current = base.id;
    setForm({
      currencyCode: base.currency || base.currencyCode || 'PLN',
      issueDate: asText(base.issueDate).slice(0, 10),
      validUntil: asText(base.validUntil).slice(0, 10),
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
    setViewMode(isOfferEditable(base) ? 'edit' : 'preview');
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

  const runAction = useCallback(async (key, runner, { redirect } = {}) => {
    if (!id) return;
    setActionError('');
    setActionLoadingKey(key);
    try {
      const result = await runner().unwrap();
      if (typeof redirect === 'function') {
        const target = redirect(result);
        if (target) { navigate(target); return; }
      }
      await refetch();
    } catch (err) {
      const message = getErrorText(err, t('oms.errors.actionFailed'));
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
        counterpartyId: base?.counterpartyId || base?.counterparty?.id,
        contactId: base?.contactId || base?.contact?.id || null,
        ownerId: base?.ownerId || base?.owner?.id || null,
        currency: asText(form?.currencyCode).toUpperCase() || 'PLN',
        issueDate: form?.issueDate || null,
        validUntil: form?.validUntil || null,
        title: base?.title || '',
        subject: base?.subject || '',
        notes: form?.notes || '',
        paymentTerms: form?.paymentTerms || '',
        deliveryTerms: form?.deliveryTerms || '',
        leadTime: form?.leadTime || '',
      };
      await updateOffer({ id, payload: header }).unwrap();
      await saveOfferItems({ id, items: mapLinesToPayload(items) }).unwrap();
      await refetch();
      setDirty(false);
    } catch (err) {
      setActionError(getErrorText(err, t('documents.editor.saveFailed')));
    }
  }, [base, form, items, id, updateOffer, saveOfferItems, refetch, t]);

  const handleAction = useCallback((action) => {
    if (!action?.key) return;
    if (action.key === 'send') return void runAction('send', () => sendOffer({ id, payload: {} }));
    if (action.key === 'accept') return void runAction('accept', () => acceptOffer({ id, payload: {} }));
    if (action.key === 'reject') return void runAction('reject', () => rejectOffer({ id, payload: {} }));
    if (action.key === 'cancel') return void runAction('cancel', () => cancelOffer({ id, payload: {} }));
    if (action.key === 'expire') return void runAction('expire', () => expireOffer({ id, payload: {} }));
    if (action.key === 'duplicate') {
      return void runAction('duplicate', () => duplicateOffer({ id, payload: {} }), {
        redirect: (result) => {
          const newId = result?.id || result?.data?.id;
          return newId ? `/main/oms/offers/${newId}` : null;
        },
      });
    }
    if (action.key === 'convert-to-order') {
      return void runAction('convert-to-order', () => convertOfferToOrder({ id, payload: {} }), {
        redirect: (result) => {
          const newOrderId = result?.order?.id || result?.data?.order?.id;
          return newOrderId ? `/main/oms/orders/${newOrderId}` : null;
        },
      });
    }
  }, [id, runAction, sendOffer, acceptOffer, rejectOffer, cancelOffer, expireOffer, duplicateOffer, convertOfferToOrder]);

  const headerActions = useMemo(() => {
    const available = base?.availableActions || {};
    const defs = [
      { key: 'send', label: t('oms.actionLabels.send'), enabled: canUpdateOffer && Boolean(available.canSend) },
      { key: 'accept', label: t('oms.actionLabels.accept'), enabled: canUpdateOffer && Boolean(available.canAccept) },
      {
        key: 'reject', label: t('oms.actionLabels.reject'), enabled: canUpdateOffer && Boolean(available.canReject), destructive: true,
        confirm: { title: t('oms.confirm.offerRejectTitle'), text: t('oms.confirm.offerRejectText'), okText: t('oms.confirm.offerRejectOk') },
      },
      {
        key: 'cancel', label: t('oms.actionLabels.cancel'), enabled: canUpdateOffer && Boolean(available.canCancel), destructive: true,
        confirm: { title: t('oms.confirm.offerCancelTitle'), text: t('oms.confirm.offerCancelText'), okText: t('oms.confirm.offerCancelOk') },
      },
      { key: 'expire', label: t('oms.actionLabels.expire'), enabled: canUpdateOffer && Boolean(available.canExpire) },
      { key: 'duplicate', label: t('oms.actionLabels.duplicate'), enabled: canCreateOffer && Boolean(available.canDuplicate) },
      { key: 'convert-to-order', label: t('oms.actionLabels.convertToOrder'), enabled: canConvertOffer && canCreateOrder && Boolean(available.canConvertToOrder), variant: 'primary' },
    ];
    return defs
      .filter((a) => a.enabled)
      .map((a) => ({ ...a, loadingLabel: t('common.loading'), onClick: handleAction }));
  }, [base?.availableActions, canConvertOffer, canCreateOffer, canCreateOrder, canUpdateOffer, handleAction, t]);

  if (!canReadOffer) {
    return <DocumentEnginePage.State title={t('common.noPermission')} text={t('documents.editor.noPermissionHint')} />;
  }
  if (isLoading || (isFetching && !base)) {
    return <DocumentEnginePage.State title={t('common.loading')} text={t('documents.editor.loadingHint')} />;
  }
  if (isError) {
    const message = error?.data?.message || error?.data?.error || error?.message || t('oms.errors.offerLoadFailed');
    return <DocumentEnginePage.State title={t('oms.errors.offerLoadFailed')} text={message} />;
  }
  if (!base) {
    return <DocumentEnginePage.State title={t('oms.errors.offerNotFound')} text={t('documents.editor.notFoundHint')} />;
  }

  const isEdit = viewMode === 'edit' && editable;
  const model = mapOfferToDocumentModel(base, { t, locale });
  const documentRelations = buildDocumentRelations(base, t);
  const timelineEvents = buildTimelineEvents(base, t);
  const counterparty = base?.counterparty || null;
  const counterpartyName = counterparty?.name || counterparty?.shortName || counterparty?.fullName || '';
  const convertedOrder = base?.convertedOrder || null;
  const convertedOrderId = convertedOrder?.id || base?.convertedOrderId || null;
  const invoiceLinks = collectOfferInvoices(base);

  const relationsContent = (
    <>
      {documentRelations.length ? <DocumentRelations relations={documentRelations} /> : null}
      <div className={s.kvList}>
        <div className={s.kvRow}>
          <span className={s.kvLabel}>{t('oms.relations.convertedOrder')}</span>
          <span className={`${s.kvValue} ${s.kvValueLeft}`}>
            {convertedOrderId ? (
              <Link className={s.entityLink} to={`/main/oms/orders/${convertedOrderId}`}>{convertedOrder?.number || convertedOrderId}</Link>
            ) : '—'}
          </span>
        </div>
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

  const editOverrides = isEdit && form ? {
    primaryFields: [
      { label: t('oms.detailLabels.counterparty'), value: counterpartyName },
      { label: t('oms.detailLabels.contact'), value: base?.contact?.name || base?.contact?.email || '' },
      { label: t('oms.detailLabels.owner'), value: base?.owner?.name || base?.owner?.email || '' },
      { label: t('oms.detailLabels.deal'), value: base?.deal?.title || base?.dealId || '' },
      { label: t('oms.detailLabels.notes'), type: 'textarea', value: form.notes, onChange: (v) => setField('notes', v) },
    ],
    secondaryFields: [
      { label: t('oms.detailLabels.issueDate'), type: 'date', value: form.issueDate, onChange: (v) => setField('issueDate', v) },
      { label: t('oms.detailLabels.validUntil'), type: 'date', value: form.validUntil, onChange: (v) => setField('validUntil', v) },
      { label: t('oms.summaryLabels.currency'), type: 'select', value: form.currencyCode, onChange: (v) => setField('currencyCode', v), options: currencyOptions },
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
      back={{ label: t('oms.offers.title'), onClick: () => navigate('/main/oms/offers') }}
      breadcrumb={`${t('oms.offers.title')} / ${model.number}`}
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
