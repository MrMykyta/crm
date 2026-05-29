import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import EntityDetailPage from '../../../_scaffold/EntityDetailPage';
import OmsStatusActionsMenu from '../../../../components/oms/OmsStatusActionsMenu';
import useAclPermissions from '../../../../hooks/useAclPermissions';
import {
  useCancelOrderMutation,
  useCompleteOrderMutation,
  useConfirmOrderMutation,
  useConvertOrderToInvoiceMutation,
  useGetOrderByIdQuery,
  useReturnOrderMutation,
  useShipOrderMutation,
} from '../../../../store/rtk/ordersApi';
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

function toFormOrder(order, t, locale) {
  const counterparty = order?.counterparty || order?.customer;
  return {
    number: order?.number || '',
    status: statusLabel(order?.status, t),
    paymentStatus: statusLabel(order?.paymentStatus, t),
    fulfillmentStatus: statusLabel(order?.fulfillmentStatus, t),
    currencyCode: order?.currencyCode || '',
    totalNet: formatMoney(order?.totalNet, order?.currencyCode || 'PLN', locale),
    totalTax: formatMoney(order?.totalTax, order?.currencyCode || 'PLN', locale),
    totalGross: formatMoney(order?.totalGross, order?.currencyCode || 'PLN', locale),
    counterpartyName: counterparty?.name || counterparty?.shortName || counterparty?.fullName || '',
    contactName: order?.contact?.name || order?.contact?.email || '',
    ownerName: order?.owner?.name || order?.owner?.email || '',
    sourceOffer: order?.sourceOffer?.number || order?.sourceOfferId || '',
    placedAt: formatDate(order?.placedAt, locale),
    confirmedAt: formatDate(order?.statusMetadata?.confirmedAt, locale),
    createdAt: formatDate(order?.createdAt, locale),
    updatedAt: formatDate(order?.updatedAt, locale),
    paymentTerms: order?.paymentTerms || '',
    deliveryTerms: order?.deliveryTerms || '',
    leadTime: order?.leadTime || '',
    notes: order?.notes || '',
  };
}

function buildSchema() {
  return [
    { kind: 'section', title: 'Order' },
    { name: 'number', label: 'Number', type: 'text', cols: 2, disabled: true },
    { name: 'status', label: 'Status', type: 'text', cols: 2, disabled: true },
    { name: 'paymentStatus', label: 'Payment status', type: 'text', cols: 2, disabled: true },
    { name: 'fulfillmentStatus', label: 'Fulfillment status', type: 'text', cols: 2, disabled: true },

    { kind: 'section', title: 'Counterparty' },
    { name: 'counterpartyName', label: 'Counterparty', type: 'text', cols: 2, disabled: true },
    { name: 'contactName', label: 'Contact', type: 'text', cols: 2, disabled: true },
    { name: 'ownerName', label: 'Owner', type: 'text', cols: 2, disabled: true },
    { name: 'sourceOffer', label: 'Source offer', type: 'text', cols: 2, disabled: true },

    { kind: 'section', title: 'Dates' },
    { name: 'placedAt', label: 'Placed at', type: 'text', cols: 2, disabled: true },
    { name: 'confirmedAt', label: 'Confirmed at', type: 'text', cols: 2, disabled: true },
    { name: 'createdAt', label: 'Created at', type: 'text', cols: 2, disabled: true },
    { name: 'updatedAt', label: 'Updated at', type: 'text', cols: 2, disabled: true },

    { kind: 'section', title: 'Terms & notes' },
    { name: 'paymentTerms', label: 'Payment terms', type: 'text', cols: 2, disabled: true },
    { name: 'deliveryTerms', label: 'Delivery terms', type: 'text', cols: 2, disabled: true },
    { name: 'leadTime', label: 'Lead time', type: 'text', cols: 2, disabled: true },
    { name: 'currencyCode', label: 'Currency', type: 'text', cols: 2, disabled: true },
    { name: 'notes', label: 'Notes', type: 'textarea', cols: 4, rows: 4, disabled: true },
  ];
}

function renderInvoiceLinks(data) {
  const list = [];
  if (Array.isArray(data?.invoices)) {
    list.push(...data.invoices.filter(Boolean));
  }
  if (data?.invoice) {
    list.push(data.invoice);
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

function OrderRightTabs({ tab, data, locale, actions, loadingKey, actionError, onAction, t }) {
  const items = Array.isArray(data?.items) ? data.items : [];
  const currency = data?.currencyCode || 'PLN';

  if (tab === 'items') {
    return (
      <section className={s.section}>
        <h3 className={s.sectionTitle}>Items</h3>
        {!items.length ? (
          <p className={s.empty}>No items in this order.</p>
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
          <div className={s.kvRow}><span className={s.kvLabel}>Net</span><span className={s.kvValue}>{formatMoney(data?.totalNet, currency, locale)}</span></div>
          <div className={s.kvRow}><span className={s.kvLabel}>VAT</span><span className={s.kvValue}>{formatMoney(data?.totalTax, currency, locale)}</span></div>
          <div className={s.kvRow}><span className={s.kvLabel}>Gross</span><span className={s.kvValue}>{formatMoney(data?.totalGross, currency, locale)}</span></div>
          <div className={s.kvRow}><span className={s.kvLabel}>Currency</span><span className={s.kvValue}>{currency}</span></div>
        </div>
      </section>
    );
  }

  if (tab === 'relations') {
    const counterparty = data?.counterparty || data?.customer || null;
    const contact = data?.contact || null;
    const sourceOffer = data?.sourceOffer || null;
    const invoiceLinks = renderInvoiceLinks(data);
    const hasAny = Boolean(counterparty || contact || sourceOffer || invoiceLinks.length);

    return (
      <section className={s.section}>
        <h3 className={s.sectionTitle}>{t('oms.relations.title', 'Relations')}</h3>

        {!hasAny ? (
          <p className={s.empty}>{t('oms.relations.empty', 'No related entities')}</p>
        ) : (
          <div className={s.kvList}>
            <div className={s.kvRow}>
              <span className={s.kvLabel}>{t('oms.relations.sourceOffer', 'Source offer')}</span>
              <span className={`${s.kvValue} ${s.kvValueLeft}`}>
                {sourceOffer?.id ? (
                  <Link className={s.entityLink} to={`/main/oms/offers/${sourceOffer.id}`}>
                    {sourceOffer.number || sourceOffer.id}
                  </Link>
                ) : (
                  '—'
                )}
              </span>
            </div>

            <div className={s.kvRow}>
              <span className={s.kvLabel}>{t('oms.relations.invoices', 'Invoices')}</span>
              <span className={`${s.kvValue} ${s.kvValueLeft}`}>
                {invoiceLinks.length ? (
                  <span className={s.inlineLinks}>
                    {invoiceLinks.map((invoice) => (
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

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { can } = useAclPermissions();
  const canReadOrder = can('order:read');
  const canUpdateOrder = can('order:update');
  const canConvertOrder = can('order:convert');
  const tabs = useMemo(() => buildTabs(t), [t]);
  const [actionLoadingKey, setActionLoadingKey] = useState('');
  const [actionError, setActionError] = useState('');

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

  const runAction = useCallback(async (key, runner, options = {}) => {
    if (!id) return;
    setActionError('');
    setActionLoadingKey(key);
    try {
      const result = await runner().unwrap();
      const redirect = typeof options.redirect === 'function' ? options.redirect(result) : null;
      if (redirect) {
        navigate(redirect);
        return result;
      }
      await refetch();
      return result;
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
        key: 'confirm',
        label: 'Confirm',
        enabled: canUpdateOrder && Boolean(available.canConfirm),
      },
      {
        key: 'ship',
        label: 'Ship',
        enabled: canUpdateOrder && Boolean(available.canShip),
      },
      {
        key: 'complete',
        label: 'Complete',
        enabled: canUpdateOrder && Boolean(available.canComplete),
      },
      {
        key: 'cancel',
        label: 'Cancel',
        enabled: canUpdateOrder && Boolean(available.canCancel),
        destructive: true,
        confirm: {
          title: 'Cancel order',
          text: 'Cancel this order?',
          okText: 'Cancel order',
        },
      },
      {
        key: 'return',
        label: 'Return',
        enabled: canUpdateOrder && Boolean(available.canReturn),
        destructive: true,
        confirm: {
          title: 'Return order',
          text: 'Mark this order as returned?',
          okText: 'Return order',
        },
      },
      {
        key: 'convert-to-invoice',
        label: 'Convert to Invoice',
        enabled: canConvertOrder && Boolean(available.canConvertToInvoice),
      },
    ];
  }, [base?.availableActions, canConvertOrder, canUpdateOrder]);

  const handleAction = useCallback((action) => {
    if (!action?.key) return;
    if (action.key === 'confirm') {
      runAction('confirm', () => confirmOrder({ id, payload: {} }));
      return;
    }
    if (action.key === 'ship') {
      runAction('ship', () => shipOrder({ id, payload: {} }));
      return;
    }
    if (action.key === 'complete') {
      runAction('complete', () => completeOrder({ id, payload: {} }));
      return;
    }
    if (action.key === 'cancel') {
      runAction('cancel', () => cancelOrder({ id, payload: {} }));
      return;
    }
    if (action.key === 'return') {
      runAction('return', () => returnOrder({ id, payload: {} }));
      return;
    }
    if (action.key === 'convert-to-invoice') {
      runAction(
        'convert-to-invoice',
        () => convertOrderToInvoice({ id, payload: {} }),
        {
          redirect: (result) => {
            const invoiceId = result?.invoice?.id || result?.data?.invoice?.id;
            return invoiceId ? `/main/documents/${invoiceId}` : null;
          },
        }
      );
    }
  }, [
    id,
    runAction,
    confirmOrder,
    shipOrder,
    completeOrder,
    cancelOrder,
    returnOrder,
    convertOrderToInvoice,
  ]);

  const schemaBuilder = useCallback(() => buildSchema(), []);
  const toForm = useCallback((entity) => toFormOrder(entity, t, i18n.language), [t, i18n.language]);
  const load = useCallback(async () => base, [base]);
  const save = useCallback(async (_id, payload) => payload, []);

  const rightTabs = useCallback(
    ({ tab, data }) => (
      <OrderRightTabs
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
    () => formatMoney(base?.totalGross, base?.currencyCode || 'PLN', i18n.language),
    [base?.totalGross, base?.currencyCode, i18n.language]
  );

  if (!canReadOrder) {
    return <div style={{ padding: 16, color: 'var(--ui-text-2)' }}>{t('common.noPermission', 'No permission')}</div>;
  }

  if (isLoading || isFetching) {
    return <div style={{ padding: 16, color: 'var(--ui-text-2)' }}>{t('common.loading', 'Loading...')}</div>;
  }

  if (isError) {
    const message = error?.data?.message || error?.data?.error || error?.message || 'Failed to load order';
    return <div style={{ padding: 16, color: 'var(--danger)' }}>{message}</div>;
  }

  if (!base) {
    return <div style={{ padding: 16, color: 'var(--ui-text-2)' }}>Order not found</div>;
  }

  return (
    <EntityDetailPage
      id={id}
      tabs={tabs}
      tabsNamespace="oms.order.detail"
      schemaBuilder={schemaBuilder}
      toForm={toForm}
      toApi={(vals) => vals}
      load={load}
      save={save}
      storageKeyPrefix="order-readonly"
      autosave={{ debounceMs: 1000 }}
      saveOnExit={false}
      clearDraftOnUnmount
      leftTop={(
        <div className={s.headerCard}>
          <div className={s.eyebrow}>Order</div>
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
