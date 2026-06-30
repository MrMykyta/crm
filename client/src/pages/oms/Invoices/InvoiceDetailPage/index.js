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
} from 'lucide-react';

import {
  DetailCard,
  DetailLayout,
  DetailSection,
  DetailTabs,
} from '../../../../components/detail';
import useAclPermissions from '../../../../hooks/useAclPermissions';
import { asText } from '../../../../lib/format';
import {
  useGetInvoiceByIdQuery,
  useIssueInvoiceFromOrderMutation,
} from '../../../../store/rtk/invoicesApi';
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
  const totalGross = asNumber(invoice?.totalGross, 0);
  const payments = Array.isArray(invoice?.payments) ? invoice.payments : [];
  const creditNotes = Array.isArray(invoice?.creditNotes) ? invoice.creditNotes : [];
  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  const vatBreakdown = Array.isArray(invoice?.vatBreakdown) ? invoice.vatBreakdown : [];
  const availableActions = invoice?.availableActions || {};
  const orderId = invoice?.order?.id || invoice?.orderId || null;
  const name = customerName(invoice) || t('oms.invoiceDetail.noCustomer');
  const tone = paymentTone(invoice);

  const nextAction = useMemo(() => {
    if (!invoice) return '';
    if (availableActions.canIssue) return t('oms.invoiceDetail.next.issue');
    if (availableActions.canRegisterPayment) return t('oms.invoiceDetail.next.registerPayment');
    if (invoice.paymentState === 'paid') return t('oms.invoiceDetail.next.settled');
    if (invoice.overdue) return t('oms.invoiceDetail.next.overdue');
    return t('oms.invoiceDetail.next.monitor');
  }, [availableActions.canIssue, availableActions.canRegisterPayment, invoice, t]);

  const runAction = useCallback(async (key) => {
    if (!invoice || key !== 'issue' || !invoice.orderId) return;
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
  }, [invoice, issueInvoiceFromOrder, navigate, refetch, t]);

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
    if (availableActions.canRegisterPayment) {
      return {
        key: 'register-payment',
        label: t('oms.invoiceDetail.actions.registerPayment'),
        icon: <CreditCard size={15} />,
        disabled: true,
      };
    }
    return null;
  }, [actionLoadingKey, availableActions.canIssue, availableActions.canRegisterPayment, canIssueInvoices, invoice, t]);

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
  ].filter(Boolean), [availableActions.canPrint, creditNotes.length, invoice?.order?.number, orderId, payments.length, t]);

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
              <Fact label={t('oms.invoiceDetail.fields.bankPayment')} value={invoice.paymentMethod || invoice.order?.paymentMethod || '—'} />
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
                  <strong>{payment.method || t('oms.invoiceDetail.payments.methodUnknown')}</strong>
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
                <strong>{creditNote.number || creditNote.id}</strong>
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
  return (
    <DetailSection title={t('oms.invoiceDetail.tabs.preview')}>
      <article className={s.preview}>
        <header className={s.previewHeader}>
          <div>
            <span>{t('oms.invoiceDetail.preview.label')}</span>
            <h2>{invoice?.number || invoice?.id}</h2>
            <p>{t('oms.invoiceDetail.preview.claim')}</p>
          </div>
          <div>
            <span>{t('oms.invoiceDetail.hero.amountDue')}</span>
            <strong>{formatMoney(invoice?.amountDue, currency, locale)}</strong>
            <p>{formatDate(invoice?.dueDate, locale)}</p>
          </div>
        </header>

        <div className={s.previewCustomer}>
          <span>{t('oms.invoiceDetail.preview.billTo')}</span>
          <strong>{customerName(invoice) || t('oms.invoiceDetail.noCustomer')}</strong>
          <p>{invoice?.counterparty?.fullName || invoice?.order?.counterparty?.fullName || ''}</p>
        </div>

        <div className={s.previewLines}>
          {items.length ? items.map((item) => (
            <div key={item.id || item.nameSnapshot} className={s.previewLine}>
              <div>
                <strong>{item.nameSnapshot || item.name || t('oms.invoiceDetail.items.unnamedLine')}</strong>
                <span>{t('oms.invoiceDetail.items.quantityMeta', { qty: asNumber(item.qty, 0) })}</span>
              </div>
              <strong>{formatMoney(item.lineTotalGross, currency, locale)}</strong>
            </div>
          )) : (
            <div className={s.previewLine}>
              <div>
                <strong>{t('oms.invoiceDetail.empty.noItems')}</strong>
              </div>
            </div>
          )}
        </div>

        <footer className={s.previewFooter}>
          <div>
            <span>{t('oms.invoiceDetail.preview.sourceOrder')}</span>
            <p>{invoice?.order?.number || invoice?.orderId || '—'}</p>
          </div>
          <div className={s.previewGrandTotal}>
            <span>{t('oms.summaryLabels.gross')}</span>
            <MoneyAmount value={invoice?.totalGross} currency={currency} locale={locale} />
          </div>
        </footer>
      </article>
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
