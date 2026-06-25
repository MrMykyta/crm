import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import {
  Workspace,
  useWorkspaceData,
} from '../../../../components/workspace';
import AddButton from '../../../../components/buttons/AddButton/AddButton';
import { SearchField, SelectField } from '../../../../components/ui/fields';
import useGridPrefs from '../../../../hooks/useGridPrefs';
import useAclPermissions from '../../../../hooks/useAclPermissions';
import { createOrdersColumns } from '../../../../components/workspace/columnSchemas/ordersColumns';
import { useListOrdersQuery } from '../../../../store/rtk/ordersApi';

const STATUS_OPTIONS = [
  '',
  'draft',
  'new',
  'confirmed',
  'paid',
  'shipped',
  'completed',
  'cancelled',
  'returned',
];

const sanitizeQuery = (query = {}) => Object.fromEntries(
  Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '')
);

export default function OrdersListPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { can } = useAclPermissions();
  const canReadOrders = can('order:read');
  const canCreateOrders = can('order:create');

  const {
    colWidths,
    colOrder,
    colVisibility,
    onColumnResize,
    onColumnOrderChange,
    onColumnVisibilityChange,
  } = useGridPrefs('oms.orders');

  const openDetail = useCallback(
    (id) => {
      if (!id) return;
      navigate(`/main/oms/orders/${id}`);
    },
    [navigate]
  );

  const columns = useMemo(
    () => createOrdersColumns({ onOpenDetail: openDetail, t, locale: i18n.language }),
    [openDetail, t, i18n.language]
  );

  const statusOptions = useMemo(
    () => STATUS_OPTIONS.map((value) => ({
      value,
      label: value ? t(`statuses.${value}`, value) : t('common.none', '—'),
    })),
    [t]
  );

  const defaultQuery = useMemo(
    () => ({ page: 1, sort: 'updatedAt', dir: 'DESC', limit: 25 }),
    []
  );
  const [query, setQuery] = useState(defaultQuery);
  const apiQuery = useMemo(() => sanitizeQuery(query), [query]);
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
  const ordersTotal = Number(ordersData?.total ?? loadedOrders.length ?? 0);
  const hasAnyFilter = Boolean(query.search || query.status);

  const workspaceData = useWorkspaceData({
    externalData: loadedOrders,
    externalMeta: {
      total: ordersTotal,
      page: ordersData?.page || query.page || defaultQuery.page,
      limit: ordersData?.limit || query.limit || defaultQuery.limit,
    },
    externalLoading: ordersLoading,
    externalError: ordersError,
    onExternalRefetch: refetchOrders,
    query,
    onQueryChange: setQuery,
    defaultQuery,
  });

  const updateFilter = useCallback((key, value) => {
    setQuery((prev) => ({
      ...prev,
      [key]: value || undefined,
      page: 1,
    }));
  }, []);

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

  const workspaceColumns = useMemo(() => columns.map((column) => ({
    ...column,
    fallbackLabel: column.title,
    category: column.managerGroup || 'core',
    minWidth: Math.max(110, Math.min(Number(column.width) || 180, 180)),
    maxWidth: 560,
    required: column.key === 'number',
    numeric: column.align === 'right',
  })), [columns]);

  const renderCell = useCallback((row, column) => {
    if (typeof column.render === 'function') return column.render(row);
    const value = row?.[column.key];
    return value == null || value === '' ? '—' : String(value);
  }, []);

  const workspaceControls = useMemo(() => [
    {
      key: 'search',
      kind: 'search',
      label: t('common.search', 'Search'),
      control: (
        <SearchField
          value={query.search || ''}
          onValueChange={(value) => updateFilter('search', value)}
          placeholder={t('oms.orders.search', 'Search by number or counterparty...')}
          size="sm"
          clearable
          fullWidth={false}
        />
      ),
    },
    {
      key: 'status',
      label: t('common.status', 'Status'),
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
  ], [query.search, query.status, statusOptions, t, updateFilter]);

  const workspaceLabels = useMemo(() => ({
    loading: t('common.loading', 'Loading'),
    errorTitle: t('oms.orders.errorTitle', 'Failed to load orders'),
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
    return (
      <div style={{ padding: 16, color: 'var(--ui-text-2)' }}>
        {t('common.noPermission', 'No permission')}
      </div>
    );
  }

  return (
    <Workspace
      title={t('oms.orders.title', t('menu.orders'))}
      badge={t('oms.orders.workspaceCount', {
        count: workspaceData.total,
        defaultValue: `${workspaceData.total}`,
      })}
      actions={(
        <AddButton
          onClick={() => navigate('/main/oms/orders/new')}
          disabled={!canCreateOrders}
          title={!canCreateOrders ? t('common.noPermission', 'No permission') : undefined}
        >
          {t('oms.orders.add', 'Add order')}
        </AddButton>
      )}
      controls={workspaceControls}
      rows={workspaceData.rows}
      columns={workspaceColumns}
      loading={workspaceData.loading}
      error={workspaceData.error}
      onRetry={workspaceData.refetch}
      onRefetch={workspaceData.refetch}
      renderCell={renderCell}
      getRowId={(row) => row?.id}
      getRowKey={(row) => String(row?.id || row?.number || '')}
      onRowClick={(row) => row?.id && openDetail(row.id)}
      sortKey={workspaceData.query.sort}
      sortDir={workspaceData.query.dir}
      onSort={workspaceData.setSort}
      columnState={columnState}
      onColumnStateChange={handleColumnStateChange}
      emptyState={{
        title: t(
          hasAnyFilter ? 'oms.orders.emptyFilteredTitle' : 'oms.orders.emptyTitle',
          hasAnyFilter ? 'Orders not found' : 'No orders'
        ),
        description: t(
          hasAnyFilter ? 'oms.orders.emptyFilteredText' : 'oms.orders.emptyText',
          hasAnyFilter ? 'Change search or filters.' : 'Create the first order.'
        ),
      }}
      errorState={{
        title: t('oms.orders.errorTitle', 'Failed to load orders'),
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
