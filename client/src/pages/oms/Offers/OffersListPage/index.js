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
import { createOffersColumns } from '../../../../components/workspace/columnSchemas/offersColumns';
import { useListOffersQuery } from '../../../../store/rtk/offersApi';

const STATUS_OPTIONS = ['', 'draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'cancelled'];

const sanitizeQuery = (query = {}) => Object.fromEntries(
  Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '')
);

export default function OffersListPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { can } = useAclPermissions();
  const canReadOffers = can('offer:read');
  const canCreateOffers = can('offer:create');

  const {
    colWidths,
    colOrder,
    colVisibility,
    onColumnResize,
    onColumnOrderChange,
    onColumnVisibilityChange,
  } = useGridPrefs('oms.offers');

  const openDetail = useCallback(
    (id) => {
      if (!id) return;
      navigate(`/main/oms/offers/${id}`);
    },
    [navigate]
  );

  const columns = useMemo(
    () => createOffersColumns({ onOpenDetail: openDetail, t, locale: i18n.language }),
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
    data: offersData,
    isFetching: offersLoading,
    error: offersError,
    refetch: refetchOffers,
  } = useListOffersQuery(apiQuery, { skip: !canReadOffers });

  const loadedOffers = useMemo(() => {
    if (Array.isArray(offersData)) return offersData;
    if (Array.isArray(offersData?.items)) return offersData.items;
    if (Array.isArray(offersData?.data)) return offersData.data;
    return [];
  }, [offersData]);
  const offersTotal = Number(offersData?.total ?? loadedOffers.length ?? 0);
  const hasAnyFilter = Boolean(query.search || query.status);

  const workspaceData = useWorkspaceData({
    externalData: loadedOffers,
    externalMeta: {
      total: offersTotal,
      page: offersData?.page || query.page || defaultQuery.page,
      limit: offersData?.limit || query.limit || defaultQuery.limit,
    },
    externalLoading: offersLoading,
    externalError: offersError,
    onExternalRefetch: refetchOffers,
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
          placeholder={t('oms.offers.search', 'Search by number or counterparty...')}
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
    errorTitle: t('oms.offers.errorTitle', 'Failed to load offers'),
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

  if (!canReadOffers) {
    return (
      <div style={{ padding: 16, color: 'var(--ui-text-2)' }}>
        {t('common.noPermission', 'No permission')}
      </div>
    );
  }

  return (
    <Workspace
      title={t('oms.offers.title', t('menu.offers'))}
      badge={t('oms.offers.workspaceCount', {
        count: workspaceData.total,
        defaultValue: `${workspaceData.total}`,
      })}
      actions={(
        <AddButton
          onClick={() => navigate('/main/oms/offers/new')}
          disabled={!canCreateOffers}
          title={!canCreateOffers ? t('common.noPermission', 'No permission') : undefined}
        >
          {t('oms.offers.add', 'Add offer')}
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
          hasAnyFilter ? 'oms.offers.emptyFilteredTitle' : 'oms.offers.emptyTitle',
          hasAnyFilter ? 'Offers not found' : 'No offers'
        ),
        description: t(
          hasAnyFilter ? 'oms.offers.emptyFilteredText' : 'oms.offers.emptyText',
          hasAnyFilter ? 'Change search or filters.' : 'Create the first offer.'
        ),
      }}
      errorState={{
        title: t('oms.offers.errorTitle', 'Failed to load offers'),
        description: String(
          offersError?.data?.message
          || offersError?.data?.error
          || offersError?.message
          || t('common.error', 'Error')
        ),
        retryLabel: t('list.refresh', 'Refresh'),
      }}
      labels={workspaceLabels}
      pagination={workspaceData.pagination}
    />
  );
}
