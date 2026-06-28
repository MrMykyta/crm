import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  Workspace,
  useWorkspaceData,
} from '../../../../components/workspace';
import ConfirmDialog from '../../../../components/dialogs/ConfirmDialog';

import useGridPrefs from '../../../../hooks/useGridPrefs';
import useOpenAsModal from '../../../../hooks/useOpenAsModal';
import useAclPermissions from '../../../../hooks/useAclPermissions';

import LinkCell from '../../../../components/cells/LinkCell';
import AddressCell from '../../../../components/cells/AddressCell';
import AddButton from '../../../../components/buttons/AddButton/AddButton';
import { SearchField, SelectField } from '../../../../components/ui/fields';

import {
  useListCounterpartiesQuery,
  useRemoveCounterpartyMutation,
} from '../../../../store/rtk/counterpartyApi';
import { useListDepartmentsQuery } from '../../../../store/rtk/departmentsApi';

import s from './CounterpartiesPage.module.css';

const sanitizeCounterpartyQuery = (query = {}) => Object.fromEntries(
  Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '')
);

function DepartmentChip({ department, fallback }) {
  if (!department) {
    return <span className={s.departmentChipMuted}>{fallback}</span>;
  }

  return (
    <span className={s.departmentChip} title={department.code || department.name}>
      {department.name || department.code}
    </span>
  );
}

// Компонент CounterpartiesPage: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function CounterpartiesPage() {
  const listRef = useRef(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const openAsModal = useOpenAsModal();
  const { can } = useAclPermissions();
  const canCreateCounterparty = can('counterparty:create');
  const canDeleteCounterparty = can('counterparty:delete');
  const canReadDepartments = can('department:read');

  // prefs таблицы
  const {
    colWidths,
    colOrder,
    colVisibility,
    onColumnResize,
    onColumnOrderChange,
    onColumnVisibilityChange,
  } = useGridPrefs('crm.counterparties');

  const [removeCounterparty, { isLoading: deleting }] = useRemoveCounterpartyMutation();
  const { data: departmentsData } = useListDepartmentsQuery(
    { includeArchived: true },
    { skip: !canReadDepartments }
  );
  const departments = useMemo(
    () => (Array.isArray(departmentsData) ? departmentsData : []),
    [departmentsData]
  );
  const activeDepartments = useMemo(
    () => departments.filter((department) => department?.isActive !== false && !department?.deletedAt),
    [departments]
  );
  const departmentById = useMemo(
    () => new Map(departments.map((department) => [String(department.id), department])),
    [departments]
  );
  const departmentFilterOptions = useMemo(
    () => [
      { value: '', label: t('crm.filters.allDepartments') },
      ...activeDepartments.map((department) => ({
        value: String(department.id),
        label: department.name || department.code || String(department.id),
      })),
    ],
    [activeDepartments, t]
  );

  const openDetail = useCallback(
    (id) => {
      const suffix = openAsModal ? '?modal=1' : '';
      navigate(`/main/counterparties/${id}${suffix}`);
    },
    [navigate, openAsModal]
  );

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
            ariaLabel={t('crm.actions.openCounterparty', {
              name: r.shortName || r.fullName,
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
        key: 'departmentId',
        title: t('crm.table.columns.department'),
        width: 180,
                // render: описывает рендер соответствующего блока UI.
render: (r) => (
          <DepartmentChip
            department={r.departmentId ? departmentById.get(String(r.departmentId)) : null}
            fallback={r.departmentId ? '—' : t('crm.counterparties.noDepartment')}
          />
        ),
      },
      {
        key: 'owner',
        title: t('crm.table.columns.owner'),
        width: 200,
                // render: описывает рендер соответствующего блока UI.
render: (r) => r.mainResponsibleUser || '—',
      },
    ],
    [departmentById, t, openDetail]
  );

  // ❗ по умолчанию всегда просим бэкенд скрыть lead и client
  const defaultQuery = useMemo(
    () => ({
      page: 1,
      sort: 'createdAt',
      dir: 'DESC',
      limit: 25,
      excludeLeadClient: true,
    }),
    []
  );
  const [query, setQuery] = useState(defaultQuery);
  const apiQuery = useMemo(() => sanitizeCounterpartyQuery(query), [query]);
  const {
    data: counterpartiesData,
    isFetching: counterpartiesLoading,
    error: counterpartiesError,
    refetch: refetchCounterparties,
  } = useListCounterpartiesQuery(apiQuery);

  const loadedCounterparties = useMemo(() => {
    if (Array.isArray(counterpartiesData)) return counterpartiesData;
    if (Array.isArray(counterpartiesData?.items)) return counterpartiesData.items;
    if (Array.isArray(counterpartiesData?.data)) return counterpartiesData.data;
    return [];
  }, [counterpartiesData]);
  const counterpartiesTotal = Number(counterpartiesData?.total ?? loadedCounterparties.length ?? 0);
  const hasAnyFilter = Boolean(query.search || query.type || query.status || query.departmentId);

  const workspaceData = useWorkspaceData({
    externalData: loadedCounterparties,
    externalMeta: {
      total: counterpartiesTotal,
      page: counterpartiesData?.page || query.page || defaultQuery.page,
      limit: counterpartiesData?.limit || query.limit || defaultQuery.limit,
    },
    externalLoading: counterpartiesLoading,
    externalError: counterpartiesError,
    onExternalRefetch: refetchCounterparties,
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

  const actions = useMemo(
    () => canCreateCounterparty ? (
      <AddButton
        onClick={() => navigate('/main/counterparties/new')}
        title={t('crm.actions.addCounterparty')}
      >
        {t('crm.actions.addCounterparty')}
      </AddButton>
    ) : null,
    [canCreateCounterparty, navigate, t]
  );

  const rowActions = useCallback(
    (row) => (
      <div className={s.rowActions}>
        <button type="button" className={s.actionBtn} onClick={() => openDetail(row.id)}>
          {t('common.open', 'Открыть')}
        </button>
        {canDeleteCounterparty ? (
          <button
            type="button"
            className={`${s.actionBtn} ${s.actionDanger}`}
            onClick={() => setDeleteTarget(row)}
            disabled={deleting}
          >
            {t('common.delete', 'Удалить')}
          </button>
        ) : null}
      </div>
    ),
    [canDeleteCounterparty, deleting, openDetail, t]
  );
  const workspaceColumns = useMemo(() => [
    ...columns.map((column) => ({
      ...column,
      fallbackLabel: column.title,
      minWidth: Math.max(110, Math.min(Number(column.width) || 180, 180)),
      maxWidth: 560,
      category: column.category || 'core',
      required: column.key === 'shortName',
    })),
    {
      key: 'actions',
      fallbackLabel: t('common.actions', 'Actions'),
      width: 170,
      minWidth: 150,
      maxWidth: 220,
      category: 'context',
      required: true,
      render: rowActions,
    },
  ], [columns, rowActions, t]);

  const renderCell = useCallback((row, column) => {
    if (typeof column.render === 'function') return column.render(row);
    const value = row?.[column.key];
    return value == null || value === '' ? '—' : String(value);
  }, []);

  const workspaceControls = useMemo(() => {
    const controls = [
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
        key: 'type',
        label: t('crm.table.columns.type'),
        control: (
          <SelectField
            value={query.type || ''}
            onValueChange={(value) => updateFilter('type', value)}
            options={[
              { value: '', label: t('crm.filters.allTypes') },
              { value: 'partner', label: t('crm.enums.type.partner') },
              { value: 'supplier', label: t('crm.enums.type.supplier') },
              { value: 'manufacturer', label: t('crm.enums.type.manufacturer') },
            ]}
            size="sm"
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
    ];

    if (canReadDepartments) {
      controls.push({
        key: 'departmentId',
        label: t('crm.table.columns.department'),
        control: (
          <SelectField
            value={query.departmentId || ''}
            onValueChange={(value) => updateFilter('departmentId', value)}
            options={departmentFilterOptions}
            size="sm"
            fullWidth={false}
          />
        ),
      });
    }

    return controls;
  }, [
    canReadDepartments,
    departmentFilterOptions,
    query.departmentId,
    query.search,
    query.status,
    query.type,
    t,
    updateFilter,
  ]);

  const workspaceLabels = useMemo(() => ({
    loading: t('common.loading', 'Loading'),
    errorTitle: t('crm.counterparties.errorTitle', 'Не удалось загрузить контрагентов'),
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

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget?.id) return;
    await removeCounterparty(deleteTarget.id).unwrap();
    setDeleteTarget(null);
    listRef.current?.refetch?.();
  }, [deleteTarget, removeCounterparty]);

  return (
    <>
      <Workspace
        ref={listRef}
        title={t('crm.titles.counterparties')}
        badge={t('crm.counterparties.workspaceCount', {
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
            hasAnyFilter ? 'crm.counterparties.emptyFilteredTitle' : 'crm.counterparties.emptyTitle',
            hasAnyFilter ? 'Контрагенты не найдены' : 'Нет контрагентов'
          ),
          description: t(
            hasAnyFilter ? 'crm.counterparties.emptyFilteredText' : 'crm.counterparties.emptyText',
            hasAnyFilter ? 'Измените поиск или фильтры.' : 'Создайте первого контрагента.'
          ),
        }}
        errorState={{
          title: t('crm.counterparties.errorTitle', 'Не удалось загрузить контрагентов'),
          description: String(
            counterpartiesError?.data?.message
            || counterpartiesError?.data?.error
            || counterpartiesError?.message
            || t('common.error', 'Error')
          ),
          retryLabel: t('list.refresh', 'Refresh'),
        }}
        labels={workspaceLabels}
        pagination={workspaceData.pagination}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('crm.counterparties.confirmDeleteTitle', 'Удалить контрагента?')}
        text={t(
          'crm.counterparties.confirmDeleteText',
          'Контрагент будет удалён или архивирован согласно настройкам системы.'
        )}
        okText={t('common.delete', 'Удалить')}
        cancelText={t('common.cancel', 'Отмена')}
        danger
        loading={deleting}
        onOk={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
