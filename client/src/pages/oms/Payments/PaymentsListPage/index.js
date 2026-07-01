import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import {
  Workspace,
  useWorkspaceData,
} from '../../../../components/workspace';
import LinkCell from '../../../../components/cells/LinkCell';
import { SearchField, SelectField } from '../../../../components/ui/fields';
import useGridPrefs from '../../../../hooks/useGridPrefs';
import useAclPermissions from '../../../../hooks/useAclPermissions';
import {
  useLazyGetOrderByIdQuery,
  useListOrdersQuery,
} from '../../../../store/rtk/ordersApi';

const DIRECTION_OPTIONS = ['', 'inbound', 'refund'];
const STATUS_OPTIONS = ['', 'pending', 'authorized', 'paid', 'failed', 'refunded'];

const sanitizeQuery = (query = {}) => Object.fromEntries(
  Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '')
);

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function asNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDateTime(value, locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(+date)) return '—';
  return date.toLocaleString(locale || undefined);
}

function formatMoney(value, currency = 'PLN', locale) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `${number.toLocaleString(locale || undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency || 'PLN'}`;
}

function customerName(order) {
  const counterparty = order?.counterparty || order?.customer;
  return counterparty?.shortName || counterparty?.fullName || counterparty?.name || order?.customerName || '—';
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
  };
}

function buildPaymentRows(orderDetails = []) {
  return orderDetails
    .flatMap((order) => (Array.isArray(order?.payments) ? order.payments.map((payment) => normalizePayment(payment, order)) : []))
    .filter(Boolean)
    .sort((a, b) => new Date(b.paidAt || b.processedAt || b.createdAt || 0) - new Date(a.paidAt || a.processedAt || a.createdAt || 0));
}

export default function PaymentsListPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const navigate = useNavigate();
  const { can } = useAclPermissions();
  const canReadOrders = can('order:read');
  const [detailsByOrderId, setDetailsByOrderId] = useState({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [triggerOrderDetail] = useLazyGetOrderByIdQuery();

  const {
    colWidths,
    colOrder,
    colVisibility,
    onColumnResize,
    onColumnOrderChange,
    onColumnVisibilityChange,
  } = useGridPrefs('oms.payments');

  const defaultQuery = useMemo(
    () => ({ page: 1, sort: 'updatedAt', dir: 'DESC', limit: 25 }),
    []
  );
  const [query, setQuery] = useState(defaultQuery);
  const apiQuery = useMemo(() => sanitizeQuery({
    page: query.page,
    limit: query.limit,
    search: query.search,
    sort: 'updatedAt',
    dir: 'DESC',
  }), [query.limit, query.page, query.search]);

  const {
    data: ordersData,
    isFetching: ordersLoading,
    error: ordersError,
    refetch: refetchOrders,
  } = useListOrdersQuery(apiQuery, { skip: !canReadOrders });

  const loadedOrders = useMemo(() => {
    if (Array.isArray(ordersData)) return ordersData;
    if (Array.isArray(ordersData?.items)) return ordersData.items;
    if (Array.isArray(ordersData?.data)) return ordersData.data;
    return [];
  }, [ordersData]);

  useEffect(() => {
    let active = true;
    const orderIds = loadedOrders.map((order) => order?.id).filter(Boolean);
    if (!canReadOrders || !orderIds.length) {
      setDetailLoading(false);
      return () => { active = false; };
    }
    const missingIds = orderIds.filter((id) => !detailsByOrderId[id]);
    if (!missingIds.length) {
      setDetailLoading(false);
      return () => { active = false; };
    }

    setDetailLoading(true);
    Promise.allSettled(missingIds.map((id) => triggerOrderDetail(id, true).unwrap()))
      .then((results) => {
        if (!active) return;
        setDetailsByOrderId((prev) => {
          const next = { ...prev };
          results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value?.id) {
              next[result.value.id] = result.value;
            }
          });
          return next;
        });
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => { active = false; };
  }, [canReadOrders, detailsByOrderId, loadedOrders, triggerOrderDetail]);

  const payments = useMemo(() => buildPaymentRows(Object.values(detailsByOrderId)), [detailsByOrderId]);
  const filteredPayments = useMemo(() => {
    const needle = asText(query.search).toLowerCase();
    const direction = asText(query.direction).toLowerCase();
    const status = asText(query.status).toLowerCase();
    return payments.filter((payment) => {
      if (direction && asText(payment.direction || 'inbound').toLowerCase() !== direction) return false;
      if (status && asText(payment.status).toLowerCase() !== status) return false;
      if (!needle) return true;
      return [
        payment.reference,
        payment.method,
        payment.status,
        payment.customerName,
        payment.order?.number,
        payment.id,
      ].some((value) => asText(value).toLowerCase().includes(needle));
    });
  }, [payments, query.direction, query.search, query.status]);

  const workspaceData = useWorkspaceData({
    externalData: filteredPayments,
    externalMeta: {
      total: filteredPayments.length,
      page: query.page || defaultQuery.page,
      limit: query.limit || defaultQuery.limit,
    },
    externalLoading: ordersLoading || detailLoading,
    externalError: ordersError,
    onExternalRefetch: refetchOrders,
    query,
    onQueryChange: setQuery,
    defaultQuery,
  });

  const openDetail = useCallback((payment) => {
    if (!payment?.id) return;
    const suffix = payment.orderId ? `?orderId=${encodeURIComponent(payment.orderId)}` : '';
    navigate(`/main/oms/payments/${encodeURIComponent(payment.id)}${suffix}`);
  }, [navigate]);

  const updateFilter = useCallback((key, value) => {
    setQuery((prev) => ({
      ...prev,
      [key]: value || undefined,
      page: 1,
    }));
  }, []);

  const directionOptions = useMemo(
    () => DIRECTION_OPTIONS.map((value) => ({
      value,
      label: value ? directionLabel(value, t) : t('common.all', 'All'),
    })),
    [t]
  );
  const statusOptions = useMemo(
    () => STATUS_OPTIONS.map((value) => ({
      value,
      label: value ? statusLabel(value, t) : t('common.all', 'All'),
    })),
    [t]
  );

  const columns = useMemo(() => [
    {
      key: 'reference',
      title: t('oms.payments.columns.reference'),
      fallbackLabel: t('oms.payments.columns.reference'),
      category: 'core',
      width: 220,
      minWidth: 160,
      required: true,
      render: (row) => (
        <LinkCell
          primary={row.reference || row.id}
          secondary={row.customerName}
          onClick={() => openDetail(row)}
          ariaLabel={t('oms.payments.open')}
        />
      ),
    },
    {
      key: 'amount',
      title: t('oms.payments.columns.amount'),
      fallbackLabel: t('oms.payments.columns.amount'),
      category: 'core',
      width: 150,
      minWidth: 130,
      numeric: true,
      render: (row) => formatMoney(row.amount, row.currencyCode, locale),
    },
    {
      key: 'allocatedAmount',
      title: t('oms.payments.columns.allocated'),
      fallbackLabel: t('oms.payments.columns.allocated'),
      category: 'core',
      width: 150,
      minWidth: 130,
      numeric: true,
      render: (row) => formatMoney(row.allocatedAmount, row.currencyCode, locale),
    },
    {
      key: 'unappliedAmount',
      title: t('oms.payments.columns.unapplied'),
      fallbackLabel: t('oms.payments.columns.unapplied'),
      category: 'core',
      width: 150,
      minWidth: 130,
      numeric: true,
      render: (row) => formatMoney(row.unappliedAmount, row.currencyCode, locale),
    },
    {
      key: 'direction',
      title: t('oms.payments.columns.direction'),
      fallbackLabel: t('oms.payments.columns.direction'),
      category: 'core',
      width: 120,
      minWidth: 110,
      render: (row) => directionLabel(row.direction, t),
    },
    {
      key: 'status',
      title: t('oms.payments.columns.status'),
      fallbackLabel: t('oms.payments.columns.status'),
      category: 'core',
      width: 130,
      minWidth: 110,
      render: (row) => statusLabel(row.status, t),
    },
    {
      key: 'applicationStatus',
      title: t('oms.payments.columns.application'),
      fallbackLabel: t('oms.payments.columns.application'),
      category: 'context',
      width: 160,
      minWidth: 140,
      render: (row) => applicationStatus(row, t),
    },
    {
      key: 'date',
      title: t('oms.payments.columns.date'),
      fallbackLabel: t('oms.payments.columns.date'),
      category: 'context',
      width: 170,
      minWidth: 140,
      render: (row) => formatDateTime(row.paidAt || row.processedAt || row.createdAt, locale),
    },
  ], [locale, openDetail, t]);

  const columnState = useMemo(() => ({
    widths: colWidths,
    order: colOrder,
    visibility: colVisibility,
  }), [colOrder, colVisibility, colWidths]);

  const handleColumnStateChange = useCallback((next = {}) => {
    onColumnResize(next.widths || {});
    onColumnOrderChange(Array.isArray(next.order) ? next.order : []);
    onColumnVisibilityChange(next.visibility || {});
  }, [onColumnOrderChange, onColumnResize, onColumnVisibilityChange]);

  const workspaceControls = useMemo(() => [
    {
      key: 'search',
      kind: 'search',
      label: t('common.search', 'Search'),
      control: (
        <SearchField
          value={query.search || ''}
          onValueChange={(value) => updateFilter('search', value)}
          placeholder={t('oms.payments.search')}
          size="sm"
          clearable
          fullWidth={false}
        />
      ),
    },
    {
      key: 'direction',
      label: t('oms.payments.columns.direction'),
      control: (
        <SelectField
          value={query.direction || ''}
          onValueChange={(value) => updateFilter('direction', value)}
          options={directionOptions}
          size="sm"
          fullWidth={false}
        />
      ),
    },
    {
      key: 'status',
      label: t('oms.payments.columns.status'),
      control: (
        <SelectField
          value={query.status || ''}
          onValueChange={(value) => updateFilter('status', value)}
          options={statusOptions}
          size="sm"
          fullWidth={false}
        />
      ),
    },
  ], [directionOptions, query.direction, query.search, query.status, statusOptions, t, updateFilter]);

  const workspaceLabels = useMemo(() => ({
    loading: t('common.loading', 'Loading'),
    errorTitle: t('oms.payments.errorTitle'),
    retry: t('list.refresh', 'Refresh'),
    resetColumns: t('list.columns.reset', 'Reset'),
    columnsMenu: t('list.columns.configureShort', 'Columns'),
    showAllColumns: t('list.columns.configure', 'Show all'),
    showTechnicalColumns: t('list.columns.groupSystem', 'System'),
    hideTechnicalColumns: t('list.columns.hideAdditional', 'Hide extra'),
    requiredColumn: t('list.columns.recommended', 'Recommended'),
    visibleColumns: (count) => t('list.columns.visibleCount', { count }),
    groupLabel: (group) => {
      if (group === 'context') return t('list.columns.groupAdditional', 'Additional');
      if (group === 'technical') return t('list.columns.groupSystem', 'System');
      return t('list.columns.groupMain', 'Main');
    },
    columnLabel: (column) => column.fallbackLabel || column.title || column.key,
  }), [t]);

  if (!canReadOrders) {
    return <div style={{ padding: 16, color: 'var(--ui-text-2)' }}>{t('common.noPermission')}</div>;
  }

  return (
    <Workspace
      title={t('oms.payments.title')}
      badge={t('oms.payments.workspaceCount', {
        count: workspaceData.total,
        defaultValue: `${workspaceData.total}`,
      })}
      controls={workspaceControls}
      rows={workspaceData.rows}
      columns={columns}
      loading={workspaceData.loading}
      error={workspaceData.error}
      onRetry={workspaceData.refetch}
      onRefetch={workspaceData.refetch}
      renderCell={(row, column) => (typeof column.render === 'function' ? column.render(row) : row?.[column.key] || '—')}
      getRowId={(row) => row?.id}
      getRowKey={(row) => String(row?.id || '')}
      onRowClick={openDetail}
      sortKey={workspaceData.query.sort}
      sortDir={workspaceData.query.dir}
      onSort={workspaceData.setSort}
      columnState={columnState}
      onColumnStateChange={handleColumnStateChange}
      emptyState={{
        title: t('oms.payments.emptyTitle'),
        description: t('oms.payments.emptyText'),
      }}
      errorState={{
        title: t('oms.payments.errorTitle'),
        description: String(
          ordersError?.data?.message
          || ordersError?.data?.error
          || ordersError?.message
          || t('common.error', 'Error')
        ),
        retryLabel: t('list.refresh', 'Refresh'),
      }}
      labels={workspaceLabels}
      pagination={workspaceData.pagination}
    />
  );
}
