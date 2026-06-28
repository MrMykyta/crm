import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  Workspace,
  useWorkspaceData,
} from '../../../../components/workspace';
import AddButton from '../../../../components/buttons/AddButton/AddButton';
import ConfirmDialog from '../../../../components/dialogs/ConfirmDialog';
import LinkCell from '../../../../components/cells/LinkCell';
import { SearchField, SelectField } from '../../../../components/ui/fields';
import useGridPrefs from '../../../../hooks/useGridPrefs';
import useAclPermissions from '../../../../hooks/useAclPermissions';

import {
  useDeleteContactMutation,
  useGetContactsQuery,
  useSetMainContactMutation,
} from '../../../../store/rtk/contactsApi';
import { useListCounterpartiesQuery } from '../../../../store/rtk/counterpartyApi';

import s from './ContactsPage.module.css';

const sanitizeContactsQuery = (query = {}) => Object.fromEntries(
  Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '')
);

// fullName: вспомогательная логика компонента.
function fullName(contact) {
  const first = String(contact?.firstName || '').trim();
  const last = String(contact?.lastName || '').trim();
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full || contact?.displayName || '—';
}

// formatDate: форматирует данные для отображения.
function formatDate(value, locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(+date)) return '—';
  return date.toLocaleDateString(locale || undefined);
}

// Компонент ContactsPage: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function ContactsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const listRef = useRef(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusyId, setDeleteBusyId] = useState(null);
  const { can } = useAclPermissions();
  const canDeleteContact = can('contact:delete');

  const {
    colWidths,
    colOrder,
    colVisibility,
    onColumnResize,
    onColumnOrderChange,
    onColumnVisibilityChange,
  } = useGridPrefs('crm.contacts');

  const [deleteContact] = useDeleteContactMutation();
  const [setMainContact] = useSetMainContactMutation();

  const { data: counterpartiesData } = useListCounterpartiesQuery(
    { limit: 100, sort: 'shortName', dir: 'ASC' },
    { refetchOnMountOrArgChange: false }
  );

  const counterpartyOptions = useMemo(() => {
    const items = Array.isArray(counterpartiesData?.items)
      ? counterpartiesData.items
      : [];
    const mapped = items
      .map((cp) => ({
        value: cp.id,
        label: cp.shortName || cp.fullName || cp.id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, i18n.language || undefined));

    return [
      { value: '', label: t('contacts.filters.allCounterparties', 'Все контрагенты') },
      ...mapped,
    ];
  }, [counterpartiesData?.items, i18n.language, t]);

  const openDetail = useCallback((id) => {
    navigate(`/main/contacts/${id}`);
  }, [navigate]);

    // openCreate: открывает связанный UI-элемент.
const openCreate = useCallback(() => {
    navigate('/main/contacts/new');
  }, [navigate]);

    // openEdit: открывает связанный UI-элемент.
const openEdit = useCallback((contact) => {
    if (contact?.id) openDetail(contact.id);
  }, [openDetail]);

  const onSetMain = useCallback(async (id) => {
    await setMainContact(id).unwrap();
    listRef.current?.refetch?.();
  }, [setMainContact]);

  const confirmDelete = useCallback(async () => {
    const id = deleteTarget?.id;
    if (!id) return;
    setDeleteBusyId(id);
    try {
      await deleteContact(id).unwrap();
      setDeleteTarget(null);
      listRef.current?.refetch?.();
    } finally {
      setDeleteBusyId(null);
    }
  }, [deleteContact, deleteTarget]);

  const columns = useMemo(
    () => [
      {
        key: 'firstName',
        title: t('contacts.table.name', 'Имя'),
        sortable: true,
        width: 260,
                // render: описывает рендер соответствующего блока UI.
render: (row) => (
          <LinkCell
            primary={fullName(row)}
            secondary={row.position || row.jobTitle || row.department || null}
            onClick={() => openDetail(row.id)}
            ariaLabel={t('contacts.aria.open', 'Открыть контакт')}
          />
        ),
      },
      {
        key: 'counterpartyId',
        title: t('contacts.table.counterparty', 'Контрагент'),
        width: 220,
                // render: описывает рендер соответствующего блока UI.
render: (row) => row?.counterparty?.shortName || row?.counterparty?.fullName || '—',
      },
      {
        key: 'phone',
        title: t('contacts.table.phone', 'Телефон'),
        sortable: true,
        width: 170,
                // render: описывает рендер соответствующего блока UI.
render: (row) => row.phone || '—',
      },
      {
        key: 'email',
        title: t('contacts.table.email', 'Email'),
        sortable: true,
        width: 220,
                // render: описывает рендер соответствующего блока UI.
render: (row) => row.email || '—',
      },
      {
        key: 'isMain',
        title: t('contacts.table.main', 'Основной'),
        sortable: true,
        width: 130,
                // render: описывает рендер соответствующего блока UI.
render: (row) => (
          row.isMain || row.isPrimary
            ? <span className={s.badgeMain}>{t('contacts.values.main', 'Основной')}</span>
            : <span className={s.badgeMuted}>{t('contacts.values.no', 'Не основной')}</span>
        ),
      },
      {
        key: 'updatedAt',
        title: t('contacts.table.updatedAt', 'Обновлен'),
        sortable: true,
        width: 150,
                // render: описывает рендер соответствующего блока UI.
render: (row) => formatDate(row.updatedAt, i18n.language),
      },
    ],
    [i18n.language, openDetail, t]
  );

  const rowActions = useCallback(
    (row) => (
      <div className={s.rowActions}>
        <button type="button" className={s.actionBtn} onClick={() => openEdit(row)}>
          {t('common.edit', 'Редактировать')}
        </button>

        {row.isMain || row.isPrimary ? null : (
          <button
            type="button"
            className={s.actionBtn}
            onClick={() => onSetMain(row.id)}
          >
            {t('contacts.actions.makeMain', 'Сделать основным')}
          </button>
        )}

        {row.phone ? (
          <a className={s.actionBtn} href={`tel:${row.phone}`}>
            {t('contacts.actions.call', 'Позвонить')}
          </a>
        ) : null}

        {row.email ? (
          <a className={s.actionBtn} href={`mailto:${row.email}`}>
            {t('contacts.actions.email', 'Написать')}
          </a>
        ) : null}

        {canDeleteContact ? (
          <button
            type="button"
            className={`${s.actionBtn} ${s.actionDanger}`}
            onClick={() => setDeleteTarget(row)}
            disabled={deleteBusyId === row.id}
          >
            {deleteBusyId === row.id
              ? t('common.loading', 'Загрузка...')
              : t('common.delete', 'Удалить')}
          </button>
        ) : null}
      </div>
    ),
    [canDeleteContact, deleteBusyId, onSetMain, openEdit, t]
  );

  const defaultQuery = useMemo(
    () => ({ page: 1, sort: 'createdAt', dir: 'DESC', limit: 25 }),
    []
  );
  const [query, setQuery] = useState(defaultQuery);
  const apiQuery = useMemo(() => sanitizeContactsQuery(query), [query]);
  const {
    data: contactsData,
    isFetching: contactsLoading,
    error: contactsError,
    refetch: refetchContacts,
  } = useGetContactsQuery(apiQuery);
  const loadedContacts = useMemo(() => {
    if (Array.isArray(contactsData)) return contactsData;
    if (Array.isArray(contactsData?.items)) return contactsData.items;
    if (Array.isArray(contactsData?.data)) return contactsData.data;
    return [];
  }, [contactsData]);
  const contactsTotal = Number(contactsData?.total ?? loadedContacts.length ?? 0);
  const hasAnyFilter = Boolean(query.search || query.counterpartyId || query.isMain);

  const workspaceData = useWorkspaceData({
    externalData: loadedContacts,
    externalMeta: {
      total: contactsTotal,
      page: contactsData?.page || query.page || defaultQuery.page,
      limit: contactsData?.limit || query.limit || defaultQuery.limit,
    },
    externalLoading: contactsLoading,
    externalError: contactsError,
    onExternalRefetch: refetchContacts,
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

  const workspaceColumns = useMemo(() => [
    ...columns.map((column) => ({
      ...column,
      fallbackLabel: column.title,
      minWidth: Math.max(110, Math.min(Number(column.width) || 180, 180)),
      maxWidth: 560,
      category: column.category || 'core',
      required: column.key === 'firstName',
    })),
    {
      key: 'actions',
      fallbackLabel: t('common.actions', 'Actions'),
      width: 300,
      minWidth: 240,
      maxWidth: 380,
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

  const workspaceControls = useMemo(() => [
    {
      key: 'search',
      kind: 'search',
      label: t('common.search', 'Search'),
      control: (
        <SearchField
          value={query.search || ''}
          onValueChange={(value) => updateFilter('search', value)}
          placeholder={t('contacts.filters.search', 'Поиск: имя, email, телефон')}
          size="sm"
          clearable
          fullWidth={false}
        />
      ),
    },
    {
      key: 'counterpartyId',
      label: t('contacts.filters.counterparty', 'Контрагент'),
      control: (
        <SelectField
          value={query.counterpartyId || ''}
          onValueChange={(value) => updateFilter('counterpartyId', value)}
          options={counterpartyOptions}
          size="sm"
          fullWidth={false}
        />
      ),
    },
    {
      key: 'isMain',
      label: t('contacts.filters.main', 'Основной'),
      control: (
        <SelectField
          value={query.isMain || ''}
          onValueChange={(value) => updateFilter('isMain', value)}
          options={[
            { value: '', label: t('contacts.filters.allMain', 'Все') },
            { value: 'true', label: t('contacts.values.main', 'Основной') },
            { value: 'false', label: t('contacts.values.no', 'Не основной') },
          ]}
          size="sm"
          fullWidth={false}
        />
      ),
    },
  ], [counterpartyOptions, query.counterpartyId, query.isMain, query.search, t, updateFilter]);

  const workspaceLabels = useMemo(() => ({
    loading: t('common.loading', 'Loading'),
    errorTitle: t('contacts.errorTitle', 'Не удалось загрузить контакты'),
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

  return (
    <>
      <Workspace
        ref={listRef}
        title={t('contacts.title', 'Контактные лица')}
        badge={t('contacts.workspaceCount', {
          count: workspaceData.total,
          defaultValue: `${workspaceData.total}`,
        })}
        actions={(
          <AddButton onClick={openCreate} title={t('contacts.actions.add', 'Добавить контакт')}>
            {t('contacts.actions.add', 'Добавить контакт')}
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
        getRowKey={(row) => String(row?.id || fullName(row))}
        onRowClick={(row) => row?.id && openDetail(row.id)}
        sortKey={workspaceData.query.sort}
        sortDir={workspaceData.query.dir}
        onSort={workspaceData.setSort}
        columnState={columnState}
        onColumnStateChange={handleColumnStateChange}
        emptyState={{
          title: t(
            hasAnyFilter ? 'contacts.emptyFilteredTitle' : 'contacts.emptyTitle',
            hasAnyFilter ? 'Контакты не найдены' : 'Нет контактов'
          ),
          description: t(
            hasAnyFilter ? 'contacts.emptyFilteredText' : 'contacts.emptyText',
            hasAnyFilter ? 'Измените поиск или фильтры.' : 'Добавьте первый контакт.'
          ),
        }}
        errorState={{
          title: t('contacts.errorTitle', 'Не удалось загрузить контакты'),
          description: String(
            contactsError?.data?.message
            || contactsError?.data?.error
            || contactsError?.message
            || t('common.error', 'Error')
          ),
          retryLabel: t('list.refresh', 'Refresh'),
        }}
        labels={workspaceLabels}
        pagination={workspaceData.pagination}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('contacts.confirm.deleteTitle', 'Удалить контакт?')}
        text={t('contacts.confirm.delete', 'Удалить контакт?')}
        okText={t('common.delete', 'Удалить')}
        cancelText={t('common.cancel', 'Отмена')}
        danger
        loading={Boolean(deleteBusyId)}
        onOk={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
