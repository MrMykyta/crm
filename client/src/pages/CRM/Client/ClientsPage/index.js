import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  Workspace,
  useWorkspaceData,
} from '../../../../components/workspace';

import useGridPrefs from '../../../../hooks/useGridPrefs';
import useOpenAsModal from '../../../../hooks/useOpenAsModal';

import LinkCell from '../../../../components/cells/LinkCell';
import AddressCell from '../../../../components/cells/AddressCell';
import AddButton from '../../../../components/buttons/AddButton/AddButton';
import { SearchField, SelectField } from '../../../../components/ui/fields';

import {
  useListCounterpartiesQuery,
} from '../../../../store/rtk/counterpartyApi';

const sanitizeCounterpartyQuery = (query = {}) => Object.fromEntries(
  Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '')
);

/**
 * Страница списка клиентов:
 * настраивает колонки, фильтры и сохранённые представления.
 */
export default function ClientsPage() {
  const listRef = useRef(null);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const openAsModal = useOpenAsModal();

  // prefs таблицы — отдельный ключ под клиентов
  const {
    colWidths,
    colOrder,
    colVisibility,
    onColumnResize,
    onColumnOrderChange,
    onColumnVisibilityChange,
  } = useGridPrefs('crm.clients');

  // Открывает карточку клиента в обычном режиме или в modal-route режиме.
  const openDetail = useCallback(
    (id) => {
      const suffix = openAsModal ? '?modal=1' : '';
      // клиенты → на страницу деталей клиентов
      navigate(`/main/clients/${id}${suffix}`);
    },
    [navigate, openAsModal]
  );

  // Конфигурация колонок таблицы клиентов.
  const columns = useMemo(
    () => [
      {
        key: 'shortName',
        title: t('crm.table.columns.name'),
        sortable: true,
        width: 280,
                // render: описывает рендер соответствующего блока UI.
render: (r) => (
          <LinkCell
            primary={r.shortName || r.fullName}
            secondary={
              r.fullName && r.fullName !== r.shortName ? r.fullName : null
            }
            onClick={() => openDetail(r.id)}
            ariaLabel={t('crm.actions.openClient', {
              name: r.shortName || r.fullName,
              defaultValue: `Открыть клиента ${r.shortName || r.fullName || ''}`.trim(),
            })}
          />
        ),
      },
      {
        key: 'nip',
        title: t('crm.table.columns.nip'),
        sortable: true,
        width: 160,
                // render: описывает рендер соответствующего блока UI.
render: (r) => r.nip || '—',
      },
      {
        key: 'address',
        title: t('crm.table.columns.address'),
        width: 360,
                // render: описывает рендер соответствующего блока UI.
render: (r) => (
          <AddressCell
            street={r.street}
            postcode={r.postalCode || r.postcode}
            city={r.city}
            country={r.country}
          />
        ),
      },
      {
        key: 'type',
        title: t('crm.table.columns.type'),
        sortable: true,
        width: 140,
                // render: описывает рендер соответствующего блока UI.
render: (r) => t(`crm.enums.type.${r.type}`),
      },
      {
        key: 'status',
        title: t('crm.table.columns.status'),
        sortable: true,
        width: 140,
                // render: описывает рендер соответствующего блока UI.
render: (r) => t(`crm.enums.status.${r.status}`),
      },
      {
        key: 'owner',
        title: t('crm.table.columns.owner'),
        width: 200,
                // render: описывает рендер соответствующего блока UI.
render: (r) => r.mainResponsibleUser || '—',
      },
    ],
    [t, openDetail]
  );

  // клиенты — ВСЕГДА type=client
  const defaultQuery = useMemo(
    () => ({
      page: 1,
      sort: 'createdAt',
      dir: 'DESC',
      limit: 25,
      type: 'client',
    }),
    []
  );
  const [query, setQuery] = useState(defaultQuery);
  const apiQuery = useMemo(() => sanitizeCounterpartyQuery(query), [query]);
  const {
    data: clientsData,
    isFetching: clientsLoading,
    error: clientsError,
    refetch: refetchClients,
  } = useListCounterpartiesQuery(apiQuery);
  const loadedClients = useMemo(() => {
    if (Array.isArray(clientsData)) return clientsData;
    if (Array.isArray(clientsData?.items)) return clientsData.items;
    if (Array.isArray(clientsData?.data)) return clientsData.data;
    return [];
  }, [clientsData]);
  const clientsTotal = Number(clientsData?.total ?? loadedClients.length ?? 0);
  const hasAnyFilter = Boolean(query.search || query.status);

  const workspaceData = useWorkspaceData({
    externalData: loadedClients,
    externalMeta: {
      total: clientsTotal,
      page: clientsData?.page || query.page || defaultQuery.page,
      limit: clientsData?.limit || query.limit || defaultQuery.limit,
    },
    externalLoading: clientsLoading,
    externalError: clientsError,
    onExternalRefetch: refetchClients,
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
    minWidth: Math.max(110, Math.min(Number(column.width) || 180, 180)),
    maxWidth: 560,
    category: column.category || 'core',
    required: column.key === 'shortName',
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
          placeholder={t('crm.filters.searchPlaceholder')}
          size="sm"
          clearable
          fullWidth={false}
        />
      ),
    },
    {
      key: 'status',
      label: t('crm.table.columns.status'),
      control: (
        <SelectField
          value={query.status || ''}
          onValueChange={(value) => updateFilter('status', value)}
          options={[
            { value: '', label: t('crm.filters.allStatuses') },
            { value: 'potential', label: t('crm.enums.status.potential') },
            { value: 'active', label: t('crm.enums.status.active') },
            { value: 'inactive', label: t('crm.enums.status.inactive') },
          ]}
          size="sm"
          fullWidth={false}
        />
      ),
    },
  ], [query.search, query.status, t, updateFilter]);

  const workspaceLabels = useMemo(() => ({
    loading: t('common.loading', 'Loading'),
    errorTitle: t('crm.clients.errorTitle', 'Не удалось загрузить клиентов'),
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

  // Основное action-меню страницы (кнопка создания клиента).
  const actions = useMemo(
    () => (
      <AddButton
        onClick={() => navigate('/main/clients/new')}
        title={t('crm.actions.addClient', 'Добавить клиента')}
      >
        {t('crm.actions.addClient', 'Добавить клиента')}
      </AddButton>
    ),
    [navigate, t]
  );

  return (
    <Workspace
      ref={listRef}
      title={t('crm.titles.clients', 'Клиенты')}
      badge={t('crm.clients.workspaceCount', {
        count: workspaceData.total,
        defaultValue: `${workspaceData.total}`,
      })}
      actions={actions}
      controls={workspaceControls}
      rows={workspaceData.rows}
      columns={workspaceColumns}
      loading={workspaceData.loading}
      error={workspaceData.error}
      onRetry={workspaceData.refetch}
      onRefetch={workspaceData.refetch}
      renderCell={renderCell}
      getRowId={(row) => row?.id}
      getRowKey={(row) => String(row?.id || row?.shortName || row?.fullName || '')}
      onRowClick={(row) => row?.id && openDetail(row.id)}
      sortKey={workspaceData.query.sort}
      sortDir={workspaceData.query.dir}
      onSort={workspaceData.setSort}
      columnState={columnState}
      onColumnStateChange={handleColumnStateChange}
      emptyState={{
        title: t(
          hasAnyFilter ? 'crm.clients.emptyFilteredTitle' : 'crm.clients.emptyTitle',
          hasAnyFilter ? 'Клиенты не найдены' : 'Нет клиентов'
        ),
        description: t(
          hasAnyFilter ? 'crm.clients.emptyFilteredText' : 'crm.clients.emptyText',
          hasAnyFilter ? 'Измените поиск или фильтры.' : 'Создайте первого клиента.'
        ),
      }}
      errorState={{
        title: t('crm.clients.errorTitle', 'Не удалось загрузить клиентов'),
        description: String(
          clientsError?.data?.message
          || clientsError?.data?.error
          || clientsError?.message
          || t('common.error', 'Error')
        ),
        retryLabel: t('list.refresh', 'Refresh'),
      }}
      labels={workspaceLabels}
      pagination={workspaceData.pagination}
    />
  );
}
