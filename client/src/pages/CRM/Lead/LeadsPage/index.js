import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  Workspace,
  useWorkspaceData,
} from '../../../../components/workspace';
import Modal from '../../../../components/Modal';
import CounterpartyForm from '../../CounterpartyForm';

import useGridPrefs from '../../../../hooks/useGridPrefs';
import useOpenAsModal from '../../../../hooks/useOpenAsModal';

import LinkCell from '../../../../components/cells/LinkCell';
import AddressCell from '../../../../components/cells/AddressCell';
import AddButton from '../../../../components/buttons/AddButton/AddButton';
import { SearchField, SelectField } from '../../../../components/ui/fields';

import {
  useCreateCounterpartyMutation,
  useListCounterpartiesQuery,
} from '../../../../store/rtk/counterpartyApi';

const sanitizeCounterpartyQuery = (query = {}) => Object.fromEntries(
  Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '')
);

/**
 * Страница списка лидов:
 * фиксирует type=lead и управляет таблицей/фильтрами/созданием лида.
 */
export default function LeadsPage() {
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const openAsModal = useOpenAsModal();

  // prefs таблицы
  const {
    colWidths,
    colOrder,
    colVisibility,
    onColumnResize,
    onColumnOrderChange,
    onColumnVisibilityChange,
  } = useGridPrefs('crm.leads');

  const [createCounterparty, { isLoading: creating }] = useCreateCounterpartyMutation();

  // Открывает карточку лида в обычном режиме или как modal-route.
  const openDetail = useCallback(
    (id) => {
      const suffix = openAsModal ? '?modal=1' : '';
      navigate(`/main/leads/${id}${suffix}`);
    },
    [navigate, openAsModal]
  );

  // Конфигурация колонок таблицы лидов.
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
            secondary={r.fullName && r.fullName !== r.shortName ? r.fullName : null}
            onClick={() => openDetail(r.id)}
            ariaLabel={t('crm.actions.openLead', {
              name: r.shortName || r.fullName,
              defaultValue: `Открыть лид ${r.shortName || r.fullName || ''}`.trim(),
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
            postcode={r.postcode}
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

  // ❗ Лиды — это ВСЕГДА type=lead
  const defaultQuery = useMemo(
    () => ({
      page: 1,
      sort: 'createdAt',
      dir: 'DESC',
      limit: 25,
      type: 'lead',        // <--- фиксируем тип лида
    }),
    []
  );
  const [query, setQuery] = useState(defaultQuery);
  const apiQuery = useMemo(() => sanitizeCounterpartyQuery(query), [query]);
  const {
    data: leadsData,
    isFetching: leadsLoading,
    error: leadsError,
    refetch: refetchLeads,
  } = useListCounterpartiesQuery(apiQuery);
  const loadedLeads = useMemo(() => {
    if (Array.isArray(leadsData)) return leadsData;
    if (Array.isArray(leadsData?.items)) return leadsData.items;
    if (Array.isArray(leadsData?.data)) return leadsData.data;
    return [];
  }, [leadsData]);
  const leadsTotal = Number(leadsData?.total ?? loadedLeads.length ?? 0);
  const hasAnyFilter = Boolean(query.search || query.status);

  const workspaceData = useWorkspaceData({
    externalData: loadedLeads,
    externalMeta: {
      total: leadsTotal,
      page: leadsData?.page || query.page || defaultQuery.page,
      limit: leadsData?.limit || query.limit || defaultQuery.limit,
    },
    externalLoading: leadsLoading,
    externalError: leadsError,
    onExternalRefetch: refetchLeads,
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
    errorTitle: t('crm.leads.errorTitle', 'Не удалось загрузить лидов'),
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

  // Основная кнопка действия страницы (создать лид).
  const actions = useMemo(
    () => (
      <AddButton onClick={() => setOpen(true)} title={t('crm.actions.addLead', 'Добавить лид')}>
        {t('crm.actions.addLead', 'Добавить лид')}
      </AddButton>
    ),
    [t]
  );

  // Кнопки футера модалки создания лида.
  const footer = useMemo(
    () => (
      <>
        <Modal.Button onClick={() => setOpen(false)}>{t('common.cancel')}</Modal.Button>
        <Modal.Button
          variant="primary"
          form="cp-create-form"
          disabled={saving || creating}
        >
          {saving || creating ? t('common.saving') : t('common.save')}
        </Modal.Button>
      </>
    ),
    [t, saving, creating]
  );

  return (
    <>
      <Workspace
        ref={listRef}
        title={t('crm.titles.leads', 'Лиды')}
        badge={t('crm.leads.workspaceCount', {
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
            hasAnyFilter ? 'crm.leads.emptyFilteredTitle' : 'crm.leads.emptyTitle',
            hasAnyFilter ? 'Лиды не найдены' : 'Нет лидов'
          ),
          description: t(
            hasAnyFilter ? 'crm.leads.emptyFilteredText' : 'crm.leads.emptyText',
            hasAnyFilter ? 'Измените поиск или фильтры.' : 'Создайте первый лид.'
          ),
        }}
        errorState={{
          title: t('crm.leads.errorTitle', 'Не удалось загрузить лидов'),
          description: String(
            leadsError?.data?.message
            || leadsError?.data?.error
            || leadsError?.message
            || t('common.error', 'Error')
          ),
          retryLabel: t('list.refresh', 'Refresh'),
        }}
        labels={workspaceLabels}
        pagination={workspaceData.pagination}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('crm.dialogs.newLead', 'Новый лид')}
        size="lg"
        footer={footer}
      >
        <CounterpartyForm
            id="cp-create-form"
            defaultType="lead"
            defaultStatus="potential"
            allowedTypes={['lead']}                      // показываем только тип lead
            allowedStatuses={['potential','active','inactive']}
            lockType                                     // тип фиксированный
            loading={saving || creating}
            withButtons={false}
            onCancel={() => setOpen(false)}
            // Создаёт лида и обновляет таблицу без полного перезапуска страницы.
            onSubmit={async (values) => {
                setSaving(true);
                try {
                await createCounterparty({
                    ...values,
                    type: 'lead',                          // на всякий случай дубль
                    status: values.status || 'potential',
                }).unwrap();
                setOpen(false);
                workspaceData.refetch?.();
                } finally {
                setSaving(false);
                }
            }}
        />
      </Modal>
    </>
  );
}
