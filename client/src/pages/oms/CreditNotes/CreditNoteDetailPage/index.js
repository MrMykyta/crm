import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  BanknoteArrowDown,
  FileText,
  ReceiptText,
  RotateCcw,
  UserRound,
} from 'lucide-react';

import {
  DetailCard,
  DetailLayout,
  DetailSection,
  DetailTabs,
} from '../../../../components/detail';
import CustomerDocumentRenderer, {
  buildCreditNoteDocumentDto,
} from '../../../../components/oms/CustomerDocumentRenderer';
import DocumentDeliveryDialog from '../../../../components/oms/DocumentDeliveryDialog';
import DocumentShareDialog from '../../../../components/oms/DocumentShareDialog';
import useAclPermissions from '../../../../hooks/useAclPermissions';
import { asText } from '../../../../lib/format';
import {
  useGetCreditNoteByIdQuery,
  useIssueCreditNoteFromInvoiceMutation,
  useApplyCreditNoteMutation,
  useRefundCreditNoteMutation,
  useCancelCreditNoteMutation,
  useGenerateCreditNotePdfMutation,
  useSendCreditNoteDocumentMutation,
} from '../../../../store/rtk/creditNotesApi';
import {
  useGetInvoiceByIdQuery,
  useListInvoicesQuery,
} from '../../../../store/rtk/invoicesApi';
import { useLazyGetSignedFileUrlQuery } from '../../../../store/rtk/filesApi';
import {
  useCreateDocumentShareMutation,
  useListDocumentSharesQuery,
  useRevokeDocumentShareMutation,
} from '../../../../store/rtk/documentSharesApi';
import s from './CreditNoteDetailPage.module.css';

function asNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMoney(value) {
  return Math.round((asNumber(value, 0) + Number.EPSILON) * 100) / 100;
}

function toInputNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return String(Number(number.toFixed(2)));
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value, locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(+date)) return '—';
  return date.toLocaleDateString(locale || undefined);
}

function formatDateTime(value, locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(+date)) return '—';
  return date.toLocaleString(locale || undefined);
}

function formatAmount(value, locale) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toLocaleString(locale || undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMoney(value, currency = 'PLN', locale) {
  const amount = formatAmount(value, locale);
  return amount === '—' ? '—' : `${amount} ${currency || 'PLN'}`;
}

function customerName(entity) {
  const customer = entity?.customer || entity?.sourceOrder?.customer || entity?.order?.counterparty || entity?.order?.customer;
  return customer?.shortName || customer?.fullName || customer?.name || entity?.customerName || '';
}

function invoiceNumber(invoice) {
  return invoice?.number || invoice?.sourceInvoice?.number || invoice?.id || invoice?.invoiceId || '';
}

function orderNumber(order) {
  return order?.number || order?.sourceOrder?.number || order?.id || order?.orderId || '';
}

function statusLabel(status, t) {
  const key = asText(status).toLowerCase();
  if (!key) return '—';
  return t(`statuses.${key}`, key);
}

function reasonLabel(reason, t) {
  const key = asText(reason);
  return key || t('oms.creditNoteDetail.noReason');
}

function getActionError(error, t) {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || t('oms.errors.actionFailed');
}

function creditTone(creditNote) {
  const status = asText(creditNote?.status).toLowerCase();
  const remaining = asNumber(creditNote?.remainingCredit, 0);
  const applied = asNumber(creditNote?.appliedAmount, 0);
  if (status === 'cancelled') return 'danger';
  if (remaining <= 0 && applied > 0) return 'ok';
  if (applied > 0) return 'soft';
  return 'warning';
}

function MoneyAmount({ value, currency, locale, size = 'md' }) {
  return (
    <span className={`${s.moneyAmount} ${s[`money_${size}`] || ''}`}>
      <span>{formatAmount(value, locale)}</span>
      <small>{currency || 'PLN'}</small>
    </span>
  );
}

function Fact({ label, value, to }) {
  const content = to ? <Link to={to}>{value || '—'}</Link> : <strong>{value || '—'}</strong>;
  return (
    <div className={s.factLine}>
      <span>{label}</span>
      {content}
    </div>
  );
}

function Vital({ label, value, tone = 'muted' }) {
  return (
    <div className={`${s.vital} ${s[`vital_${tone}`] || ''}`}>
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  );
}

function EmptyState({ children }) {
  return <div className={s.empty}>{children}</div>;
}

export default function CreditNoteDetailPage({ createMode = false }) {
  const { id } = useParams();
  if (createMode || id === 'new') return <CreditNoteCreateWorkspace />;
  return <CreditNoteReadWorkspace creditNoteId={id} />;
}

function CreditNoteReadWorkspace({ creditNoteId }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { can } = useAclPermissions();
  const canRead = can('order:read');
  const canUpdate = can('order:update');
  const [activeTab, setActiveTab] = useState('overview');
  const [actionLoadingKey, setActionLoadingKey] = useState('');
  const [actionError, setActionError] = useState('');
  const [applyAmount, setApplyAmount] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMethod, setRefundMethod] = useState('bank_transfer');
  const [refundReference, setRefundReference] = useState('');

  const {
    data: creditNote,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetCreditNoteByIdQuery(creditNoteId, {
    skip: !creditNoteId,
    refetchOnMountOrArgChange: true,
  });

  const sourceInvoiceId = creditNote?.invoiceId || creditNote?.sourceInvoice?.id || '';
  const {
    data: sourceInvoice,
  } = useGetInvoiceByIdQuery(sourceInvoiceId, {
    skip: !sourceInvoiceId,
    refetchOnMountOrArgChange: true,
  });

  const [applyCreditNote] = useApplyCreditNoteMutation();
  const [refundCreditNote] = useRefundCreditNoteMutation();
  const [cancelCreditNote] = useCancelCreditNoteMutation();

  const currency = creditNote?.currencyCode || creditNote?.sourceOrder?.currencyCode || sourceInvoice?.currencyCode || sourceInvoice?.order?.currencyCode || 'PLN';
  const amountGross = asNumber(creditNote?.amountGross ?? creditNote?.amounts?.amountGross ?? creditNote?.amount, 0);
  const appliedAmount = asNumber(creditNote?.appliedAmount ?? creditNote?.amounts?.appliedAmount, 0);
  const remainingCredit = asNumber(creditNote?.remainingCredit ?? creditNote?.amounts?.remainingCredit, Math.max(0, amountGross - appliedAmount));
  const refundableAmount = asNumber(creditNote?.refundableAmount ?? creditNote?.amounts?.refundableAmount, remainingCredit);
  const invoiceDue = asNumber(sourceInvoice?.amountDue, asNumber(creditNote?.sourceInvoice?.amountDue, 0));
  const suggestedApply = Math.min(remainingCredit, Math.max(0, invoiceDue));
  const tone = creditTone(creditNote);
  const availableActions = creditNote?.availableActions || {};
  const customer = customerName(creditNote) || t('oms.creditNoteDetail.noCustomer');
  const sourceOrderId = creditNote?.orderId || creditNote?.sourceOrder?.id || sourceInvoice?.orderId || sourceInvoice?.order?.id || '';
  const sourceOrderLabel = creditNote?.sourceOrder?.number || sourceInvoice?.order?.number || sourceOrderId;
  const sourceInvoiceLabel = creditNote?.sourceInvoice?.number || sourceInvoice?.number || sourceInvoiceId;
  const applications = useMemo(
    () => (Array.isArray(creditNote?.applications) ? creditNote.applications : []),
    [creditNote?.applications],
  );
  const events = useMemo(
    () => (Array.isArray(creditNote?.events) ? creditNote.events : []),
    [creditNote?.events],
  );
  const refundPayment = creditNote?.refundPayment || null;

  useEffect(() => {
    if (!creditNote) return;
    setApplyAmount((prev) => prev || toInputNumber(suggestedApply));
    setRefundAmount((prev) => prev || toInputNumber(refundableAmount));
  }, [creditNote, refundableAmount, suggestedApply]);

  const nextAction = useMemo(() => {
    if (!creditNote) return '';
    if (availableActions.canApply) return t('oms.creditNoteDetail.next.apply');
    if (availableActions.canRefund) return t('oms.creditNoteDetail.next.refund');
    return t('oms.creditNoteDetail.next.done');
  }, [availableActions.canApply, availableActions.canRefund, creditNote, t]);

  const runAction = useCallback(async (key) => {
    if (!creditNote) return;
    setActionError('');
    setActionLoadingKey(key);
    try {
      if (key === 'apply') {
        const amount = roundMoney(applyAmount);
        if (!sourceInvoiceId) throw new Error(t('oms.creditNoteDetail.errors.invoiceRequired'));
        if (amount <= 0) throw new Error(t('oms.creditNoteDetail.errors.amountPositive'));
        await applyCreditNote({
          id: creditNote.id,
          applications: [{ invoiceId: sourceInvoiceId, amount }],
        }).unwrap();
      }
      if (key === 'refund') {
        const amount = roundMoney(refundAmount);
        if (amount <= 0) throw new Error(t('oms.creditNoteDetail.errors.amountPositive'));
        await refundCreditNote({
          id: creditNote.id,
          amount,
          method: refundMethod,
          reference: refundReference || undefined,
        }).unwrap();
      }
      if (key === 'cancel') {
        await cancelCreditNote(creditNote.id).unwrap();
      }
      await refetch();
    } catch (err) {
      setActionError(getActionError(err, t));
    } finally {
      setActionLoadingKey('');
    }
  }, [
    applyAmount,
    applyCreditNote,
    cancelCreditNote,
    creditNote,
    refundAmount,
    refundCreditNote,
    refundMethod,
    refundReference,
    refetch,
    sourceInvoiceId,
    t,
  ]);

  const primaryAction = useMemo(() => {
    if (!creditNote) return null;
    if (availableActions.canApply) {
      return {
        key: 'apply',
        label: t('oms.creditNoteDetail.actions.apply'),
        icon: <ReceiptText size={15} />,
        disabled: !canUpdate || Boolean(actionLoadingKey) || !sourceInvoiceId || asNumber(applyAmount, 0) <= 0,
      };
    }
    if (availableActions.canRefund) {
      return {
        key: 'refund',
        label: t('oms.creditNoteDetail.actions.refund'),
        icon: <BanknoteArrowDown size={15} />,
        disabled: !canUpdate || Boolean(actionLoadingKey) || asNumber(refundAmount, 0) <= 0,
      };
    }
    return null;
  }, [actionLoadingKey, applyAmount, availableActions.canApply, availableActions.canRefund, canUpdate, creditNote, refundAmount, sourceInvoiceId, t]);

  const smartButtons = useMemo(() => [
    sourceInvoiceId ? {
      key: 'invoice',
      label: t('oms.creditNoteDetail.smart.invoice'),
      value: sourceInvoiceLabel,
      to: `/main/oms/invoices/${sourceInvoiceId}`,
      icon: <ReceiptText size={14} />,
    } : null,
    sourceOrderId ? {
      key: 'order',
      label: t('oms.creditNoteDetail.smart.order'),
      value: sourceOrderLabel,
      to: `/main/oms/orders/${sourceOrderId}`,
      icon: <FileText size={14} />,
    } : null,
    creditNote?.customerId ? {
      key: 'customer',
      label: t('oms.creditNoteDetail.smart.customer'),
      value: customer,
      to: `/main/counterparties/${creditNote.customerId}`,
      icon: <UserRound size={14} />,
    } : null,
    refundPayment?.id ? {
      key: 'refund',
      label: t('oms.creditNoteDetail.smart.refundPayment'),
      value: formatMoney(refundPayment.amount, refundPayment.currencyCode || currency, locale),
      to: `/main/oms/payments/${refundPayment.id}${sourceOrderId ? `?orderId=${encodeURIComponent(sourceOrderId)}` : ''}`,
      icon: <BanknoteArrowDown size={14} />,
    } : null,
  ].filter(Boolean), [creditNote?.customerId, currency, customer, locale, refundPayment, sourceInvoiceId, sourceInvoiceLabel, sourceOrderId, sourceOrderLabel, t]);

  const tabs = useMemo(() => [
    {
      key: 'overview',
      label: t('oms.creditNoteDetail.tabs.overview'),
      render: () => (
        <OverviewTab
          creditNote={creditNote}
          sourceInvoice={sourceInvoice}
          currency={currency}
          locale={locale}
          nextAction={nextAction}
          t={t}
        />
      ),
    },
    {
      key: 'applications',
      label: t('oms.creditNoteDetail.tabs.applications'),
      count: applications.length,
      render: () => (
        <ApplicationsTab
          t={t}
          locale={locale}
          creditNote={creditNote}
          sourceInvoice={sourceInvoice}
          applications={applications}
          currency={currency}
          applyAmount={applyAmount}
          setApplyAmount={setApplyAmount}
          refundAmount={refundAmount}
          setRefundAmount={setRefundAmount}
          refundMethod={refundMethod}
          setRefundMethod={setRefundMethod}
          refundReference={refundReference}
          setRefundReference={setRefundReference}
          canApply={Boolean(availableActions.canApply)}
          canRefund={Boolean(availableActions.canRefund)}
        />
      ),
    },
    {
      key: 'preview',
      label: t('oms.creditNoteDetail.tabs.preview'),
      render: () => <PreviewTab creditNote={creditNote} sourceInvoice={sourceInvoice} currency={currency} locale={locale} t={t} />,
    },
    {
      key: 'activity',
      label: t('oms.creditNoteDetail.tabs.activity'),
      render: () => <ActivityTab events={events} locale={locale} currency={currency} t={t} />,
    },
    {
      key: 'system',
      label: t('oms.creditNoteDetail.tabs.system'),
      render: () => <SystemTab creditNote={creditNote} locale={locale} t={t} />,
    },
  ], [
    applications,
    applyAmount,
    availableActions.canApply,
    availableActions.canRefund,
    creditNote,
    currency,
    events,
    locale,
    nextAction,
    refundAmount,
    refundMethod,
    refundReference,
    sourceInvoice,
    t,
  ]);

  if (!canRead) return <div className={s.state}>{t('common.noPermission')}</div>;
  if (isLoading || (isFetching && !creditNote)) return <div className={s.state}>{t('common.loading')}</div>;
  if (isError) {
    const message = error?.data?.message || error?.data?.error || error?.message || t('oms.creditNoteDetail.errors.loadFailed');
    return <div className={s.state}>{message}</div>;
  }
  if (!creditNote) return <div className={s.state}>{t('oms.creditNoteDetail.errors.notFound')}</div>;

  return (
    <DetailLayout
      mode="entity"
      className={s.creditNoteDetail}
      header={(
        <header className={s.headerWrap}>
          <div className={s.headerTop}>
            <button type="button" className={s.backBtn} onClick={() => navigate('/main/oms/invoices')}>
              <ArrowLeft size={15} /> {t('oms.creditNoteDetail.title')}
            </button>
            <div className={s.headerMeta}>
              <span>{creditNote.number || creditNote.id}</span>
              <span className={s[`toneText_${tone}`] || ''}>{statusLabel(creditNote.status, t)}</span>
            </div>
          </div>

          <div className={s.heroGrid}>
            <div className={s.heroMain}>
              <div className={`${s.heroIcon} ${s[`heroIcon_${tone}`] || ''}`}>
                <RotateCcw size={26} />
              </div>
              <div className={s.heroText}>
                <span>{customer} · {creditNote.number || creditNote.id}</span>
                <h1><MoneyAmount value={amountGross} currency={currency} locale={locale} size="hero" /></h1>
                <p>{reasonLabel(creditNote.reason, t)}</p>
              </div>
            </div>

            <div className={`${s.creditPanel} ${s[`credit_${tone}`] || ''}`}>
              <span>{t('oms.creditNoteDetail.hero.remainingCredit')}</span>
              <MoneyAmount value={remainingCredit} currency={currency} locale={locale} size="md" />
              <div className={s.creditMeta}>
                <span>{t('oms.creditNoteDetail.hero.applied')}: {formatMoney(appliedAmount, currency, locale)}</span>
                <span>{statusLabel(creditNote.status, t)}</span>
                <span>{formatDate(creditNote.issuedAt || creditNote.createdAt, locale)}</span>
              </div>
            </div>
          </div>

          <div className={s.vitalsGrid}>
            <Vital label={t('oms.creditNoteDetail.vitals.credited')} value={formatMoney(amountGross, currency, locale)} tone="warning" />
            <Vital label={t('oms.creditNoteDetail.vitals.applied')} value={formatMoney(appliedAmount, currency, locale)} tone={appliedAmount > 0 ? 'ok' : 'muted'} />
            <Vital label={t('oms.creditNoteDetail.vitals.remaining')} value={formatMoney(remainingCredit, currency, locale)} tone={remainingCredit > 0 ? 'soft' : 'ok'} />
            <Vital label={t('oms.creditNoteDetail.vitals.status')} value={statusLabel(creditNote.status, t)} tone={tone} />
          </div>

          <div className={s.headerActions}>
            <div className={s.smartRow}>
              {smartButtons.map((button) => (
                <Link key={button.key} className={s.smartBtn} to={button.to}>
                  {button.icon}<span>{button.label}</span>{button.value ? <strong>{button.value}</strong> : null}
                </Link>
              ))}
            </div>
            <div className={s.actionRow}>
              <span className={s.nextAction}>{nextAction}</span>
              {availableActions.canCancel ? (
                <button type="button" className={s.secondaryBtn} disabled={!canUpdate || Boolean(actionLoadingKey)} onClick={() => runAction('cancel')}>
                  {t('oms.creditNoteDetail.actions.cancel')}
                </button>
              ) : null}
              {primaryAction ? (
                <button type="button" className={s.primaryBtn} disabled={primaryAction.disabled} onClick={() => runAction(primaryAction.key)}>
                  {primaryAction.icon}
                  {actionLoadingKey === primaryAction.key ? t('common.loading') : primaryAction.label}
                </button>
              ) : null}
            </div>
          </div>
          {actionError ? <div className={s.errorBar}>{actionError}</div> : null}
        </header>
      )}
      sidebar={(
        <aside className={s.sidebar}>
          <DetailCard title={t('oms.creditNoteDetail.sections.facts')}>
            <div className={s.factGrid}>
              <Fact label={t('oms.creditNoteDetail.fields.customer')} value={customer} to={creditNote.customerId ? `/main/counterparties/${creditNote.customerId}` : null} />
              <Fact label={t('oms.creditNoteDetail.fields.invoice')} value={sourceInvoiceLabel} to={sourceInvoiceId ? `/main/oms/invoices/${sourceInvoiceId}` : null} />
              <Fact label={t('oms.creditNoteDetail.fields.order')} value={sourceOrderLabel} to={sourceOrderId ? `/main/oms/orders/${sourceOrderId}` : null} />
              <Fact label={t('oms.creditNoteDetail.fields.reason')} value={reasonLabel(creditNote.reason, t)} />
              <Fact label={t('oms.creditNoteDetail.fields.issueDate')} value={formatDate(creditNote.issuedAt || creditNote.createdAt, locale)} />
              <Fact label={t('oms.creditNoteDetail.fields.currency')} value={currency} />
              <Fact label={t('oms.creditNoteDetail.fields.owner')} value={creditNote.owner?.name || creditNote.sourceOrder?.owner?.name || '—'} />
            </div>
          </DetailCard>
        </aside>
      )}
      content={(
        <main className={s.content}>
          <div className={s.workspaceSurface}>
            <DetailTabs tabs={tabs} activeTab={activeTab} onActiveTabChange={setActiveTab} />
          </div>
        </main>
      )}
    />
  );
}

function CreditNoteCreateWorkspace() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { can } = useAclPermissions();
  const canRead = can('order:read');
  const canCreate = can('order:update');
  const invoiceIdHint = searchParams.get('invoiceId') || '';
  const orderIdHint = searchParams.get('orderId') || '';
  const customerIdHint = searchParams.get('customerId') || '';
  const [activeTab, setActiveTab] = useState('overview');
  const [initializedKey, setInitializedKey] = useState('');
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState({
    invoiceId: invoiceIdHint,
    orderId: orderIdHint,
    reason: t('oms.creditNoteDetail.create.defaultReason'),
    amountGross: '',
    issuedAt: todayInputValue(),
  });
  const [issueCreditNote, { isLoading: isSaving }] = useIssueCreditNoteFromInvoiceMutation();

  const effectiveInvoiceId = form.invoiceId || invoiceIdHint;
  const {
    data: sourceInvoice,
    isLoading: isInvoiceLoading,
    isFetching: isInvoiceFetching,
    isError: isInvoiceError,
    error: invoiceError,
  } = useGetInvoiceByIdQuery(effectiveInvoiceId, {
    skip: !effectiveInvoiceId,
    refetchOnMountOrArgChange: true,
  });

  const {
    data: invoicesData,
    isFetching: isInvoicesFetching,
  } = useListInvoicesQuery({ page: 1, limit: 100, sort: 'updatedAt', dir: 'DESC' }, {
    skip: !canRead || Boolean(invoiceIdHint),
  });

  const invoiceRows = useMemo(() => (Array.isArray(invoicesData?.items) ? invoicesData.items : []), [invoicesData]);
  const sourceOrderId = sourceInvoice?.order?.id || sourceInvoice?.orderId || form.orderId || orderIdHint;
  const currency = sourceInvoice?.currencyCode || sourceInvoice?.order?.currencyCode || 'PLN';
  const amountDue = asNumber(sourceInvoice?.amountDue, asNumber(sourceInvoice?.totalGross, 0));
  const amountGross = asNumber(form.amountGross, 0);
  const remainingAfter = Math.max(0, amountDue - amountGross);
  const onAccount = Math.max(0, amountGross - amountDue);
  const customer = customerName(sourceInvoice) || customerIdHint || t('oms.creditNoteDetail.noCustomer');
  const loading = isInvoiceLoading || isInvoiceFetching || isInvoicesFetching;

  useEffect(() => {
    const key = `${effectiveInvoiceId || 'no-invoice'}:${sourceInvoice?.id || 'pending'}`;
    if (initializedKey === key) return;
    if (effectiveInvoiceId && !sourceInvoice && (isInvoiceLoading || isInvoiceFetching)) return;
    const suggested = sourceInvoice ? amountDue || asNumber(sourceInvoice.totalGross, 0) : 0;
    setForm((prev) => ({
      ...prev,
      invoiceId: effectiveInvoiceId || prev.invoiceId,
      orderId: sourceOrderId || prev.orderId || '',
      amountGross: suggested > 0 ? toInputNumber(suggested) : prev.amountGross,
      issuedAt: prev.issuedAt || todayInputValue(),
    }));
    setInitializedKey(key);
  }, [amountDue, effectiveInvoiceId, initializedKey, isInvoiceFetching, isInvoiceLoading, sourceInvoice, sourceOrderId]);

  const setField = useCallback((field, value) => {
    setSaveError('');
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'invoiceId') {
        const selected = invoiceRows.find((invoice) => String(invoice.id) === String(value));
        if (selected?.orderId) next.orderId = selected.orderId;
        if (selected?.totalGross && !next.amountGross) next.amountGross = toInputNumber(asNumber(selected.amountDue, asNumber(selected.totalGross, 0)));
      }
      return next;
    });
  }, [invoiceRows]);

  const saveCreditNote = useCallback(async () => {
    const safeAmount = roundMoney(form.amountGross);
    if (!form.invoiceId) {
      setSaveError(t('oms.creditNoteDetail.errors.invoiceRequired'));
      return;
    }
    if (safeAmount <= 0) {
      setSaveError(t('oms.creditNoteDetail.errors.amountPositive'));
      return;
    }
    try {
      const created = await issueCreditNote({
        invoiceId: form.invoiceId,
        payload: {
          orderId: sourceOrderId || undefined,
          reason: form.reason || t('oms.creditNoteDetail.create.defaultReason'),
          amountGross: safeAmount,
          amountNet: safeAmount,
          amountTax: 0,
          issuedAt: form.issuedAt ? new Date(form.issuedAt).toISOString() : new Date().toISOString(),
        },
      }).unwrap();
      const createdId = created?.id || created?.creditNote?.id;
      navigate(createdId ? `/main/oms/credit-notes/${createdId}` : '/main/oms/invoices', { replace: true });
    } catch (err) {
      setSaveError(getActionError(err, t));
    }
  }, [form, issueCreditNote, navigate, sourceOrderId, t]);

  const canSave = canCreate && !isSaving && !loading && Boolean(form.invoiceId) && amountGross > 0;
  const invoiceLoadError = isInvoiceError
    ? invoiceError?.data?.message || invoiceError?.data?.error || invoiceError?.message || t('oms.creditNoteDetail.errors.invoiceLoadFailed')
    : '';

  const tabs = useMemo(() => [
    {
      key: 'overview',
      label: t('oms.creditNoteDetail.tabs.overview'),
      render: () => (
        <CreateOverviewTab
          t={t}
          locale={locale}
          form={form}
          setField={setField}
          invoiceRows={invoiceRows}
          sourceInvoice={sourceInvoice}
          currency={currency}
          amountDue={amountDue}
          amountGross={amountGross}
          remainingAfter={remainingAfter}
          onAccount={onAccount}
          showInvoiceSelect={!invoiceIdHint}
        />
      ),
    },
    {
      key: 'applications',
      label: t('oms.creditNoteDetail.tabs.applications'),
      count: sourceInvoice ? 1 : 0,
      render: () => (
        <DetailSection title={t('oms.creditNoteDetail.sections.applications')} subtitle={t('oms.creditNoteDetail.create.applyAfterSave')}>
          <div className={s.allocationEditor}>
            <div>
              <span>{t('oms.creditNoteDetail.fields.invoice')}</span>
              <strong>{sourceInvoice ? <Link to={`/main/oms/invoices/${sourceInvoice.id}`}>{invoiceNumber(sourceInvoice)}</Link> : '—'}</strong>
            </div>
            <div>
              <span>{t('oms.creditNoteDetail.applications.remainingDue')}</span>
              <strong>{formatMoney(amountDue, currency, locale)}</strong>
            </div>
            <div>
              <span>{t('oms.creditNoteDetail.fields.creditedAmount')}</span>
              <strong>{formatMoney(amountGross, currency, locale)}</strong>
            </div>
            <div>
              <span>{t('oms.creditNoteDetail.applications.onAccount')}</span>
              <strong>{formatMoney(onAccount, currency, locale)}</strong>
            </div>
          </div>
        </DetailSection>
      ),
    },
    {
      key: 'system',
      label: t('oms.creditNoteDetail.tabs.system'),
      render: () => (
        <DetailSection title={t('oms.creditNoteDetail.tabs.system')}>
          <div className={s.systemGrid}>
            <Fact label={t('oms.creditNoteDetail.fields.invoice')} value={form.invoiceId || '—'} />
            <Fact label={t('oms.creditNoteDetail.fields.order')} value={sourceOrderId || '—'} />
            <Fact label={t('oms.creditNoteDetail.fields.issueDate')} value={form.issuedAt || '—'} />
            <Fact label={t('oms.creditNoteDetail.fields.currency')} value={currency} />
          </div>
        </DetailSection>
      ),
    },
  ], [amountDue, amountGross, currency, form, invoiceIdHint, invoiceRows, locale, onAccount, remainingAfter, setField, sourceInvoice, sourceOrderId, t]);

  if (!canRead) return <div className={s.state}>{t('common.noPermission')}</div>;

  return (
    <DetailLayout
      mode="entity"
      className={s.creditNoteDetail}
      header={(
        <header className={s.headerWrap}>
          <div className={s.headerTop}>
            <button type="button" className={s.backBtn} onClick={() => navigate(-1)}>
              <ArrowLeft size={15} /> {t('oms.creditNoteDetail.title')}
            </button>
            <div className={s.headerMeta}>
              <span>{sourceInvoice?.number || t('oms.creditNoteDetail.create.eyebrow')}</span>
              <span>{t('statuses.issued')}</span>
            </div>
          </div>

          <div className={s.heroGrid}>
            <div className={s.heroMain}>
              <div className={s.heroIcon}>
                <RotateCcw size={26} />
              </div>
              <div className={s.heroText}>
                <span>{t('oms.creditNoteDetail.create.eyebrow')}</span>
                <h1>{t('oms.creditNoteDetail.create.title')}</h1>
                <p>{customer}</p>
              </div>
            </div>

            <div className={s.creditPanel}>
              <span>{t('oms.creditNoteDetail.create.suggestedAmount')}</span>
              <MoneyAmount value={amountGross || amountDue} currency={currency} locale={locale} size="md" />
              <div className={s.creditMeta}>
                {sourceInvoice ? <span>{sourceInvoice.number || sourceInvoice.id}</span> : null}
                <span>{t('oms.creditNoteDetail.applications.remainingDue')}: {formatMoney(amountDue, currency, locale)}</span>
              </div>
            </div>
          </div>

          <div className={s.vitalsGrid}>
            <Vital label={t('oms.creditNoteDetail.vitals.credited')} value={formatMoney(amountGross, currency, locale)} tone="warning" />
            <Vital label={t('oms.creditNoteDetail.applications.remainingDue')} value={formatMoney(amountDue, currency, locale)} />
            <Vital label={t('oms.creditNoteDetail.applications.onAccount')} value={formatMoney(onAccount, currency, locale)} tone={onAccount > 0 ? 'soft' : 'muted'} />
            <Vital label={t('oms.creditNoteDetail.vitals.status')} value={t('statuses.issued')} />
          </div>

          <div className={s.headerActions}>
            <div className={s.smartRow}>
              {sourceInvoice ? (
                <Link className={s.smartBtn} to={`/main/oms/invoices/${sourceInvoice.id}`}>
                  <ReceiptText size={14} /><span>{t('oms.creditNoteDetail.smart.invoice')}</span><strong>{sourceInvoice.number || sourceInvoice.id}</strong>
                </Link>
              ) : null}
              {sourceOrderId ? (
                <Link className={s.smartBtn} to={`/main/oms/orders/${sourceOrderId}`}>
                  <FileText size={14} /><span>{t('oms.creditNoteDetail.smart.order')}</span><strong>{sourceInvoice?.order?.number || sourceOrderId}</strong>
                </Link>
              ) : null}
            </div>
            <div className={s.actionRow}>
              <span className={s.nextAction}>{t('oms.creditNoteDetail.create.next')}</span>
              <button type="button" className={s.primaryBtn} disabled={!canSave} onClick={saveCreditNote}>
                <ReceiptText size={15} />
                {isSaving ? t('common.loading') : t('oms.creditNoteDetail.create.save')}
              </button>
            </div>
          </div>
          {invoiceLoadError || saveError ? <div className={s.errorBar}>{invoiceLoadError || saveError}</div> : null}
        </header>
      )}
      sidebar={(
        <aside className={s.sidebar}>
          <DetailCard title={t('oms.creditNoteDetail.sections.facts')}>
            <div className={s.factGrid}>
              <Fact label={t('oms.creditNoteDetail.fields.customer')} value={customer} to={customerIdHint ? `/main/counterparties/${customerIdHint}` : null} />
              <Fact label={t('oms.creditNoteDetail.fields.invoice')} value={invoiceNumber(sourceInvoice) || form.invoiceId || '—'} to={form.invoiceId ? `/main/oms/invoices/${form.invoiceId}` : null} />
              <Fact label={t('oms.creditNoteDetail.fields.order')} value={orderNumber(sourceInvoice?.order) || sourceOrderId || '—'} to={sourceOrderId ? `/main/oms/orders/${sourceOrderId}` : null} />
              <Fact label={t('oms.creditNoteDetail.fields.reason')} value={form.reason || t('oms.creditNoteDetail.noReason')} />
              <Fact label={t('oms.creditNoteDetail.fields.issueDate')} value={formatDate(form.issuedAt, locale)} />
              <Fact label={t('oms.creditNoteDetail.fields.currency')} value={currency} />
            </div>
          </DetailCard>
        </aside>
      )}
      content={(
        <main className={s.content}>
          <div className={s.workspaceSurface}>
            <DetailTabs tabs={tabs} activeTab={activeTab} onActiveTabChange={setActiveTab} />
          </div>
        </main>
      )}
    />
  );
}

function OverviewTab({ creditNote, sourceInvoice, currency, locale, nextAction, t }) {
  const amountGross = asNumber(creditNote?.amountGross ?? creditNote?.amount, 0);
  const appliedAmount = asNumber(creditNote?.appliedAmount, 0);
  const remainingCredit = asNumber(creditNote?.remainingCredit, Math.max(0, amountGross - appliedAmount));
  return (
    <div className={s.stack}>
      <div className={s.overviewGrid}>
        <Fact label={t('oms.creditNoteDetail.fields.creditedAmount')} value={formatMoney(amountGross, currency, locale)} />
        <Fact label={t('oms.creditNoteDetail.applications.applied')} value={formatMoney(appliedAmount, currency, locale)} />
        <Fact label={t('oms.creditNoteDetail.applications.remaining')} value={formatMoney(remainingCredit, currency, locale)} />
        <Fact label={t('oms.creditNoteDetail.fields.reason')} value={reasonLabel(creditNote?.reason, t)} />
        <Fact label={t('oms.creditNoteDetail.fields.status')} value={statusLabel(creditNote?.status, t)} />
        <Fact label={t('oms.invoiceDetail.overview.nextAction')} value={nextAction} />
      </div>
      <DetailSection title={t('oms.creditNoteDetail.sections.documentChain')}>
        <div className={s.chain}>
          {sourceInvoice || creditNote?.invoiceId ? (
            <Link to={`/main/oms/invoices/${sourceInvoice?.id || creditNote.invoiceId}`}>
              {t('oms.creditNoteDetail.smart.invoice')} · {invoiceNumber(sourceInvoice) || creditNote?.sourceInvoice?.number || creditNote?.invoiceId}
            </Link>
          ) : (
            <span>{t('oms.creditNoteDetail.empty.noInvoice')}</span>
          )}
          {creditNote?.orderId || creditNote?.sourceOrder?.id ? (
            <Link to={`/main/oms/orders/${creditNote.sourceOrder?.id || creditNote.orderId}`}>
              {t('oms.creditNoteDetail.smart.order')} · {creditNote?.sourceOrder?.number || creditNote?.orderId}
            </Link>
          ) : null}
        </div>
      </DetailSection>
    </div>
  );
}

function ApplicationsTab({
  t,
  locale,
  creditNote,
  sourceInvoice,
  applications,
  currency,
  applyAmount,
  setApplyAmount,
  refundAmount,
  setRefundAmount,
  refundMethod,
  setRefundMethod,
  refundReference,
  setRefundReference,
  canApply,
  canRefund,
}) {
  const remainingCredit = asNumber(creditNote?.remainingCredit, 0);
  const refundableAmount = asNumber(creditNote?.refundableAmount, remainingCredit);
  const methodOptions = ['bank_transfer', 'card', 'cash', 'other'];
  return (
    <div className={s.stack}>
      <DetailSection title={t('oms.creditNoteDetail.sections.applications')}>
        {applications.length ? (
          <div className={s.applicationRows}>
            {applications.map((application) => (
              <div key={application.id || application.invoiceId} className={s.applicationRow}>
                <div>
                  <strong>
                    {application.invoiceId ? (
                      <Link to={`/main/oms/invoices/${application.invoiceId}`}>
                        {application.invoiceNumber || application.invoiceId}
                      </Link>
                    ) : (
                      application.invoiceNumber || '—'
                    )}
                  </strong>
                  <span>{formatDateTime(application.allocatedAt || application.createdAt, locale)}</span>
                </div>
                <div>
                  <span>{t('oms.creditNoteDetail.applications.applied')}</span>
                  <strong>{formatMoney(application.amount, currency, locale)}</strong>
                </div>
                <div>
                  <span>{t('oms.creditNoteDetail.applications.remaining')}</span>
                  <strong>{formatMoney(remainingCredit, currency, locale)}</strong>
                </div>
                <div>
                  <span>{t('oms.creditNoteDetail.applications.scope')}</span>
                  <strong>{t('oms.creditNoteDetail.fields.invoice')}</strong>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>{t('oms.creditNoteDetail.empty.onAccount')}</EmptyState>
        )}
      </DetailSection>

      <DetailSection title={t('oms.creditNoteDetail.actions.apply')}>
        <div className={s.allocationEditor}>
          <div>
            <span>{t('oms.creditNoteDetail.fields.invoice')}</span>
            <strong>{sourceInvoice ? <Link to={`/main/oms/invoices/${sourceInvoice.id}`}>{invoiceNumber(sourceInvoice)}</Link> : creditNote?.invoiceId || '—'}</strong>
          </div>
          <div>
            <span>{t('oms.creditNoteDetail.applications.remainingDue')}</span>
            <strong>{formatMoney(sourceInvoice?.amountDue, currency, locale)}</strong>
          </div>
          <label>
            <span>{t('oms.creditNoteDetail.actions.applyAmount')}</span>
            <input type="number" min="0" step="0.01" disabled={!canApply} value={applyAmount} onChange={(event) => setApplyAmount(event.target.value)} />
          </label>
          <div className={s.onAccountBox}>
            <span>{t('oms.creditNoteDetail.applications.onAccount')}</span>
            <strong>{formatMoney(Math.max(0, remainingCredit - asNumber(applyAmount, 0)), currency, locale)}</strong>
          </div>
        </div>
      </DetailSection>

      <DetailSection title={t('oms.creditNoteDetail.actions.refund')}>
        <div className={s.refundEditor}>
          <Fact label={t('oms.creditNoteDetail.applications.refundable')} value={formatMoney(refundableAmount, currency, locale)} />
          <label>
            <span>{t('oms.creditNoteDetail.actions.refundAmount')}</span>
            <input type="number" min="0" step="0.01" disabled={!canRefund} value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} />
          </label>
          <label>
            <span>{t('oms.invoiceDetail.registerPayment.fields.method')}</span>
            <select disabled={!canRefund} value={refundMethod} onChange={(event) => setRefundMethod(event.target.value)}>
              {methodOptions.map((method) => <option key={method} value={method}>{t(`oms.paymentMethods.${method}`, method)}</option>)}
            </select>
          </label>
          <label>
            <span>{t('oms.invoiceDetail.registerPayment.fields.reference')}</span>
            <input disabled={!canRefund} value={refundReference} onChange={(event) => setRefundReference(event.target.value)} />
          </label>
        </div>
      </DetailSection>
    </div>
  );
}

function CreateOverviewTab({
  t,
  locale,
  form,
  setField,
  invoiceRows,
  sourceInvoice,
  currency,
  amountDue,
  amountGross,
  remainingAfter,
  onAccount,
  showInvoiceSelect,
}) {
  return (
    <div className={s.stack}>
      <DetailSection title={t('oms.creditNoteDetail.create.sections.credit')} subtitle={t('oms.creditNoteDetail.create.subtitle')}>
        <div className={s.createGrid}>
          <label className={s.amountField}>
            <span>{t('oms.creditNoteDetail.fields.creditedAmount')}</span>
            <div className={s.amountControl}>
              <input type="number" min="0" step="0.01" value={form.amountGross} onChange={(event) => setField('amountGross', event.target.value)} />
              <strong>{currency}</strong>
            </div>
          </label>

          <div className={s.formGrid}>
            {showInvoiceSelect ? (
              <label className={s.fullField}>
                <span>{t('oms.creditNoteDetail.create.selectInvoice')}</span>
                <select value={form.invoiceId} onChange={(event) => setField('invoiceId', event.target.value)}>
                  <option value="">{t('oms.creditNoteDetail.create.selectInvoice')}</option>
                  {invoiceRows.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>{invoice.number || invoice.id}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className={s.fullField}>
              <span>{t('oms.creditNoteDetail.fields.reason')}</span>
              <input value={form.reason} onChange={(event) => setField('reason', event.target.value)} />
            </label>
            <label>
              <span>{t('oms.creditNoteDetail.fields.issueDate')}</span>
              <input type="date" value={form.issuedAt} onChange={(event) => setField('issuedAt', event.target.value)} />
            </label>
            <label>
              <span>{t('oms.creditNoteDetail.fields.currency')}</span>
              <input value={currency} readOnly />
            </label>
          </div>
        </div>
      </DetailSection>

      <DetailSection title={t('oms.creditNoteDetail.sections.summary')}>
        <div className={s.createSummary}>
          <Fact label={t('oms.creditNoteDetail.fields.invoice')} value={invoiceNumber(sourceInvoice) || form.invoiceId || '—'} to={form.invoiceId ? `/main/oms/invoices/${form.invoiceId}` : null} />
          <Fact label={t('oms.creditNoteDetail.applications.remainingDue')} value={formatMoney(amountDue, currency, locale)} />
          <Fact label={t('oms.creditNoteDetail.fields.creditedAmount')} value={formatMoney(amountGross, currency, locale)} />
          <Fact label={t('oms.creditNoteDetail.applications.remainingDue')} value={formatMoney(remainingAfter, currency, locale)} />
          <Fact label={t('oms.creditNoteDetail.applications.onAccount')} value={formatMoney(onAccount, currency, locale)} />
        </div>
      </DetailSection>
    </div>
  );
}

function PreviewTab({ creditNote, sourceInvoice, currency, locale, t }) {
  const documentDto = buildCreditNoteDocumentDto({ creditNote, invoice: sourceInvoice, currency, locale });
  const [generatePdf, { isLoading, error }] = useGenerateCreditNotePdfMutation();
  const [sendDocument, sendState] = useSendCreditNoteDocumentMutation();
  const [createShare, createShareState] = useCreateDocumentShareMutation();
  const [revokeShare, revokeShareState] = useRevokeDocumentShareMutation();
  const { data: shares = [], isFetching: sharesLoading, error: sharesError } = useListDocumentSharesQuery(
    { entityType: 'credit_note', entityId: creditNote?.id },
    { skip: !creditNote?.id }
  );
  const [getSignedFileUrl] = useLazyGetSignedFileUrlQuery();
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const onGeneratePdf = async () => {
    if (!creditNote?.id) return;
    const result = await generatePdf({ id: creditNote.id, payload: { locale } }).unwrap();
    const fileId = result?.file?.id || result?.metadata?.fileId;
    if (!fileId) return;
    const signed = await getSignedFileUrl(fileId).unwrap();
    const url = signed?.data?.url || signed?.url;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const onSendDocument = async (payload) => {
    await sendDocument({ id: creditNote.id, payload }).unwrap();
    setDeliveryOpen(false);
  };

  const onCreateShare = async (payload) => {
    await createShare({ entityType: 'credit_note', entityId: creditNote.id, locale, ...payload }).unwrap();
  };

  const onRevokeShare = async (share) => {
    await revokeShare({ id: share.id, entityType: 'credit_note', entityId: creditNote.id }).unwrap();
  };

  return (
    <DetailSection title={t('oms.creditNoteDetail.tabs.preview')}>
      <div className={s.previewActions}>
        <button type="button" onClick={onGeneratePdf} disabled={!creditNote?.id || isLoading}>
          {isLoading ? t('oms.generatedDocuments.actions.generating') : t('oms.generatedDocuments.actions.generatePdf')}
        </button>
        <button type="button" onClick={() => setDeliveryOpen(true)} disabled={!creditNote?.id || sendState.isLoading}>
          {sendState.isLoading ? t('oms.documentDelivery.sending') : t('oms.documentDelivery.send')}
        </button>
        <button type="button" onClick={() => setShareOpen(true)} disabled={!creditNote?.id}>
          {t('oms.documentShare.share')}
        </button>
        {error ? <span>{t('oms.generatedDocuments.errors.generateFailed')}</span> : null}
      </div>
      <CustomerDocumentRenderer dto={documentDto} />
      <DocumentDeliveryDialog
        open={deliveryOpen}
        onClose={() => setDeliveryOpen(false)}
        onSend={onSendDocument}
        loading={sendState.isLoading}
        error={sendState.error}
        t={t}
        locale={locale}
        documentLabel={t('oms.documentDelivery.types.creditNote')}
        documentNumber={creditNote?.number}
        defaultRecipientEmail={creditNote?.contact?.email || creditNote?.sourceOrder?.contact?.email || ''}
      />
      <DocumentShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onCreate={onCreateShare}
        onRevoke={onRevokeShare}
        t={t}
        locale={locale}
        entityType="credit_note"
        entityId={creditNote?.id}
        documentLabel={t('oms.documentShare.types.creditNote')}
        documentNumber={creditNote?.number}
        shares={shares}
        loading={sharesLoading}
        creating={createShareState.isLoading}
        revoking={revokeShareState.isLoading}
        error={sharesError || createShareState.error || revokeShareState.error}
      />
    </DetailSection>
  );
}

function ActivityTab({ events, locale, currency, t }) {
  return (
    <DetailSection title={t('oms.creditNoteDetail.tabs.activity')}>
      {events.length ? (
        <div className={s.timeline}>
          {events.map((event, index) => (
            <div key={`${event.type}-${event.at}-${index}`} className={s.timelineRow}>
              <span className={s.timelineDot} />
              <div>
                <strong>{t(`oms.creditNoteDetail.activity.${event.type}`, event.type)}</strong>
                <span>
                  {formatDateTime(event.at, locale)}
                  {event.amount ? ` · ${formatMoney(event.amount, currency, locale)}` : ''}
                  {event.invoiceNumber ? ` · ${event.invoiceNumber}` : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState>{t('oms.creditNoteDetail.activity.empty')}</EmptyState>
      )}
    </DetailSection>
  );
}

function SystemTab({ creditNote, locale, t }) {
  return (
    <DetailSection title={t('oms.creditNoteDetail.tabs.system')}>
      <div className={s.systemGrid}>
        <Fact label={t('oms.detailLabels.number')} value={creditNote?.number || '—'} />
        <Fact label={t('oms.detailLabels.status')} value={statusLabel(creditNote?.status, t)} />
        <Fact label="ID" value={creditNote?.id || '—'} />
        <Fact label={t('oms.creditNoteDetail.fields.invoice')} value={creditNote?.invoiceId || '—'} />
        <Fact label={t('oms.creditNoteDetail.fields.order')} value={creditNote?.orderId || '—'} />
        <Fact label={t('oms.detailLabels.createdAt')} value={formatDateTime(creditNote?.createdAt, locale)} />
        <Fact label={t('oms.detailLabels.updatedAt')} value={formatDateTime(creditNote?.updatedAt, locale)} />
      </div>
    </DetailSection>
  );
}
