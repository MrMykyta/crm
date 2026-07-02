import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  FileText,
  Landmark,
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
import useAclPermissions from '../../../../hooks/useAclPermissions';
import {
  useGetOrderByIdQuery,
  useLazyGetOrderByIdQuery,
  useListOrdersQuery,
} from '../../../../store/rtk/ordersApi';
import { useGetInvoiceByIdQuery, useLazyGetInvoiceByIdQuery } from '../../../../store/rtk/invoicesApi';
import { useCreatePaymentMutation } from '../../../../store/rtk/paymentsApi';
import { paymentMethodLabel } from '../../../../components/oms/paymentLabels';
import s from './PaymentDetailPage.module.css';

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function asNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function toInputNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return String(Number(number.toFixed(2)));
}

function clampMoney(value, min = 0, max = Number.POSITIVE_INFINITY) {
  const parsed = asNumber(value, 0);
  return Math.min(Math.max(parsed, min), max);
}

function customerName(order) {
  const counterparty = order?.counterparty || order?.customer;
  return counterparty?.shortName || counterparty?.fullName || counterparty?.name || order?.customerName || '';
}

function ownerName(user) {
  if (!user) return '';
  return user.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || '';
}

function statusLabel(status, t) {
  const key = asText(status).toLowerCase();
  if (!key) return '—';
  return t(`statuses.${key}`, key);
}

function directionLabel(direction, t) {
  const key = asText(direction || 'inbound').toLowerCase();
  return t(`oms.paymentDetail.directions.${key}`, key);
}

function applicationStatus(payment, t) {
  const amount = asNumber(payment?.amount, 0);
  const allocated = asNumber(payment?.allocatedAmount, 0);
  if (amount <= 0 || allocated <= 0) return t('oms.paymentDetail.applicationStates.unapplied');
  if (allocated >= amount) return t('oms.paymentDetail.applicationStates.fullyApplied');
  return t('oms.paymentDetail.applicationStates.partiallyApplied');
}

function paymentTone(payment) {
  const status = asText(payment?.status).toLowerCase();
  const direction = asText(payment?.direction || 'inbound').toLowerCase();
  if (status === 'failed') return 'danger';
  if (direction === 'refund' || status === 'refunded') return 'warning';
  if (status === 'paid' && asNumber(payment?.unappliedAmount, 0) <= 0) return 'ok';
  if (status === 'paid') return 'soft';
  return 'muted';
}

function normalizePayment(payment, order) {
  if (!payment?.id) return null;
  const currency = payment.currencyCode || payment.currency || order?.currencyCode || order?.currency || 'PLN';
  return {
    ...payment,
    order,
    orderId: order?.id || payment.orderId || null,
    customerName: customerName(order),
    currency,
    currencyCode: currency,
    allocatedAmount: asNumber(payment.allocatedAmount, 0),
    unappliedAmount: asNumber(payment.unappliedAmount, Math.max(0, asNumber(payment.amount, 0) - asNumber(payment.allocatedAmount, 0))),
    applications: Array.isArray(payment.applications) ? payment.applications : [],
  };
}

function findPaymentInOrder(order, paymentId) {
  const payments = Array.isArray(order?.payments) ? order.payments : [];
  const payment = payments.find((row) => String(row?.id) === String(paymentId));
  return normalizePayment(payment, order);
}

function buildTimeline(payment, t, locale) {
  return [
    payment?.createdAt ? {
      id: 'created',
      title: t('oms.paymentDetail.activity.created'),
      meta: formatDateTime(payment.createdAt, locale),
    } : null,
    payment?.processedAt || payment?.paidAt ? {
      id: 'processed',
      title: t('oms.paymentDetail.activity.processed'),
      meta: formatDateTime(payment.processedAt || payment.paidAt, locale),
    } : null,
    ...(Array.isArray(payment?.applications) ? payment.applications.map((application) => ({
      id: `application-${application.id || application.invoiceId}`,
      title: t('oms.paymentDetail.activity.applied'),
      meta: `${formatMoney(application.amount, payment.currencyCode, locale)} · ${formatDateTime(application.allocatedAt, locale)}`,
    })) : []),
  ].filter(Boolean);
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

function EmptyState({ children }) {
  return <div className={s.empty}>{children}</div>;
}

function getPaymentError(err, t) {
  return err?.data?.message || err?.data?.error || err?.message || t('oms.paymentDetail.errors.saveFailed');
}

export default function PaymentDetailPage({ createMode = false }) {
  const { id } = useParams();
  if (createMode || id === 'new') return <PaymentCreateWorkspace />;
  return <PaymentReadWorkspace paymentId={id} />;
}

function PaymentReadWorkspace({ paymentId }) {
  const [searchParams] = useSearchParams();
  const orderIdHint = searchParams.get('orderId') || '';
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { can } = useAclPermissions();
  const canReadOrders = can('order:read');
  const [activeTab, setActiveTab] = useState('overview');
  const [scannedOrder, setScannedOrder] = useState(null);
  const [scanComplete, setScanComplete] = useState(false);
  const [invoiceDetailsById, setInvoiceDetailsById] = useState({});
  const [triggerOrderDetail, { isFetching: isScanning }] = useLazyGetOrderByIdQuery();
  const [triggerInvoiceDetail] = useLazyGetInvoiceByIdQuery();

  const {
    data: hintedOrder,
    isLoading: isHintLoading,
    isFetching: isHintFetching,
    isError: isHintError,
    error: hintError,
  } = useGetOrderByIdQuery(orderIdHint, {
    skip: !canReadOrders || !orderIdHint,
    refetchOnMountOrArgChange: true,
  });

  const {
    data: ordersData,
    isFetching: isOrdersFetching,
  } = useListOrdersQuery({ page: 1, limit: 100, sort: 'updatedAt', dir: 'DESC' }, {
    skip: !canReadOrders || Boolean(orderIdHint),
  });

  const candidateOrder = hintedOrder || scannedOrder;
  const payment = useMemo(() => findPaymentInOrder(candidateOrder, paymentId), [candidateOrder, paymentId]);
  const currency = payment?.currencyCode || payment?.currency || candidateOrder?.currencyCode || 'PLN';
  const applications = useMemo(
    () => (Array.isArray(payment?.applications) ? payment.applications : []),
    [payment]
  );
  const tone = paymentTone(payment);
  const availableActions = useMemo(() => payment?.availableActions || {}, [payment]);
  const nextAction = useMemo(() => {
    if (!payment) return '';
    if (Object.keys(availableActions).length) return t('oms.paymentDetail.next.available');
    if (asNumber(payment.unappliedAmount, 0) > 0) return t('oms.paymentDetail.next.onAccount');
    return t('oms.paymentDetail.next.monitor');
  }, [availableActions, payment, t]);

  useEffect(() => {
    if (!canReadOrders || orderIdHint || payment || isOrdersFetching) return;
    const rows = Array.isArray(ordersData?.items) ? ordersData.items : [];
    if (!rows.length) {
      setScanComplete(true);
      return;
    }
    let active = true;
    setScanComplete(false);
    (async () => {
      for (const order of rows) {
        if (!active || !order?.id) return;
        try {
          const detail = await triggerOrderDetail(order.id, true).unwrap();
          if (findPaymentInOrder(detail, paymentId)) {
            if (active) setScannedOrder(detail);
            return;
          }
        } catch {
          // Keep scanning; a single inaccessible order must not break direct payment deep links.
        }
      }
      if (active) setScanComplete(true);
    })();
    return () => {
      active = false;
    };
  }, [canReadOrders, paymentId, isOrdersFetching, orderIdHint, ordersData, payment, triggerOrderDetail]);

  useEffect(() => {
    if (!applications.length) return;
    let active = true;
    const missingIds = [...new Set(applications.map((application) => application.invoiceId).filter(Boolean))]
      .filter((invoiceId) => !invoiceDetailsById[invoiceId]);
    if (!missingIds.length) return;

    Promise.allSettled(missingIds.map((invoiceId) => triggerInvoiceDetail(invoiceId, true).unwrap()))
      .then((results) => {
        if (!active) return;
        setInvoiceDetailsById((prev) => {
          const next = { ...prev };
          results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value?.id) {
              next[result.value.id] = result.value;
            }
          });
          return next;
        });
      });

    return () => {
      active = false;
    };
  }, [applications, invoiceDetailsById, triggerInvoiceDetail]);

  const smartButtons = useMemo(() => {
    const invoiceIds = [...new Set(applications.map((application) => application.invoiceId).filter(Boolean))];
    const creditNotes = Array.isArray(candidateOrder?.creditNotes) ? candidateOrder.creditNotes : [];
    return [
      invoiceIds.length ? {
        key: 'invoices',
        label: t('oms.paymentDetail.smart.invoices'),
        value: String(invoiceIds.length),
        onClick: () => setActiveTab('applications'),
        icon: <ReceiptText size={14} />,
      } : null,
      payment?.orderId ? {
        key: 'order',
        label: t('oms.paymentDetail.smart.order'),
        value: candidateOrder?.number || t('oms.paymentDetail.smart.open'),
        to: `/main/oms/orders/${payment.orderId}`,
        icon: <FileText size={14} />,
      } : null,
      candidateOrder?.counterparty?.id ? {
        key: 'customer',
        label: t('oms.paymentDetail.smart.customer'),
        value: payment?.customerName || t('oms.paymentDetail.smart.open'),
        to: `/main/counterparties/${candidateOrder.counterparty.id}`,
        icon: <UserRound size={14} />,
      } : null,
      creditNotes.length ? {
        key: 'credit-notes',
        label: t('oms.paymentDetail.smart.creditNotes'),
        value: String(creditNotes.length),
        to: payment?.orderId ? `/main/oms/orders/${payment.orderId}` : null,
        icon: <RotateCcw size={14} />,
      } : null,
    ].filter(Boolean);
  }, [applications, candidateOrder, payment, t]);

  const tabs = useMemo(() => [
    {
      key: 'overview',
      label: t('oms.paymentDetail.tabs.overview'),
      render: () => <OverviewTab payment={payment} order={candidateOrder} locale={locale} currency={currency} t={t} />,
    },
    {
      key: 'applications',
      label: t('oms.paymentDetail.tabs.applications'),
      count: applications.length,
      render: () => <ApplicationsTab payment={payment} applications={applications} invoiceDetailsById={invoiceDetailsById} locale={locale} currency={currency} t={t} />,
    },
    {
      key: 'activity',
      label: t('oms.paymentDetail.tabs.activity'),
      render: () => <ActivityTab payment={payment} locale={locale} t={t} />,
    },
    {
      key: 'notes',
      label: t('oms.paymentDetail.tabs.notes'),
      render: () => <NotesTab t={t} />,
    },
    {
      key: 'system',
      label: t('oms.paymentDetail.tabs.system'),
      render: () => <SystemTab payment={payment} order={candidateOrder} locale={locale} t={t} />,
    },
  ], [applications, candidateOrder, currency, invoiceDetailsById, locale, payment, t]);

  if (!canReadOrders) {
    return <div className={s.state}>{t('common.noPermission')}</div>;
  }
  if (isHintLoading || (isHintFetching && !payment) || isOrdersFetching || isScanning) {
    return <div className={s.state}>{t('common.loading')}</div>;
  }
  if (isHintError) {
    const message = hintError?.data?.message || hintError?.data?.error || hintError?.message || t('oms.paymentDetail.errors.loadFailed');
    return <div className={s.state}>{message}</div>;
  }
  if (!payment && scanComplete) {
    return <div className={s.state}>{t('oms.paymentDetail.errors.notFound')}</div>;
  }
  if (!payment) {
    return <div className={s.state}>{t('common.loading')}</div>;
  }

  return (
    <DetailLayout
      mode="entity"
      className={s.paymentDetail}
      header={(
        <header className={s.headerWrap}>
          <div className={s.headerTop}>
            <button type="button" className={s.backBtn} onClick={() => navigate('/main/oms/payments')}>
              <ArrowLeft size={15} /> {t('oms.payments.title')}
            </button>
            <div className={s.headerMeta}>
              <span>{payment.reference || payment.id}</span>
              <span className={s[`toneText_${tone}`] || ''}>{statusLabel(payment.status, t)}</span>
            </div>
          </div>

          <div className={s.heroGrid}>
            <div className={s.heroMain}>
              <div className={`${s.heroIcon} ${s[`heroIcon_${tone}`] || ''}`}>
                {payment.direction === 'refund' ? <RotateCcw size={26} /> : <Landmark size={26} />}
              </div>
              <div className={s.heroText}>
                <span>{t('oms.paymentDetail.hero.eyebrow')} · {directionLabel(payment.direction, t)}</span>
                <h1><MoneyAmount value={payment.amount} currency={currency} locale={locale} size="hero" /></h1>
                <p>
                  {payment.reference || paymentMethodLabel(payment.method, t) || payment.id}
                  {' · '}
                  {formatDate(payment.processedAt || payment.paidAt || payment.createdAt, locale)}
                </p>
              </div>
            </div>

            <div className={`${s.moneyPanel} ${s[`moneyPanel_${tone}`] || ''}`}>
              <span>{t('oms.paymentDetail.hero.applicationStatus')}</span>
              <strong>{applicationStatus(payment, t)}</strong>
              <div className={s.moneyMeta}>
                <span>{statusLabel(payment.status, t)}</span>
                <span>{directionLabel(payment.direction, t)}</span>
                <span>{formatDateTime(payment.processedAt || payment.paidAt || payment.createdAt, locale)}</span>
              </div>
            </div>
          </div>

          <div className={s.vitalsGrid}>
            <Vital label={t('oms.paymentDetail.vitals.allocated')} value={formatMoney(payment.allocatedAmount, currency, locale)} tone="ok" />
            <Vital label={t('oms.paymentDetail.vitals.unapplied')} value={formatMoney(payment.unappliedAmount, currency, locale)} tone={payment.unappliedAmount > 0 ? 'warning' : 'muted'} />
            <Vital label={t('oms.paymentDetail.vitals.direction')} value={directionLabel(payment.direction, t)} />
            <Vital label={t('oms.paymentDetail.vitals.status')} value={statusLabel(payment.status, t)} tone={tone} />
          </div>

          <div className={s.headerActions}>
            <div className={s.smartRow}>
              {smartButtons.map((button) => (
                button.to ? (
                  <Link key={button.key} className={s.smartBtn} to={button.to}>
                    {button.icon}<span>{button.label}</span>{button.value ? <strong>{button.value}</strong> : null}
                  </Link>
                ) : (
                  <button key={button.key} type="button" className={s.smartBtn} onClick={button.onClick}>
                    {button.icon}<span>{button.label}</span>{button.value ? <strong>{button.value}</strong> : null}
                  </button>
                )
              ))}
            </div>
            <span className={s.nextAction}>{nextAction}</span>
          </div>
        </header>
      )}
      sidebar={(
        <aside className={s.sidebar}>
          <DetailCard title={t('oms.paymentDetail.sections.moneyFacts')}>
            <div className={s.factGrid}>
              <Fact label={t('oms.paymentDetail.fields.customer')} value={payment.customerName || t('oms.paymentDetail.noCustomer')} to={candidateOrder?.counterparty?.id ? `/main/counterparties/${candidateOrder.counterparty.id}` : null} />
              <Fact label={t('oms.paymentDetail.fields.reference')} value={payment.reference || payment.id} />
              <Fact label={t('oms.paymentDetail.fields.method')} value={paymentMethodLabel(payment.method, t)} />
              <Fact label={t('oms.paymentDetail.fields.currency')} value={currency} />
              <Fact label={t('oms.paymentDetail.fields.direction')} value={directionLabel(payment.direction, t)} />
              <Fact label={t('oms.paymentDetail.fields.created')} value={formatDateTime(payment.createdAt, locale)} />
              <Fact label={t('oms.paymentDetail.fields.owner')} value={ownerName(candidateOrder?.owner) || '—'} />
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

function PaymentCreateWorkspace() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { can } = useAclPermissions();
  const canReadOrders = can('order:read');
  const canCreatePayment = can('order:update') || can('order:convert');
  const invoiceIdHint = searchParams.get('invoiceId') || '';
  const orderIdHint = searchParams.get('orderId') || '';
  const customerIdHint = searchParams.get('customerId') || '';
  const [activeTab, setActiveTab] = useState('overview');
  const [initializedKey, setInitializedKey] = useState('');
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState({
    orderId: orderIdHint,
    amount: '',
    applyAmount: '',
    method: 'bank_transfer',
    reference: '',
    date: todayInputValue(),
    direction: 'inbound',
    currencyCode: 'PLN',
  });
  const [createPayment, { isLoading: isSaving }] = useCreatePaymentMutation();

  const {
    data: sourceInvoice,
    isLoading: isInvoiceLoading,
    isFetching: isInvoiceFetching,
    isError: isInvoiceError,
    error: invoiceError,
  } = useGetInvoiceByIdQuery(invoiceIdHint, {
    skip: !invoiceIdHint,
    refetchOnMountOrArgChange: true,
  });

  const invoiceOrderId = sourceInvoice?.order?.id || sourceInvoice?.orderId || '';
  const effectiveOrderId = form.orderId || orderIdHint || invoiceOrderId;
  const {
    data: hintedOrder,
    isLoading: isOrderLoading,
    isFetching: isOrderFetching,
  } = useGetOrderByIdQuery(effectiveOrderId, {
    skip: !canReadOrders || !effectiveOrderId,
    refetchOnMountOrArgChange: true,
  });

  const {
    data: ordersData,
  } = useListOrdersQuery({ page: 1, limit: 100, sort: 'updatedAt', dir: 'DESC' }, {
    skip: !canReadOrders || Boolean(orderIdHint || invoiceOrderId),
  });

  const sourceOrder = sourceInvoice?.order || hintedOrder || null;
  const currency = form.currencyCode || sourceInvoice?.currencyCode || sourceOrder?.currencyCode || 'PLN';
  const amountDue = invoiceIdHint ? asNumber(sourceInvoice?.amountDue, asNumber(sourceInvoice?.totalGross, 0)) : 0;
  const amount = asNumber(form.amount, 0);
  const applyAmount = form.direction === 'refund'
    ? 0
    : clampMoney(form.applyAmount, 0, Math.min(Math.max(0, amountDue), Math.max(0, amount)));
  const remainingAfter = Math.max(0, amountDue - applyAmount);
  const onAccount = Math.max(0, amount - applyAmount);
  const applicationState = amount <= 0
    ? t('oms.paymentDetail.create.result.empty')
    : invoiceIdHint && remainingAfter > 0
      ? t('oms.paymentDetail.create.result.partial')
      : invoiceIdHint
        ? t('oms.paymentDetail.create.result.paid')
        : t('oms.paymentDetail.create.result.onAccount');
  const customer = customerName(sourceOrder) || customerIdHint || t('oms.paymentDetail.noCustomer');
  const orderRows = useMemo(() => (Array.isArray(ordersData?.items) ? ordersData.items : []), [ordersData]);
  const loading = isInvoiceLoading || isInvoiceFetching || isOrderLoading || isOrderFetching;

  useEffect(() => {
    const key = `${invoiceIdHint || 'no-invoice'}:${invoiceOrderId || orderIdHint || 'no-order'}`;
    if (initializedKey === key) return;
    if (invoiceIdHint && !sourceInvoice && (isInvoiceLoading || isInvoiceFetching)) return;
    if ((invoiceOrderId || orderIdHint) && !sourceOrder && (isOrderLoading || isOrderFetching)) return;
    const suggestedAmount = invoiceIdHint ? Math.max(0, amountDue) : 0;
    setForm((prev) => ({
      ...prev,
      orderId: invoiceOrderId || orderIdHint || prev.orderId || '',
      amount: suggestedAmount > 0 ? toInputNumber(suggestedAmount) : prev.amount,
      applyAmount: suggestedAmount > 0 ? toInputNumber(suggestedAmount) : prev.applyAmount,
      method: sourceInvoice?.paymentMethod || sourceOrder?.paymentMethod || prev.method || 'bank_transfer',
      reference: sourceInvoice?.number || sourceOrder?.number || prev.reference || '',
      currencyCode: sourceInvoice?.currencyCode || sourceOrder?.currencyCode || prev.currencyCode || 'PLN',
      direction: 'inbound',
      date: prev.date || todayInputValue(),
    }));
    setInitializedKey(key);
  }, [
    amountDue,
    initializedKey,
    invoiceIdHint,
    invoiceOrderId,
    isInvoiceFetching,
    isInvoiceLoading,
    isOrderFetching,
    isOrderLoading,
    orderIdHint,
    sourceInvoice,
    sourceOrder,
  ]);

  const setField = useCallback((field, value) => {
    setSaveError('');
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'amount') {
        const nextAmount = asNumber(value, 0);
        next.applyAmount = toInputNumber(Math.min(Math.max(0, amountDue), Math.max(0, nextAmount)));
      }
      if (field === 'direction' && value === 'refund') {
        next.applyAmount = '0';
      }
      if (field === 'direction' && value === 'inbound') {
        const nextAmount = asNumber(next.amount, 0);
        next.applyAmount = toInputNumber(Math.min(Math.max(0, amountDue), Math.max(0, nextAmount)));
      }
      if (field === 'orderId') {
        const selectedOrder = orderRows.find((order) => String(order.id) === String(value));
        if (selectedOrder?.currencyCode) next.currencyCode = selectedOrder.currencyCode;
        if (!next.reference && selectedOrder?.number) next.reference = selectedOrder.number;
      }
      return next;
    });
  }, [amountDue, orderRows]);

  const savePayment = useCallback(async () => {
    const safeAmount = asNumber(form.amount, 0);
    const rawApply = asNumber(form.applyAmount, 0);
    if (!form.orderId) {
      setSaveError(t('oms.paymentDetail.create.errors.orderRequired'));
      return;
    }
    if (safeAmount <= 0) {
      setSaveError(t('oms.invoiceDetail.registerPayment.errors.amountPositive'));
      return;
    }
    if (form.direction === 'refund' && rawApply > 0) {
      setSaveError(t('oms.invoiceDetail.registerPayment.errors.refundAllocation'));
      return;
    }
    if (rawApply < 0) {
      setSaveError(t('oms.invoiceDetail.registerPayment.errors.applyPositive'));
      return;
    }
    if (invoiceIdHint && rawApply > amountDue) {
      setSaveError(t('oms.invoiceDetail.registerPayment.errors.overRemaining'));
      return;
    }
    if (rawApply > safeAmount) {
      setSaveError(t('oms.invoiceDetail.registerPayment.errors.overPayment'));
      return;
    }

    const safeApply = form.direction === 'inbound' && invoiceIdHint
      ? clampMoney(rawApply, 0, Math.min(amountDue, safeAmount))
      : 0;
    const payload = {
      orderId: form.orderId,
      invoiceId: invoiceIdHint || undefined,
      amount: safeAmount,
      method: form.method,
      status: 'paid',
      direction: form.direction,
      currencyCode: form.currencyCode || currency,
      reference: form.reference || undefined,
      processedAt: form.date ? new Date(form.date).toISOString() : new Date().toISOString(),
      applications: invoiceIdHint && safeApply > 0
        ? [{ invoiceId: invoiceIdHint, amount: safeApply }]
        : [],
    };

    try {
      const created = await createPayment(payload).unwrap();
      if (created?.id) {
        navigate(`/main/oms/payments/${created.id}?orderId=${encodeURIComponent(form.orderId)}`, { replace: true });
      } else {
        navigate('/main/oms/payments', { replace: true });
      }
    } catch (err) {
      setSaveError(getPaymentError(err, t));
    }
  }, [amountDue, createPayment, currency, form, invoiceIdHint, navigate, t]);

  const canSave = canCreatePayment && !isSaving && !loading && amount > 0 && Boolean(form.orderId)
    && applyAmount >= 0 && applyAmount <= amount && applyAmount <= amountDue;
  const invoiceLoadError = isInvoiceError
    ? invoiceError?.data?.message || invoiceError?.data?.error || invoiceError?.message || t('oms.paymentDetail.errors.invoiceLoadFailed')
    : '';

  const tabs = useMemo(() => [
    {
      key: 'overview',
      label: t('oms.paymentDetail.tabs.overview'),
      render: () => (
        <PaymentCreateOverview
          t={t}
          locale={locale}
          form={form}
          setField={setField}
          orderRows={orderRows}
          sourceInvoice={sourceInvoice}
          sourceOrder={sourceOrder}
          currency={currency}
          amountDue={amountDue}
          amount={amount}
          applyAmount={applyAmount}
          remainingAfter={remainingAfter}
          onAccount={onAccount}
          applicationState={applicationState}
          showOrderSelect={!orderIdHint && !invoiceOrderId}
        />
      ),
    },
    {
      key: 'applications',
      label: t('oms.paymentDetail.tabs.applications'),
      count: invoiceIdHint ? 1 : 0,
      render: () => (
        <PaymentCreateApplications
          t={t}
          locale={locale}
          form={form}
          setField={setField}
          sourceInvoice={sourceInvoice}
          currency={currency}
          amountDue={amountDue}
          applyAmount={applyAmount}
          remainingAfter={remainingAfter}
          onAccount={onAccount}
        />
      ),
    },
    {
      key: 'notes',
      label: t('oms.paymentDetail.tabs.notes'),
      render: () => <NotesTab t={t} />,
    },
    {
      key: 'system',
      label: t('oms.paymentDetail.tabs.system'),
      render: () => (
        <div className={s.systemGrid}>
          <Fact label={t('oms.paymentDetail.system.orderId')} value={form.orderId || '—'} />
          <Fact label={t('oms.paymentDetail.system.reference')} value={form.reference || '—'} />
          <Fact label={t('oms.paymentDetail.system.applicationCount')} value={invoiceIdHint && applyAmount > 0 ? '1' : '0'} />
          <Fact label={t('oms.paymentDetail.system.processedAt')} value={form.date || '—'} />
        </div>
      ),
    },
  ], [
    amount,
    amountDue,
    applicationState,
    applyAmount,
    currency,
    form,
    invoiceIdHint,
    invoiceOrderId,
    locale,
    onAccount,
    orderIdHint,
    orderRows,
    remainingAfter,
    setField,
    sourceInvoice,
    sourceOrder,
    t,
  ]);

  if (!canReadOrders) {
    return <div className={s.state}>{t('common.noPermission')}</div>;
  }

  return (
    <DetailLayout
      mode="entity"
      className={s.paymentDetail}
      header={(
        <header className={s.headerWrap}>
          <div className={s.headerTop}>
            <button type="button" className={s.backBtn} onClick={() => navigate(-1)}>
              <ArrowLeft size={15} /> {t('oms.payments.title')}
            </button>
            <div className={s.headerMeta}>
              <span>{sourceInvoice?.number || sourceOrder?.number || t('oms.paymentDetail.create.eyebrow')}</span>
              <span>{directionLabel(form.direction, t)}</span>
            </div>
          </div>

          <div className={s.heroGrid}>
            <div className={s.heroMain}>
              <div className={s.heroIcon}>
                <Landmark size={26} />
              </div>
              <div className={s.heroText}>
                <span>{t('oms.paymentDetail.create.eyebrow')}</span>
                <h1>{t('oms.paymentDetail.create.title')}</h1>
                <p>{customer}</p>
              </div>
            </div>

            <div className={s.moneyPanel}>
              <span>{t('oms.paymentDetail.create.suggestedAmount')}</span>
              <MoneyAmount value={amount || amountDue} currency={currency} locale={locale} size="md" />
              <div className={s.moneyMeta}>
                {sourceInvoice ? <span>{sourceInvoice.number || sourceInvoice.id}</span> : null}
                {amountDue > 0 ? <span>{t('oms.paymentDetail.create.amountDue')}: {formatMoney(amountDue, currency, locale)}</span> : null}
                <span>{directionLabel(form.direction, t)}</span>
              </div>
            </div>
          </div>

          <div className={s.vitalsGrid}>
            <Vital label={t('oms.paymentDetail.create.amountDue')} value={formatMoney(amountDue, currency, locale)} />
            <Vital label={t('oms.paymentDetail.create.applyToInvoice')} value={formatMoney(applyAmount, currency, locale)} tone="ok" />
            <Vital label={t('oms.paymentDetail.create.dueAfter')} value={formatMoney(remainingAfter, currency, locale)} tone={remainingAfter > 0 ? 'warning' : 'ok'} />
            <Vital label={t('oms.paymentDetail.create.onAccount')} value={formatMoney(onAccount, currency, locale)} tone={onAccount > 0 ? 'soft' : 'muted'} />
          </div>

          <div className={s.headerActions}>
            <div className={s.smartRow}>
              {sourceInvoice ? (
                <Link className={s.smartBtn} to={`/main/oms/invoices/${sourceInvoice.id}`}>
                  <ReceiptText size={14} /><span>{t('oms.paymentDetail.smart.invoice')}</span><strong>{sourceInvoice.number || sourceInvoice.id}</strong>
                </Link>
              ) : null}
              {form.orderId ? (
                <Link className={s.smartBtn} to={`/main/oms/orders/${form.orderId}`}>
                  <FileText size={14} /><span>{t('oms.paymentDetail.smart.order')}</span><strong>{sourceOrder?.number || form.orderId}</strong>
                </Link>
              ) : null}
            </div>
            <div className={s.actionRow}>
              <span className={s.nextAction}>{applicationState}</span>
              <button type="button" className={s.primaryBtn} disabled={!canSave} onClick={savePayment}>
                <ReceiptText size={15} />
                {isSaving ? t('common.loading') : t('oms.paymentDetail.create.save')}
              </button>
            </div>
          </div>
          {invoiceLoadError || saveError ? <div className={s.errorBar}>{invoiceLoadError || saveError}</div> : null}
        </header>
      )}
      sidebar={(
        <aside className={s.sidebar}>
          <DetailCard title={t('oms.paymentDetail.sections.moneyFacts')}>
            <div className={s.factGrid}>
              <Fact label={t('oms.paymentDetail.fields.customer')} value={customer} to={customerIdHint ? `/main/counterparties/${customerIdHint}` : null} />
              <Fact label={t('oms.paymentDetail.smart.invoice')} value={sourceInvoice?.number || sourceInvoice?.id || '—'} to={sourceInvoice?.id ? `/main/oms/invoices/${sourceInvoice.id}` : null} />
              <Fact label={t('oms.paymentDetail.smart.order')} value={sourceOrder?.number || form.orderId || '—'} to={form.orderId ? `/main/oms/orders/${form.orderId}` : null} />
              <Fact label={t('oms.paymentDetail.fields.currency')} value={currency} />
              <Fact label={t('oms.paymentDetail.fields.direction')} value={directionLabel(form.direction, t)} />
              <Fact label={t('oms.paymentDetail.fields.reference')} value={form.reference || '—'} />
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

function PaymentCreateOverview({
  t,
  locale,
  form,
  setField,
  orderRows,
  sourceInvoice,
  sourceOrder,
  currency,
  amountDue,
  amount,
  applyAmount,
  remainingAfter,
  onAccount,
  applicationState,
  showOrderSelect,
}) {
  const methodOptions = ['bank_transfer', 'card', 'cash', 'cod', 'paypal', 'stripe', 'other'];
  return (
    <div className={s.stack}>
      <DetailSection title={t('oms.paymentDetail.create.sections.moneyEvent')} subtitle={applicationState}>
        <div className={s.createGrid}>
          <label className={s.amountField}>
            <span>{t('oms.invoiceDetail.registerPayment.fields.amount')}</span>
            <div className={s.amountControl}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) => setField('amount', event.target.value)}
              />
              <strong>{currency}</strong>
            </div>
          </label>

          <div className={s.formGrid}>
            <label>
              <span>{t('oms.invoiceDetail.registerPayment.fields.method')}</span>
              <select value={form.method} onChange={(event) => setField('method', event.target.value)}>
                {methodOptions.map((method) => (
                  <option key={method} value={method}>{t(`oms.paymentMethods.${method}`, method)}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{t('oms.invoiceDetail.registerPayment.fields.date')}</span>
              <input type="date" value={form.date} onChange={(event) => setField('date', event.target.value)} />
            </label>
            <label>
              <span>{t('oms.invoiceDetail.registerPayment.fields.reference')}</span>
              <input value={form.reference} onChange={(event) => setField('reference', event.target.value)} />
            </label>
            <label>
              <span>{t('oms.invoiceDetail.registerPayment.fields.direction')}</span>
              <select value={form.direction} onChange={(event) => setField('direction', event.target.value)}>
                <option value="inbound">{t('oms.paymentDetail.directions.inbound')}</option>
                <option value="refund">{t('oms.paymentDetail.directions.refund')}</option>
              </select>
            </label>
            {showOrderSelect ? (
              <label className={s.fullField}>
                <span>{t('oms.paymentDetail.smart.order')}</span>
                <select value={form.orderId} onChange={(event) => setField('orderId', event.target.value)}>
                  <option value="">{t('oms.paymentDetail.create.selectOrder')}</option>
                  {orderRows.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.number || order.id}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </div>
      </DetailSection>

      <DetailSection title={t('oms.paymentDetail.create.sections.result')}>
        <div className={s.createSummary}>
          <Fact label={t('oms.paymentDetail.create.customer')} value={customerName(sourceOrder) || '—'} />
          <Fact label={t('oms.paymentDetail.smart.invoice')} value={sourceInvoice?.number || sourceInvoice?.id || '—'} to={sourceInvoice?.id ? `/main/oms/invoices/${sourceInvoice.id}` : null} />
          <Fact label={t('oms.paymentDetail.create.amountDue')} value={formatMoney(amountDue, currency, locale)} />
          <Fact label={t('oms.paymentDetail.create.paymentAmount')} value={formatMoney(amount, currency, locale)} />
          <Fact label={t('oms.paymentDetail.create.applyToInvoice')} value={formatMoney(applyAmount, currency, locale)} />
          <Fact label={t('oms.paymentDetail.create.dueAfter')} value={formatMoney(remainingAfter, currency, locale)} />
          <Fact label={t('oms.paymentDetail.create.onAccount')} value={formatMoney(onAccount, currency, locale)} />
        </div>
      </DetailSection>
    </div>
  );
}

function PaymentCreateApplications({
  t,
  locale,
  form,
  setField,
  sourceInvoice,
  currency,
  amountDue,
  applyAmount,
  remainingAfter,
  onAccount,
}) {
  if (!sourceInvoice) {
    return (
      <DetailSection title={t('oms.paymentDetail.sections.applications')} subtitle={t('oms.paymentDetail.create.noInvoiceSubtitle')}>
        <EmptyState>{t('oms.paymentDetail.empty.onAccount')}</EmptyState>
      </DetailSection>
    );
  }

  return (
    <DetailSection title={t('oms.paymentDetail.sections.applications')} subtitle={t('oms.paymentDetail.create.allocationSubtitle')}>
      <div className={s.allocationEditor}>
        <div>
          <span>{t('oms.paymentDetail.smart.invoice')}</span>
          <strong>
            <Link to={`/main/oms/invoices/${sourceInvoice.id}`}>{sourceInvoice.number || sourceInvoice.id}</Link>
          </strong>
        </div>
        <div>
          <span>{t('oms.paymentDetail.create.amountDue')}</span>
          <strong>{formatMoney(amountDue, currency, locale)}</strong>
        </div>
        <label>
          <span>{t('oms.paymentDetail.create.applyToInvoice')}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.applyAmount}
            disabled={form.direction === 'refund'}
            onChange={(event) => setField('applyAmount', event.target.value)}
          />
        </label>
        <div>
          <span>{t('oms.paymentDetail.create.dueAfter')}</span>
          <strong>{formatMoney(remainingAfter, currency, locale)}</strong>
        </div>
        <div className={onAccount > 0 ? s.onAccountBox : ''}>
          <span>{t('oms.paymentDetail.create.onAccount')}</span>
          <strong>{formatMoney(onAccount, currency, locale)}</strong>
        </div>
      </div>
    </DetailSection>
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

function OverviewTab({ payment, order, locale, currency, t }) {
  return (
    <div className={s.stack}>
      <div className={s.overviewGrid}>
        <Fact label={t('oms.paymentDetail.overview.amount')} value={formatMoney(payment?.amount, currency, locale)} />
        <Fact label={t('oms.paymentDetail.overview.allocated')} value={formatMoney(payment?.allocatedAmount, currency, locale)} />
        <Fact label={t('oms.paymentDetail.overview.unapplied')} value={formatMoney(payment?.unappliedAmount, currency, locale)} />
        <Fact label={t('oms.paymentDetail.overview.direction')} value={directionLabel(payment?.direction, t)} />
        <Fact label={t('oms.paymentDetail.overview.method')} value={paymentMethodLabel(payment?.method, t)} />
        <Fact label={t('oms.paymentDetail.overview.customer')} value={payment?.customerName || t('oms.paymentDetail.noCustomer')} />
      </div>
      <DetailSection title={t('oms.paymentDetail.sections.documentChain')}>
        <div className={s.chain}>
          {payment?.orderId ? (
            <Link to={`/main/oms/orders/${payment.orderId}`}>
              {t('oms.paymentDetail.smart.order')} · {order?.number || payment.orderId}
            </Link>
          ) : (
            <span>{t('oms.paymentDetail.empty.noOrder')}</span>
          )}
          {Array.isArray(payment?.applications) && payment.applications.length ? payment.applications.map((application) => (
            <Link key={application.id || application.invoiceId} to={`/main/oms/invoices/${application.invoiceId}`}>
              {t('oms.paymentDetail.smart.invoice')} · {application.invoiceId}
            </Link>
          )) : (
            <span>{t('oms.paymentDetail.empty.onAccount')}</span>
          )}
        </div>
      </DetailSection>
    </div>
  );
}

function ApplicationsTab({ payment, applications, invoiceDetailsById, locale, currency, t }) {
  return (
    <DetailSection
      title={t('oms.paymentDetail.sections.applications')}
      subtitle={t('oms.paymentDetail.applications.subtitle')}
    >
      {applications.length ? (
        <div className={s.applicationRows}>
          {applications.map((application) => {
            const invoice = invoiceDetailsById[application.invoiceId];
            const remaining = invoice ? formatMoney(invoice.amountDue, invoice.currencyCode || currency, locale) : t('oms.paymentDetail.applications.remainingUnknown');
            return (
              <div key={application.id || application.invoiceId} className={s.applicationRow}>
                <div>
                  <strong>
                    <Link to={`/main/oms/invoices/${application.invoiceId}`}>
                      {invoice?.number || application.invoiceId}
                    </Link>
                  </strong>
                  <span>{formatDateTime(application.allocatedAt, locale)}</span>
                </div>
                <div>
                  <span>{t('oms.paymentDetail.applications.allocatedAmount')}</span>
                  <MoneyAmount value={application.amount} currency={payment?.currencyCode || currency} locale={locale} />
                </div>
                <div>
                  <span>{t('oms.paymentDetail.applications.remaining')}</span>
                  <strong>{remaining}</strong>
                </div>
                <div>
                  <span>{t('oms.paymentDetail.applications.scope')}</span>
                  <strong>{t('oms.paymentDetail.applications.invoiceScope')}</strong>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState>{t('oms.paymentDetail.empty.onAccount')}</EmptyState>
      )}
    </DetailSection>
  );
}

function ActivityTab({ payment, locale, t }) {
  const timeline = buildTimeline(payment, t, locale);
  return (
    <DetailSection title={t('oms.paymentDetail.sections.activity')}>
      {timeline.length ? (
        <div className={s.timeline}>
          {timeline.map((event) => (
            <div key={event.id} className={s.timelineRow}>
              <span className={s.timelineDot} />
              <div>
                <strong>{event.title}</strong>
                <span>{event.meta}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState>{t('oms.paymentDetail.activity.empty')}</EmptyState>
      )}
    </DetailSection>
  );
}

function NotesTab({ t }) {
  return (
    <DetailSection title={t('oms.paymentDetail.sections.notes')}>
      <EmptyState>{t('oms.paymentDetail.notes.deferred')}</EmptyState>
    </DetailSection>
  );
}

function SystemTab({ payment, order, locale, t }) {
  return (
    <div className={s.systemGrid}>
      <Fact label={t('oms.paymentDetail.system.id')} value={payment?.id} />
      <Fact label={t('oms.paymentDetail.system.orderId')} value={payment?.orderId || '—'} to={payment?.orderId ? `/main/oms/orders/${payment.orderId}` : null} />
      <Fact label={t('oms.paymentDetail.system.reference')} value={payment?.reference || '—'} />
      <Fact label={t('oms.paymentDetail.system.transactionId')} value={payment?.transactionId || '—'} />
      <Fact label={t('oms.paymentDetail.system.createdAt')} value={formatDateTime(payment?.createdAt, locale)} />
      <Fact label={t('oms.paymentDetail.system.processedAt')} value={formatDateTime(payment?.processedAt || payment?.paidAt, locale)} />
      <Fact label={t('oms.paymentDetail.system.orderNumber')} value={order?.number || '—'} />
      <Fact label={t('oms.paymentDetail.system.applicationCount')} value={String(payment?.applications?.length || 0)} />
    </div>
  );
}
