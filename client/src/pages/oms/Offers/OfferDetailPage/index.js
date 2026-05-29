import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import EntityDetailPage from '../../../_scaffold/EntityDetailPage';
import OmsStatusActionsMenu from '../../../../components/oms/OmsStatusActionsMenu';
import {
  useAcceptOfferMutation,
  useCancelOfferMutation,
  useConvertOfferToOrderMutation,
  useDuplicateOfferMutation,
  useExpireOfferMutation,
  useGetOfferByIdQuery,
  useRejectOfferMutation,
  useSendOfferMutation,
} from '../../../../store/rtk/offersApi';
import s from '../../OmsReadOnlyDetail.module.css';

function buildTabs(t) {
  return [
    { key: 'items', label: 'Items' },
    { key: 'summary', label: 'Summary' },
    { key: 'relations', label: t('oms.relations.title', 'Relations') },
    { key: 'actions', label: 'Actions' },
  ];
}

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function asNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
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

function formatMoney(value, currency = 'PLN', locale = 'en') {
  const amount = asNumber(value);
  if (amount === null) return '—';
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)} ${asText(currency) || 'PLN'}`;
}

function formatQty(value, locale = 'en') {
  const qty = asNumber(value);
  if (qty === null) return '—';
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
  return item?.nameSnapshot || item?.name || item?.product?.name || item?.skuSnapshot || '—';
}

function getErrorText(error, fallback = 'Action failed') {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || fallback;
}

function toFormOffer(offer, t, locale) {
  return {
    number: offer?.number || '',
    status: statusLabel(offer?.status, t),
    currency: offer?.currency || offer?.currencyCode || '',
    totalNet: formatMoney(offer?.subtotalNet ?? offer?.totalNet, offer?.currency || offer?.currencyCode || 'PLN', locale),
    totalTax: formatMoney(offer?.totalVat ?? offer?.totalTax, offer?.currency || offer?.currencyCode || 'PLN', locale),
    totalGross: formatMoney(offer?.totalGross, offer?.currency || offer?.currencyCode || 'PLN', locale),
    counterpartyName: offer?.counterparty?.name || offer?.counterparty?.shortName || offer?.counterparty?.fullName || '',
    contactName: offer?.contact?.name || offer?.contact?.email || '',
    ownerName: offer?.owner?.name || offer?.owner?.email || '',
    dealName: offer?.deal?.title || offer?.dealId || '',
    issueDate: formatDate(offer?.issueDate, locale),
    validUntil: formatDate(offer?.validUntil, locale),
    createdAt: formatDate(offer?.createdAt, locale),
    updatedAt: formatDate(offer?.updatedAt, locale),
    paymentTerms: offer?.paymentTerms || '',
    deliveryTerms: offer?.deliveryTerms || '',
    leadTime: offer?.leadTime || '',
    notes: offer?.notes || '',
  };
}

function buildSchema() {
  return [
    { kind: 'section', title: 'Offer' },
    { name: 'number', label: 'Number', type: 'text', cols: 2, disabled: true },
    { name: 'status', label: 'Status', type: 'text', cols: 2, disabled: true },
    { name: 'currency', label: 'Currency', type: 'text', cols: 2, disabled: true },

    { kind: 'section', title: 'Counterparty' },
    { name: 'counterpartyName', label: 'Counterparty', type: 'text', cols: 2, disabled: true },
    { name: 'contactName', label: 'Contact', type: 'text', cols: 2, disabled: true },
    { name: 'ownerName', label: 'Owner', type: 'text', cols: 2, disabled: true },
    { name: 'dealName', label: 'Deal', type: 'text', cols: 2, disabled: true },

    { kind: 'section', title: 'Dates' },
    { name: 'issueDate', label: 'Issue date', type: 'text', cols: 2, disabled: true },
    { name: 'validUntil', label: 'Valid until', type: 'text', cols: 2, disabled: true },
    { name: 'createdAt', label: 'Created at', type: 'text', cols: 2, disabled: true },
    { name: 'updatedAt', label: 'Updated at', type: 'text', cols: 2, disabled: true },

    { kind: 'section', title: 'Terms & notes' },
    { name: 'paymentTerms', label: 'Payment terms', type: 'text', cols: 2, disabled: true },
    { name: 'deliveryTerms', label: 'Delivery terms', type: 'text', cols: 2, disabled: true },
    { name: 'leadTime', label: 'Lead time', type: 'text', cols: 2, disabled: true },
    { name: 'notes', label: 'Notes', type: 'textarea', cols: 4, rows: 4, disabled: true },
  ];
}

function collectOfferInvoices(data) {
  const list = [];
  if (Array.isArray(data?.invoices)) {
    list.push(...data.invoices.filter(Boolean));
  }
  if (data?.convertedInvoice) {
    list.push(data.convertedInvoice);
  }
  const map = new Map();
  list.forEach((item) => {
    if (item?.id && !map.has(item.id)) map.set(item.id, item);
  });
  return [...map.values()];
}

function OfferRightTabs({ tab, data, locale, actions, loadingKey, actionError, onAction, t }) {
  const items = Array.isArray(data?.items) ? data.items : [];
  const currency = data?.currency || data?.currencyCode || 'PLN';

  if (tab === 'items') {
    return (
      <section className={s.section}>
        <h3 className={s.sectionTitle}>Items</h3>
        {!items.length ? (
          <p className={s.empty}>No items in this offer.</p>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th className={s.textRight}>Qty</th>
                  <th className={s.textRight}>Price net</th>
                  <th className={s.textRight}>VAT %</th>
                  <th className={s.textRight}>Line gross</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const taxRate = asNumber(item?.vatRateSnapshot ?? item?.vatRate ?? item?.taxRate) ?? 0;
                  return (
                    <tr key={item.id || `${itemName(item)}-${item.sortOrder || 0}`}>
                      <td>{itemName(item)}</td>
                      <td className={s.textRight}>{formatQty(item?.qty ?? item?.quantity, locale)}</td>
                      <td className={s.textRight}>{formatMoney(item?.priceNet ?? item?.unitPriceNet, currency, locale)}</td>
                      <td className={s.textRight}>{formatQty(taxRate, locale)}</td>
                      <td className={s.textRight}>{formatMoney(item?.lineTotalGross, currency, locale)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  if (tab === 'summary') {
    return (
      <section className={s.section}>
        <h3 className={s.sectionTitle}>Summary</h3>
        <div className={s.kvList}>
          <div className={s.kvRow}><span className={s.kvLabel}>Net</span><span className={s.kvValue}>{formatMoney(data?.subtotalNet ?? data?.totalNet, currency, locale)}</span></div>
          <div className={s.kvRow}><span className={s.kvLabel}>VAT</span><span className={s.kvValue}>{formatMoney(data?.totalVat ?? data?.totalTax, currency, locale)}</span></div>
          <div className={s.kvRow}><span className={s.kvLabel}>Gross</span><span className={s.kvValue}>{formatMoney(data?.totalGross, currency, locale)}</span></div>
          <div className={s.kvRow}><span className={s.kvLabel}>Currency</span><span className={s.kvValue}>{currency}</span></div>
        </div>
      </section>
    );
  }

  if (tab === 'relations') {
    const counterparty = data?.counterparty || null;
    const contact = data?.contact || null;
    const convertedOrder = data?.convertedOrder || null;
    const invoices = collectOfferInvoices(data);
    const hasAny = Boolean(counterparty || contact || convertedOrder || invoices.length);

    return (
      <section className={s.section}>
        <h3 className={s.sectionTitle}>{t('oms.relations.title', 'Relations')}</h3>

        {!hasAny ? (
          <p className={s.empty}>{t('oms.relations.empty', 'No related entities')}</p>
        ) : (
          <div className={s.kvList}>
            <div className={s.kvRow}>
              <span className={s.kvLabel}>{t('oms.relations.convertedOrder', 'Converted order')}</span>
              <span className={`${s.kvValue} ${s.kvValueLeft}`}>
                {convertedOrder?.id ? (
                  <Link className={s.entityLink} to={`/main/oms/orders/${convertedOrder.id}`}>
                    {convertedOrder.number || convertedOrder.id}
                  </Link>
                ) : (
                  data?.convertedOrderId ? (
                    <Link className={s.entityLink} to={`/main/oms/orders/${data.convertedOrderId}`}>
                      {data.convertedOrderId}
                    </Link>
                  ) : '—'
                )}
              </span>
            </div>

            <div className={s.kvRow}>
              <span className={s.kvLabel}>{t('oms.relations.invoices', 'Invoices')}</span>
              <span className={`${s.kvValue} ${s.kvValueLeft}`}>
                {invoices.length ? (
                  <span className={s.inlineLinks}>
                    {invoices.map((invoice) => (
                      <Link key={invoice.id} className={s.entityLink} to={`/main/documents/${invoice.id}`}>
                        {invoice.number || invoice.id}
                      </Link>
                    ))}
                  </span>
                ) : (
                  '—'
                )}
              </span>
            </div>

            <div className={s.kvRow}>
              <span className={s.kvLabel}>{t('oms.relations.counterparty', 'Counterparty')}</span>
              <span className={`${s.kvValue} ${s.kvValueLeft}`}>
                {counterparty?.id ? (
                  <Link className={s.entityLink} to={`/main/counterparties/${counterparty.id}`}>
                    {counterparty.name || counterparty.shortName || counterparty.fullName || counterparty.id}
                  </Link>
                ) : (
                  '—'
                )}
              </span>
            </div>

            <div className={s.kvRow}>
              <span className={s.kvLabel}>{t('oms.relations.contact', 'Contact')}</span>
              <span className={`${s.kvValue} ${s.kvValueLeft}`}>
                {contact?.id ? (
                  <Link className={s.entityLink} to={`/main/contacts/${contact.id}`}>
                    {contact.name || contact.email || contact.id}
                  </Link>
                ) : (
                  contact?.name || contact?.email || '—'
                )}
              </span>
            </div>
          </div>
        )}
      </section>
    );
  }

  if (tab === 'actions') {
    return (
      <section className={s.section}>
        <h3 className={s.sectionTitle}>Actions</h3>
        <OmsStatusActionsMenu
          actions={actions}
          loadingKey={loadingKey}
          error={actionError}
          onAction={onAction}
        />
      </section>
    );
  }

  return null;
}

export default function OfferDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const tabs = useMemo(() => buildTabs(t), [t]);
  const [actionLoadingKey, setActionLoadingKey] = useState('');
  const [actionError, setActionError] = useState('');

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

  const runAction = useCallback(async (key, runner, { redirect } = {}) => {
    if (!id) return;
    setActionError('');
    setActionLoadingKey(key);
    try {
      const result = await runner().unwrap();
      if (typeof redirect === 'function') {
        const target = redirect(result);
        if (target) {
          navigate(target);
          return;
        }
      }
      await refetch();
    } catch (err) {
      const message = getErrorText(err, 'Failed to run action');
      setActionError(message);
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(message);
      }
    } finally {
      setActionLoadingKey('');
    }
  }, [id, navigate, refetch]);

  const actions = useMemo(() => {
    const available = base?.availableActions || {};
    return [
      {
        key: 'send',
        label: 'Send',
        enabled: Boolean(available.canSend),
      },
      {
        key: 'accept',
        label: 'Accept',
        enabled: Boolean(available.canAccept),
      },
      {
        key: 'reject',
        label: 'Reject',
        enabled: Boolean(available.canReject),
        destructive: true,
        confirm: {
          title: 'Reject offer',
          text: 'Reject this offer?',
          okText: 'Reject',
        },
      },
      {
        key: 'cancel',
        label: 'Cancel',
        enabled: Boolean(available.canCancel),
        destructive: true,
        confirm: {
          title: 'Cancel offer',
          text: 'Cancel this offer?',
          okText: 'Cancel offer',
        },
      },
      {
        key: 'expire',
        label: 'Expire',
        enabled: Boolean(available.canExpire),
      },
      {
        key: 'duplicate',
        label: 'Duplicate',
        enabled: Boolean(available.canDuplicate),
      },
      {
        key: 'convert-to-order',
        label: 'Convert to order',
        enabled: Boolean(available.canConvertToOrder),
      },
    ];
  }, [base?.availableActions]);

  const handleAction = useCallback((action) => {
    if (!action?.key) return;
    if (action.key === 'send') {
      runAction('send', () => sendOffer({ id, payload: {} }));
      return;
    }
    if (action.key === 'accept') {
      runAction('accept', () => acceptOffer({ id, payload: {} }));
      return;
    }
    if (action.key === 'reject') {
      runAction('reject', () => rejectOffer({ id, payload: {} }));
      return;
    }
    if (action.key === 'cancel') {
      runAction('cancel', () => cancelOffer({ id, payload: {} }));
      return;
    }
    if (action.key === 'expire') {
      runAction('expire', () => expireOffer({ id, payload: {} }));
      return;
    }
    if (action.key === 'duplicate') {
      runAction('duplicate', () => duplicateOffer({ id, payload: {} }), {
        redirect: (result) => {
          const newId = result?.id || result?.data?.id;
          return newId ? `/main/oms/offers/${newId}` : null;
        },
      });
      return;
    }
    if (action.key === 'convert-to-order') {
      runAction('convert-to-order', () => convertOfferToOrder({ id, payload: {} }), {
        redirect: (result) => {
          const newOrderId = result?.order?.id || result?.data?.order?.id;
          return newOrderId ? `/main/oms/orders/${newOrderId}` : null;
        },
      });
    }
  }, [
    id,
    runAction,
    sendOffer,
    acceptOffer,
    rejectOffer,
    cancelOffer,
    expireOffer,
    duplicateOffer,
    convertOfferToOrder,
  ]);

  const schemaBuilder = useCallback(() => buildSchema(), []);
  const toForm = useCallback((entity) => toFormOffer(entity, t, i18n.language), [t, i18n.language]);
  const load = useCallback(async () => base, [base]);
  const save = useCallback(async (_id, payload) => payload, []);

  const rightTabs = useCallback(
    ({ tab, data }) => (
      <OfferRightTabs
        tab={tab}
        data={data}
        locale={i18n.language}
        actions={actions}
        loadingKey={actionLoadingKey}
        actionError={actionError}
        onAction={handleAction}
        t={t}
      />
    ),
    [i18n.language, actions, actionLoadingKey, actionError, handleAction, t]
  );

  const totalText = useMemo(
    () => formatMoney(base?.totalGross, base?.currency || base?.currencyCode || 'PLN', i18n.language),
    [base?.totalGross, base?.currency, base?.currencyCode, i18n.language]
  );

  if (isLoading || isFetching) {
    return <div style={{ padding: 16, color: 'var(--ui-text-2)' }}>{t('common.loading', 'Loading...')}</div>;
  }

  if (isError) {
    const message = error?.data?.message || error?.data?.error || error?.message || 'Failed to load offer';
    return <div style={{ padding: 16, color: 'var(--danger)' }}>{message}</div>;
  }

  if (!base) {
    return <div style={{ padding: 16, color: 'var(--ui-text-2)' }}>Offer not found</div>;
  }

  return (
    <EntityDetailPage
      id={id}
      tabs={tabs}
      tabsNamespace="oms.offer.detail"
      schemaBuilder={schemaBuilder}
      toForm={toForm}
      toApi={(vals) => vals}
      load={load}
      save={save}
      storageKeyPrefix="offer-readonly"
      autosave={{ debounceMs: 1000 }}
      saveOnExit={false}
      clearDraftOnUnmount
      leftTop={(
        <div className={s.headerCard}>
          <div className={s.eyebrow}>Offer</div>
          <div className={s.titleRow}>
            <h1 className={s.title}>{base.number || `#${String(base.id || '').slice(0, 8)}`}</h1>
            <span className={s.statusBadge}>{statusLabel(base.status, t)}</span>
          </div>
          <div className={s.total}>{totalText}</div>
        </div>
      )}
      RightTabsComponent={rightTabs}
    />
  );
}
