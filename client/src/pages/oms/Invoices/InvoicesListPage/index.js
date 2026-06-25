import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import {
  Workspace,
  useWorkspaceData,
} from '../../../../components/workspace';
import { SearchField, SelectField } from '../../../../components/ui/fields';
import useGridPrefs from '../../../../hooks/useGridPrefs';
import useAclPermissions from '../../../../hooks/useAclPermissions';
import { createInvoicesColumns } from '../../../../components/workspace/columnSchemas/invoicesColumns';
import { useListInvoicesQuery } from '../../../../store/rtk/invoicesApi';

const STATUS_OPTIONS = ['', 'draft', 'issued', 'paid'];

const sanitizeQuery = (query = {}) => Object.fromEntries(
  Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '')
);

export default function InvoicesListPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { can } = useAclPermissions();
  const canReadInvoices = can('order:read');

  const {
    colWidths,
    colOrder,
    colVisibility,
    onColumnResize,
    onColumnOrderChange,
    onColumnVisibilityChange,
  } = useGridPrefs('oms.invoices');

  const openDetail = useCallback(
    (id) => {
      if (!id) return;
      navigate(`/main/oms/invoices/${id}`);
    },
    [navigate]
  );

  const columns = useMemo(
    () => createInvoicesColumns({ onOpenDetail: openDetail, t, locale: i18n.language }),
    [openDetail, t, i18n.language]
  );

  const statusOptions = useMemo(
    () => STATUS_OPTIONS.map((value) => ({
      value,
      label: value ? t(`statuses.${value}`) : t('common.none'),
    })),
    [t]
  );

  const defaultQuery = useMemo(
    () => ({ page: 1, sort: 'createdAt', dir: 'DESC', limit: 25 }),
    []
  );
  const [query, setQuery] = useState(defaultQuery);
  const apiQuery = useMemo(() => sanitizeQuery(query), [query]);
  const {
    data: invoicesData,
    isFetching: invoicesLoading,
    error: invoicesError,
    refetch: refetchInvoices,
  } = useListInvoicesQuery(apiQuery, { skip: !canReadInvoices });

  const loadedInvoices = useMemo(() => {
    if (Array.isArray(invoicesData)) return invoicesData;
    if (Array.isArray(invoicesData?.items)) return invoicesData.items;
    if (Array.isArray(invoicesData?.data)) return invoicesData.data;
    return [];
  }, [invoicesData]);
  const invoicesTotal = Number(invoicesData?.total ?? loadedInvoices.length ?? 0);
  const hasAnyFilter = Boolean(query.search || query.status);

  const workspaceData = useWorkspaceData({
    externalData: loadedInvoices,
    externalMeta: {
      total: invoicesTotal,
      page: invoicesData?.page || query.page || defaultQuery.page,
      limit: invoicesData?.limit || query.limit || defaultQuery.limit,
    },
    externalLoading: invoicesLoading,
    externalError: invoicesError,
    onExternalRefetch: refetchInvoices,
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
          placeholder={t('oms.invoices.search', 'Search invoices')}
          size="sm"
          clearable
          fullWidth={false}
        />
      ),
    },
    {
      key: 'status',
      label: t('oms.invoices.columns.status', 'Status'),
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
    errorTitle: t('oms.invoices.errorTitle', 'Failed to load invoices'),
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

  if (!canReadInvoices) {
    return (
      <div style={{ padding: 16, color: 'var(--ui-text-2)' }}>
        {t('common.noPermission')}
      </div>
    );
  }

  return (
    <Workspace
      title={t('oms.invoices.title')}
      badge={t('oms.invoices.workspaceCount', {
        count: workspaceData.total,
        defaultValue: `${workspaceData.total}`,
      })}
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
          hasAnyFilter ? 'oms.invoices.emptyFilteredTitle' : 'oms.invoices.emptyTitle',
          hasAnyFilter ? 'Invoices not found' : 'No invoices'
        ),
        description: t(
          hasAnyFilter ? 'oms.invoices.emptyFilteredText' : 'oms.invoices.emptyText',
          hasAnyFilter ? 'Change search or filters.' : 'Issue the first invoice from an order.'
        ),
      }}
      errorState={{
        title: t('oms.invoices.errorTitle', 'Failed to load invoices'),
        description: String(
          invoicesError?.data?.message
          || invoicesError?.data?.error
          || invoicesError?.message
          || t('common.error', 'Error')
        ),
        retryLabel: t('list.refresh', 'Refresh'),
      }}
      labels={workspaceLabels}
      pagination={workspaceData.pagination}
    />
  );
}
