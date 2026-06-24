import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import ListPage from '../../../../components/data/ListPage';
import Modal from '../../../../components/Modal';
import ConfirmDialog from '../../../../components/dialogs/ConfirmDialog';
import CounterpartyForm from '../../CounterpartyForm';

import useGridPrefs from '../../../../hooks/useGridPrefs';
import useOpenAsModal from '../../../../hooks/useOpenAsModal';
import useAclPermissions from '../../../../hooks/useAclPermissions';

import LinkCell from '../../../../components/cells/LinkCell';
import AddressCell from '../../../../components/cells/AddressCell';
import FilterToolbar from '../../../../components/filters/FilterToolbar';
import AddButton from '../../../../components/buttons/AddButton/AddButton';

import {
  useCreateCounterpartyMutation,
  useRemoveCounterpartyMutation,
} from '../../../../store/rtk/counterpartyApi';
import { useListDepartmentsQuery } from '../../../../store/rtk/departmentsApi';

import s from './CounterpartiesPage.module.css';

// контрагенты на этой странице: только партнёры / поставщики / производители
const CONTRAGENT_TYPES = ['partner', 'supplier', 'manufacturer'];

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
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
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
    savedViews,
    activeViewId,
    onColumnResize,
    onColumnOrderChange,
    onColumnVisibilityChange,
    onSavedViewsChange,
    onActiveViewChange,
    resetGridPrefs,
  } = useGridPrefs('crm.counterparties');

  const [createCounterparty, { isLoading: creating }] = useCreateCounterpartyMutation();
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
      sort: 'createdAt',
      dir: 'DESC',
      limit: 25,
      excludeLeadClient: true,
    }),
    []
  );

  const actions = useMemo(
    () => canCreateCounterparty ? (
      <AddButton
        onClick={() => setOpen(true)}
        title={t('crm.actions.addCounterparty')}
      >
        {t('crm.actions.addCounterparty')}
      </AddButton>
    ) : null,
    [canCreateCounterparty, t]
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
  const toolbarControls = useMemo(() => {
    const controls = [
      {
        type: 'search',
        key: 'search',
        placeholder: t('crm.filters.searchPlaceholder'),
        debounce: 400,
      },
      // 🔙 вернули фильтр по типу, но только по "контрагентским" типам
      {
        type: 'select',
        key: 'type',
        label: t('crm.table.columns.type'),
        options: [
          { value: '', label: t('crm.filters.allTypes') },
          { value: 'partner', label: t('crm.enums.type.partner') },
          { value: 'supplier', label: t('crm.enums.type.supplier') },
          { value: 'manufacturer', label: t('crm.enums.type.manufacturer') },
        ],
      },
      {
        type: 'select',
        key: 'status',
        label: t('crm.table.columns.status'),
        options: [
          { value: '', label: t('crm.filters.allStatuses') },
          { value: 'potential', label: t('crm.enums.status.potential') },
          { value: 'active', label: t('crm.enums.status.active') },
          { value: 'inactive', label: t('crm.enums.status.inactive') },
        ],
      },
    ];

    if (canReadDepartments) {
      controls.push({
        type: 'select',
        key: 'departmentId',
        label: t('crm.table.columns.department'),
        options: departmentFilterOptions,
      });
    }

    return controls;
  }, [canReadDepartments, departmentFilterOptions, t]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget?.id) return;
    await removeCounterparty(deleteTarget.id).unwrap();
    setDeleteTarget(null);
    listRef.current?.refetch?.();
  }, [deleteTarget, removeCounterparty]);

  const footer = useMemo(
    () => (
      <>
        <Modal.Button onClick={() => setOpen(false)}>
          {t('common.cancel')}
        </Modal.Button>
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
      <ListPage
        ref={listRef}
        /** 🔹 контрагенты — без лидов и клиентов */
        source="counterparties"
        title={t('crm.titles.counterparties')}
        endpoint="/counterparties"
        columns={columns}
        defaultQuery={defaultQuery}
        actions={actions}
        rowActions={rowActions}
        rowActionsWidth={170}
        columnWidths={colWidths}
        onColumnResize={onColumnResize}
        columnOrder={colOrder}
        onColumnOrderChange={onColumnOrderChange}
        columnVisibility={colVisibility}
        onColumnVisibilityChange={onColumnVisibilityChange}
        savedViews={savedViews}
        activeViewId={activeViewId}
        onSavedViewsChange={onSavedViewsChange}
        onActiveViewChange={onActiveViewChange}
        onResetColumns={resetGridPrefs}
        ToolbarComponent={(props) => (
          <FilterToolbar
            {...props}
            controls={toolbarControls}
          />
        )}
      />

      {canCreateCounterparty ? (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title={t('crm.dialogs.newCounterparty')}
          size="lg"
          footer={footer}
        >
          <CounterpartyForm
            id="cp-create-form"
            defaultType="partner"                 // по умолчанию делаем партнёра
            allowedTypes={CONTRAGENT_TYPES}      // никакого lead / client
            loading={saving || creating}
            withButtons={false}
            departments={activeDepartments}
            onCancel={() => setOpen(false)}
            onSubmit={async (values) => {
              setSaving(true);
              try {
                await createCounterparty({
                  ...values,
                  type: CONTRAGENT_TYPES.includes(values.type)
                    ? values.type
                    : 'partner',
                }).unwrap();
                setOpen(false);
                listRef.current?.refetch?.();
              } finally {
                setSaving(false);
              }
            }}
          />
        </Modal>
      ) : null}

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
