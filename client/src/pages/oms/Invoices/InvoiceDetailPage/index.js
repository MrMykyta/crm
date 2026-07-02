import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowLeft,
  CreditCard,
  FileText,
  Landmark,
  ReceiptText,
  RotateCcw,
} from 'lucide-react';

import {
  DetailCard,
  DetailLayout,
  DetailSection,
  DetailTabs,
} from '../../../../components/detail';
import CustomerDocumentRenderer, {
  buildInvoiceDocumentDto,
} from '../../../../components/oms/CustomerDocumentRenderer';
import DocumentActionStrip from '../../../../components/oms/DocumentActionStrip';
import DocumentDeliveryDialog from '../../../../components/oms/DocumentDeliveryDialog';
import DocumentShareDialog from '../../../../components/oms/DocumentShareDialog';
import { pickDocumentDeliveryRecipient } from '../../../../components/oms/documentDeliveryRecipient';
import {
  openGeneratedPdf,
  pickGeneratedPdfUrl,
} from '../../../../components/oms/generatedPdf';
import useAclPermissions from '../../../../hooks/useAclPermissions';
import { asText } from '../../../../lib/format';
import {
  useGenerateInvoicePdfMutation,
  useGetInvoiceByIdQuery,
  useIssueInvoiceFromOrderMutation,
  useSendInvoiceDocumentMutation,
} from '../../../../store/rtk/invoicesApi';
import { useLazyGetSignedFileUrlQuery } from '../../../../store/rtk/filesApi';
import {
  useCreateDocumentShareMutation,
  useListDocumentSharesQuery,
  useRevokeDocumentShareMutation,
} from '../../../../store/rtk/documentSharesApi';
import { useGetContactPointsQuery } from '../../../../store/rtk/contactPointsApi';
import { paymentMethodLabel } from '../../../../components/oms/paymentLabels';
import s from './InvoiceDetailPage.module.css';

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

function customerName(invoice) {
  const counterparty = invoice?.counterparty || invoice?.order?.counterparty || invoice?.order?.customer;
  return counterparty?.shortName || counterparty?.fullName || counterparty?.name || counterparty?.id || '';
}

function statusLabel(status, t) {
  const key = asText(status).toLowerCase();
  if (!key) return '—';
  return t(`statuses.${key}`, key);
}

function paymentStateLabel(state, t) {
  const key = asText(state).toLowerCase();
  if (!key) return '—';
  return t(`oms.invoiceDetail.paymentStates.${key}`, statusLabel(key, t));
}

function paymentTone(invoice) {
  const state = asText(invoice?.paymentState).toLowerCase();
  if (invoice?.overdue || state.includes('overdue')) return 'danger';
  if (state === 'paid') return 'ok';
  if (state.includes('partial')) return 'warning';
  if (state === 'draft') return 'muted';
  return 'soft';
}

function getActionError(error, t) {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || t('oms.errors.actionFailed');
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

function buildTimeline(invoice, t, locale) {
  return [
    invoice?.createdAt ? {
      id: 'created',
      title: t('oms.invoiceDetail.activity.created'),
      meta: formatDateTime(invoice.createdAt, locale),
    } : null,
    invoice?.issueDate ? {
      id: 'issued',
      title: t('oms.invoiceDetail.activity.issued'),
      meta: formatDateTime(invoice.issueDate, locale),
    } : null,
    ...(Array.isArray(invoice?.payments) ? invoice.payments.map((payment) => ({
      id: `payment-${payment.id}`,
      title: t('oms.invoiceDetail.activity.payment'),
      meta: `${formatMoney(payment.amount, payment.currencyCode || payment.currency || invoice?.order?.currencyCode, locale)} · ${formatDateTime(payment.paidAt || payment.processedAt || payment.createdAt, locale)}`,
    })) : []),
    invoice?.paidDate ? {
      id: 'paid',
      title: t('oms.invoiceDetail.activity.paid'),
      meta: formatDateTime(invoice.paidDate, locale),
    } : null,
    invoice?.updatedAt ? {
      id: 'updated',
      title: t('oms.invoiceDetail.activity.updated'),
      meta: formatDateTime(invoice.updatedAt, locale),
    } : null,
  ].filter(Boolean);
}

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { can } = useAclPermissions();
  const canReadInvoices = can('order:read');
  const canIssueInvoices = can('order:convert');
  const canRegisterPayments = can('order:update') || can('order:convert');
  const canCreateCreditNote = can('order:update');
  const [activeTab, setActiveTab] = useState('overview');
  const [actionLoadingKey, setActionLoadingKey] = useState('');
  const [actionError, setActionError] = useState('');

  const {
    data: invoice,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetInvoiceByIdQuery(id, {
    skip: !id,
    refetchOnMountOrArgChange: true,
  });
  const [issueInvoiceFromOrder] = useIssueInvoiceFromOrderMutation();

  const currency = invoice?.order?.currencyCode || invoice?.currencyCode || 'PLN';
  const amountDue = asNumber(invoice?.amountDue, asNumber(invoice?.totalGross, 0));
  const amountPaid = asNumber(invoice?.amountPaid, 0);
  const payments = Array.isArray(invoice?.payments) ? invoice.payments : [];
  const creditNotes = Array.isArray(invoice?.creditNotes) ? invoice.creditNotes : [];
  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  const vatBreakdown = Array.isArray(invoice?.vatBreakdown) ? invoice.vatBreakdown : [];
  const availableActions = invoice?.availableActions || {};
  const orderId = invoice?.order?.id || invoice?.orderId || null;
  const name = customerName(invoice) || t('oms.invoiceDetail.noCustomer');
  const tone = paymentTone(invoice);
  const canRegisterPaymentNow = Boolean(orderId) && amountDue > 0 && (
    availableActions.canRegisterPayment ||
    availableActions.deferred?.registerPayment ||
    invoice?.paymentState !== 'paid'
  );

  const nextAction = useMemo(() => {
    if (!invoice) return '';
    if (availableActions.canIssue) return t('oms.invoiceDetail.next.issue');
    if (canRegisterPaymentNow) return t('oms.invoiceDetail.next.registerPayment');
    if (invoice.paymentState === 'paid') return t('oms.invoiceDetail.next.settled');
    if (invoice.overdue) return t('oms.invoiceDetail.next.overdue');
    return t('oms.invoiceDetail.next.monitor');
  }, [availableActions.canIssue, canRegisterPaymentNow, invoice, t]);

  const runAction = useCallback(async (key) => {
    if (!invoice) return;
    if (key === 'register-payment') {
      const params = new URLSearchParams();
      params.set('invoiceId', invoice.id);
      if (orderId) params.set('orderId', orderId);
      const customerId = invoice.order?.counterparty?.id || invoice.order?.customer?.id || invoice.counterpartyId || invoice.customerId;
      if (customerId) params.set('customerId', customerId);
      navigate(`/main/oms/payments/new?${params.toString()}`);
      return;
    }
    if (key === 'credit-note') {
      const params = new URLSearchParams();
      params.set('invoiceId', invoice.id);
      if (orderId) params.set('orderId', orderId);
      const customerId = invoice.order?.counterparty?.id || invoice.order?.customer?.id || invoice.counterpartyId || invoice.customerId;
      if (customerId) params.set('customerId', customerId);
      navigate(`/main/oms/credit-notes/new?${params.toString()}`);
      return;
    }
    if (key !== 'issue' || !invoice.orderId) return;
    setActionError('');
    setActionLoadingKey(key);
    try {
      const issued = await issueInvoiceFromOrder({
        orderId: invoice.orderId,
        payload: { issueDate: new Date().toISOString() },
      }).unwrap();
      await refetch();
      if (issued?.id) navigate(`/main/oms/invoices/${issued.id}`, { replace: true });
    } catch (err) {
      setActionError(getActionError(err, t));
    } finally {
      setActionLoadingKey('');
    }
  }, [invoice, issueInvoiceFromOrder, navigate, orderId, refetch, t]);

  const primaryAction = useMemo(() => {
    if (!invoice) return null;
    if (availableActions.canIssue) {
      return {
        key: 'issue',
        label: t('oms.actionLabels.issueInvoice'),
        icon: <ReceiptText size={15} />,
        disabled: !canIssueInvoices || Boolean(actionLoadingKey),
      };
    }
    if (canRegisterPaymentNow) {
      return {
        key: 'register-payment',
        label: t('oms.invoiceDetail.actions.registerPayment'),
        icon: <CreditCard size={15} />,
        disabled: !canRegisterPayments || Boolean(actionLoadingKey) || amountDue <= 0 || !orderId,
      };
    }
    return null;
  }, [actionLoadingKey, amountDue, availableActions.canIssue, canIssueInvoices, canRegisterPaymentNow, canRegisterPayments, invoice, orderId, t]);

  const smartButtons = useMemo(() => [
    orderId ? {
      key: 'order',
      label: t('oms.invoiceDetail.smart.order'),
      value: invoice?.order?.number || t('oms.invoiceDetail.smart.open'),
      to: `/main/oms/orders/${orderId}`,
      icon: <FileText size={14} />,
    } : null,
    payments.length ? {
      key: 'payments',
      label: t('oms.invoiceDetail.smart.payments'),
      value: String(payments.length),
      onClick: () => setActiveTab('payments'),
      icon: <CreditCard size={14} />,
    } : null,
    canCreateCreditNote ? {
      key: 'new-credit-note',
      label: t('oms.invoiceDetail.smart.creditNote', 'Credit note'),
      value: t('common.create', 'Create'),
      onClick: () => runAction('credit-note'),
      icon: <RotateCcw size={14} />,
    } : null,
    creditNotes.length ? {
      key: 'credit-notes',
      label: t('oms.invoiceDetail.smart.creditNotes'),
      value: String(creditNotes.length),
      onClick: () => setActiveTab('credit-notes'),
      icon: <ReceiptText size={14} />,
    } : null,
    availableActions.canPrint ? {
      key: 'print',
      label: t('oms.invoiceDetail.smart.print'),
      value: '',
      onClick: () => { if (typeof window !== 'undefined') window.print(); },
      icon: <ReceiptText size={14} />,
    } : null,
  ].filter(Boolean), [availableActions.canPrint, canCreateCreditNote, creditNotes.length, invoice?.order?.number, orderId, payments.length, runAction, t]);

  const tabs = useMemo(() => [
    {
      key: 'overview',
      label: t('oms.invoiceDetail.tabs.overview'),
      render: () => (
        <OverviewTab
          invoice={invoice}
          amountDue={amountDue}
          amountPaid={amountPaid}
          currency={currency}
          nextAction={nextAction}
          locale={locale}
          t={t}
        />
      ),
    },
    {
      key: 'items',
      label: t('oms.invoiceDetail.tabs.items'),
      count: items.length,
      render: () => <ItemsTab invoice={invoice} items={items} vatBreakdown={vatBreakdown} currency={currency} locale={locale} t={t} />,
    },
    {
      key: 'payments',
      label: t('oms.invoiceDetail.tabs.payments'),
      count: payments.length,
      render: () => <PaymentsTab invoice={invoice} payments={payments} currency={currency} locale={locale} t={t} />,
    },
    {
      key: 'credit-notes',
      label: t('oms.invoiceDetail.tabs.creditNotes'),
      count: creditNotes.length,
      render: () => <CreditNotesTab creditNotes={creditNotes} currency={currency} locale={locale} t={t} />,
    },
    {
      key: 'preview',
      label: t('oms.invoiceDetail.tabs.preview'),
      render: () => <PreviewTab invoice={invoice} items={items} currency={currency} locale={locale} t={t} />,
    },
    {
      key: 'activity',
      label: t('oms.invoiceDetail.tabs.activity'),
      render: () => <ActivityTab invoice={invoice} t={t} locale={locale} />,
    },
    {
      key: 'system',
      label: t('oms.invoiceDetail.tabs.system'),
      render: () => <SystemTab invoice={invoice} locale={locale} t={t} />,
    },
  ], [amountDue, amountPaid, creditNotes, currency, invoice, items, locale, nextAction, payments, t, vatBreakdown]);

  if (!canReadInvoices) {
    return <div className={s.state}>{t('common.noPermission')}</div>;
  }
  if (isLoading || (isFetching && !invoice)) {
    return <div className={s.state}>{t('common.loading')}</div>;
  }
  if (isError) {
    const message = error?.data?.message || error?.data?.error || error?.message || t('oms.errors.invoiceLoadFailed');
    return <div className={s.state}>{message}</div>;
  }
  if (!invoice) {
    return <div className={s.state}>{t('oms.errors.invoiceNotFound')}</div>;
  }

  return (
    <DetailLayout
      mode="entity"
      className={s.invoiceDetail}
      header={(
        <header className={s.headerWrap}>
          <div className={s.headerTop}>
            <button type="button" className={s.backBtn} onClick={() => navigate('/main/oms/invoices')}>
              <ArrowLeft size={15} /> {t('oms.invoices.title')}
            </button>
            <div className={s.headerMeta}>
              <span>{invoice.number || invoice.id}</span>
              <span className={s[`toneText_${tone}`] || ''}>{paymentStateLabel(invoice.paymentState || invoice.status, t)}</span>
            </div>
          </div>

          <div className={s.heroGrid}>
            <div className={s.heroMain}>
              <div className={`${s.heroIcon} ${s[`heroIcon_${tone}`] || ''}`}>
                {invoice.overdue ? <AlertTriangle size={26} /> : <ReceiptText size={26} />}
              </div>
              <div className={s.heroText}>
                <span>{t('oms.invoiceDetail.hero.eyebrow')} · {invoice.number || invoice.id}</span>
                <h1>{name}</h1>
                <p>{t('oms.invoiceDetail.subtitle')}</p>
              </div>
            </div>

            <div className={`${s.claimPanel} ${s[`claim_${tone}`] || ''}`}>
              <span>{t('oms.invoiceDetail.hero.amountDue')}</span>
              <MoneyAmount value={amountDue} currency={currency} locale={locale} size="hero" />
              <div className={s.claimMeta}>
                <span>{paymentStateLabel(invoice.paymentState || invoice.status, t)}</span>
                <span>{t('oms.invoiceDetail.hero.dueDate')}: {formatDate(invoice.dueDate, locale)}</span>
                {invoice.overdue ? <span>{t('oms.invoiceDetail.hero.overdue')}</span> : null}
              </div>
            </div>
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
            <div className={s.actionRow}>
              <span className={s.nextAction}>{nextAction}</span>
              {primaryAction ? (
                <button
                  type="button"
                  className={s.primaryBtn}
                  disabled={primaryAction.disabled}
                  onClick={() => runAction(primaryAction.key)}
                >
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
          <DetailCard title={t('oms.invoiceDetail.sections.claimFacts')}>
            <div className={s.factGrid}>
              <Fact label={t('oms.invoiceDetail.fields.customer')} value={name} />
              <Fact label={t('oms.invoiceDetail.fields.contact')} value={invoice.contact?.name || invoice.order?.contact?.name || '—'} />
              <Fact label={t('oms.invoiceDetail.fields.sourceOrder')} value={invoice.order?.number || invoice.orderId || '—'} to={orderId ? `/main/oms/orders/${orderId}` : null} />
              <Fact label={t('oms.invoiceDetail.fields.issueDate')} value={formatDate(invoice.issueDate, locale)} />
              <Fact label={t('oms.invoiceDetail.fields.dueDate')} value={formatDate(invoice.dueDate, locale)} />
              <Fact label={t('oms.invoiceDetail.fields.paymentTerms')} value={invoice.paymentTerms || invoice.order?.paymentTerms || '—'} />
            </div>
          </DetailCard>

          <DetailCard title={t('oms.invoiceDetail.sections.finance')}>
            <div className={s.factGrid}>
              <Fact label={t('oms.invoiceDetail.fields.currency')} value={currency} />
              <Fact label={t('oms.invoiceDetail.fields.vatProfile')} value={vatBreakdown.length ? t('oms.invoiceDetail.fields.vatRates', { count: vatBreakdown.length }) : '—'} />
              <Fact label={t('oms.invoiceDetail.fields.owner')} value={invoice.owner?.name || invoice.order?.owner?.name || '—'} />
              <Fact label={t('oms.invoiceDetail.fields.bankPayment')} value={paymentMethodLabel(invoice.paymentMethod || invoice.order?.paymentMethod, t)} />
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

function OverviewTab({ invoice, amountDue, amountPaid, currency, nextAction, locale, t }) {
  return (
    <div className={s.stack}>
      <div className={s.overviewGrid}>
        <Fact label={t('oms.invoiceDetail.overview.amountDue')} value={formatMoney(amountDue, currency, locale)} />
        <Fact label={t('oms.invoiceDetail.overview.amountPaid')} value={formatMoney(amountPaid, currency, locale)} />
        <Fact label={t('oms.invoiceDetail.overview.outstanding')} value={formatMoney(amountDue, currency, locale)} />
        <Fact label={t('oms.invoiceDetail.overview.dueDate')} value={formatDate(invoice?.dueDate, locale)} />
        <Fact label={t('oms.invoiceDetail.overview.paymentState')} value={paymentStateLabel(invoice?.paymentState || invoice?.status, t)} />
        <Fact label={t('oms.invoiceDetail.overview.nextAction')} value={nextAction} />
      </div>
      <DetailSection title={t('oms.invoiceDetail.sections.sourceOrder')}>
        <div className={s.chain}>
          {invoice?.order?.id || invoice?.orderId ? (
            <Link to={`/main/oms/orders/${invoice?.order?.id || invoice.orderId}`}>
              {t('oms.invoiceDetail.smart.order')} · {invoice?.order?.number || invoice?.orderId}
            </Link>
          ) : (
            <span>{t('oms.invoiceDetail.empty.noSourceOrder')}</span>
          )}
        </div>
      </DetailSection>
    </div>
  );
}

function ItemsTab({ invoice, items, vatBreakdown, currency, locale, t }) {
  return (
    <div className={s.stack}>
      <DetailSection title={t('oms.invoiceDetail.sections.items')}>
        {items.length ? (
          <div className={s.itemRows}>
            {items.map((item) => (
              <div key={item.id || item.nameSnapshot} className={s.itemRow}>
                <div>
                  <strong>{item.nameSnapshot || item.name || t('oms.invoiceDetail.items.unnamedLine')}</strong>
                  <span>
                    {t('oms.invoiceDetail.items.quantityMeta', { qty: asNumber(item.qty, 0) })}
                    {' · '}
                    {t('oms.invoiceDetail.items.taxMeta', { rate: asNumber(item.taxRate, 0) })}
                  </span>
                </div>
                <MoneyAmount value={item.lineTotalGross} currency={currency} locale={locale} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>{t('oms.invoiceDetail.empty.noItems')}</EmptyState>
        )}
      </DetailSection>

      <DetailSection title={t('oms.invoiceDetail.sections.vatBreakdown')}>
        {vatBreakdown.length ? (
          <div className={s.vatGrid}>
            {vatBreakdown.map((row) => (
              <div key={row.rate} className={s.vatRow}>
                <strong>{t('oms.invoiceDetail.items.taxMeta', { rate: asNumber(row.rate, 0) })}</strong>
                <span>{formatMoney(row.totalNet, currency, locale)}</span>
                <span>{formatMoney(row.totalTax, currency, locale)}</span>
                <span>{formatMoney(row.totalGross, currency, locale)}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>{t('oms.invoiceDetail.empty.noVat')}</EmptyState>
        )}
      </DetailSection>

      <div className={s.totalsCrescendo}>
        <div><span>{t('oms.summaryLabels.net')}</span><strong>{formatMoney(invoice?.totalNet, currency, locale)}</strong></div>
        <div><span>{t('oms.summaryLabels.vat')}</span><strong>{formatMoney(invoice?.totalTax, currency, locale)}</strong></div>
        <div className={s.grandTotalLine}><span>{t('oms.summaryLabels.gross')}</span><strong>{formatMoney(invoice?.totalGross, currency, locale)}</strong></div>
      </div>
    </div>
  );
}

function PaymentsTab({ invoice, payments, currency, locale, t }) {
  return (
    <div className={s.stack}>
      <DetailSection
        title={t('oms.invoiceDetail.sections.payments')}
        subtitle={t('oms.invoiceDetail.payments.scopeHint')}
      >
        {payments.length ? (
          <div className={s.itemRows}>
            {payments.map((payment) => (
              <div key={payment.id} className={s.itemRow}>
                <div>
                  <strong>
                    <Link to={`/main/oms/payments/${payment.id}${invoice?.orderId ? `?orderId=${encodeURIComponent(invoice.orderId)}` : ''}`}>
                      {payment.reference || paymentMethodLabel(payment.method, t)}
                    </Link>
                  </strong>
                  <span>
                    {statusLabel(payment.status, t)}
                    {' · '}
                    {formatDateTime(payment.paidAt || payment.processedAt || payment.createdAt, locale)}
                    {' · '}
                    {t('oms.invoiceDetail.payments.orderScope')}
                  </span>
                </div>
                <MoneyAmount value={payment.amount} currency={payment.currencyCode || payment.currency || currency} locale={locale} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>{t('oms.invoiceDetail.empty.noPayments')}</EmptyState>
        )}
      </DetailSection>
      <div className={s.scopeNote}>
        <Landmark size={15} />
        <span>{invoice?.paymentSource?.reason ? t('oms.invoiceDetail.payments.orderScopedCaveat') : t('oms.invoiceDetail.payments.scopeHint')}</span>
      </div>
    </div>
  );
}

function CreditNotesTab({ creditNotes, currency, locale, t }) {
  return (
    <DetailSection title={t('oms.invoiceDetail.sections.creditNotes')}>
      {creditNotes.length ? (
        <div className={s.itemRows}>
          {creditNotes.map((creditNote) => (
            <div key={creditNote.id} className={s.itemRow}>
              <div>
                <strong>
                  <Link to={`/main/oms/credit-notes/${creditNote.id}`}>
                    {creditNote.number || creditNote.id}
                  </Link>
                </strong>
                <span>{creditNote.reason || statusLabel(creditNote.status, t)}</span>
              </div>
              <MoneyAmount value={creditNote.amountGross ?? creditNote.amount} currency={creditNote.currencyCode || creditNote.currency || currency} locale={locale} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState>{t('oms.invoiceDetail.empty.noCreditNotes')}</EmptyState>
      )}
    </DetailSection>
  );
}

function PreviewTab({ invoice, items, currency, locale, t }) {
  const documentDto = buildInvoiceDocumentDto({ invoice, items, currency, locale });
  const [generatePdf, { isLoading, error }] = useGenerateInvoicePdfMutation();
  const [sendDocument, sendState] = useSendInvoiceDocumentMutation();
  const [createShare, createShareState] = useCreateDocumentShareMutation();
  const [revokeShare, revokeShareState] = useRevokeDocumentShareMutation();
  const { data: shares = [], isFetching: sharesLoading, error: sharesError } = useListDocumentSharesQuery(
    { entityType: 'invoice', entityId: invoice?.id },
    { skip: !invoice?.id }
  );
  const deliveryCounterpartyId =
    invoice?.counterpartyId ||
    invoice?.customerId ||
    invoice?.counterparty?.id ||
    invoice?.customer?.id ||
    invoice?.order?.counterparty?.id ||
    invoice?.order?.customer?.id ||
    '';
  const deliveryContactId = invoice?.contactId || invoice?.contact?.id || invoice?.order?.contactId || invoice?.order?.contact?.id || '';
  const { data: deliveryCounterpartyPoints = [] } = useGetContactPointsQuery(
    { ownerType: 'counterparty', ownerId: deliveryCounterpartyId },
    { skip: !deliveryCounterpartyId }
  );
  const { data: deliveryContactPoints = [] } = useGetContactPointsQuery(
    { ownerType: 'contact', ownerId: deliveryContactId },
    { skip: !deliveryContactId }
  );
  const [getSignedFileUrl] = useLazyGetSignedFileUrlQuery();
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [pdfOpenState, setPdfOpenState] = useState({ url: '', opened: false });
  const deliveryRecipient = useMemo(() => pickDocumentDeliveryRecipient({
    counterpartyContactPoints: deliveryCounterpartyPoints,
    contactPersonContactPoints: deliveryContactPoints,
    contactPersonLegacyEmail: invoice?.contact?.email || invoice?.order?.contact?.email,
    counterpartyLegacyEmail:
      invoice?.counterparty?.email ||
      invoice?.customer?.email ||
      invoice?.order?.counterparty?.email ||
      invoice?.order?.customer?.email,
  }), [
    deliveryContactPoints,
    deliveryCounterpartyPoints,
    invoice?.contact?.email,
    invoice?.counterparty?.email,
    invoice?.customer?.email,
    invoice?.order?.contact?.email,
    invoice?.order?.counterparty?.email,
    invoice?.order?.customer?.email,
  ]);

  const onGeneratePdf = async () => {
    if (!invoice?.id) return;
    setPdfOpenState({ url: '', opened: false });
    const result = await generatePdf({ id: invoice.id, payload: { locale } }).unwrap();
    const fileId = result?.file?.id || result?.metadata?.fileId;
    const signed = fileId ? await getSignedFileUrl(fileId).unwrap() : null;
    const url = pickGeneratedPdfUrl(result, signed);
    setPdfOpenState(openGeneratedPdf(url));
  };

  const onSendDocument = async (payload) => {
    await sendDocument({ id: invoice.id, payload }).unwrap();
    setDeliveryOpen(false);
  };

  const onCreateShare = async (payload) => {
    await createShare({ entityType: 'invoice', entityId: invoice.id, locale, ...payload }).unwrap();
  };

  const onRevokeShare = async (share) => {
    await revokeShare({ id: share.id, entityType: 'invoice', entityId: invoice.id }).unwrap();
  };

  return (
    <DetailSection title={t('oms.invoiceDetail.tabs.preview')}>
      <DocumentActionStrip
        t={t}
        title={t('oms.documentActions.invoiceTitle')}
        subtitle={t('oms.documentActions.invoiceSubtitle')}
        onGeneratePdf={onGeneratePdf}
        pdfLoading={isLoading}
        pdfDisabled={!invoice?.id}
        pdfOpened={pdfOpenState.opened}
        pdfFallbackUrl={pdfOpenState.opened ? '' : pdfOpenState.url}
        onSend={() => setDeliveryOpen(true)}
        sendLoading={sendState.isLoading}
        sendDisabled={!invoice?.id}
        onShare={() => setShareOpen(true)}
        shareDisabled={!invoice?.id}
        error={error}
      />
      <CustomerDocumentRenderer dto={documentDto} />
      <DocumentDeliveryDialog
        open={deliveryOpen}
        onClose={() => setDeliveryOpen(false)}
        onSend={onSendDocument}
        loading={sendState.isLoading}
        error={sendState.error}
        t={t}
        locale={locale}
        documentLabel={t('oms.documentDelivery.types.invoice')}
        documentNumber={invoice?.number}
        defaultRecipientEmail={deliveryRecipient.email}
        defaultRecipientSource={deliveryRecipient.source}
      />
      <DocumentShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onCreate={onCreateShare}
        onRevoke={onRevokeShare}
        t={t}
        locale={locale}
        entityType="invoice"
        entityId={invoice?.id}
        documentLabel={t('oms.documentShare.types.invoice')}
        documentNumber={invoice?.number}
        shares={shares}
        loading={sharesLoading}
        creating={createShareState.isLoading}
        revoking={revokeShareState.isLoading}
        error={sharesError || createShareState.error || revokeShareState.error}
      />
    </DetailSection>
  );
}

function ActivityTab({ invoice, t, locale }) {
  const events = buildTimeline(invoice, t, locale);
  return (
    <DetailSection title={t('oms.invoiceDetail.tabs.activity')}>
      {events.length ? (
        <div className={s.timeline}>
          {events.map((event) => (
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
        <EmptyState>{t('oms.invoiceDetail.activity.empty')}</EmptyState>
      )}
    </DetailSection>
  );
}

function SystemTab({ invoice, locale, t }) {
  return (
    <DetailSection title={t('oms.invoiceDetail.tabs.system')}>
      <div className={s.systemGrid}>
        <Fact label={t('oms.detailLabels.number')} value={invoice?.number || '—'} />
        <Fact label={t('oms.detailLabels.status')} value={paymentStateLabel(invoice?.paymentState || invoice?.status, t)} />
        <Fact label="ID" value={invoice?.id || '—'} />
        <Fact label={t('oms.invoiceDetail.fields.orderId')} value={invoice?.orderId || '—'} />
        <Fact label={t('oms.detailLabels.createdAt')} value={formatDateTime(invoice?.createdAt, locale)} />
        <Fact label={t('oms.detailLabels.updatedAt')} value={formatDateTime(invoice?.updatedAt, locale)} />
      </div>
    </DetailSection>
  );
}
