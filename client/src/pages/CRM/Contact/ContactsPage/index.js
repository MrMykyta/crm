import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import ListPage from '../../../../components/data/ListPage';
import FilterToolbar from '../../../../components/filters/FilterToolbar';
import AddButton from '../../../../components/buttons/AddButton/AddButton';
import Modal from '../../../../components/Modal';
import ConfirmDialog from '../../../../components/dialogs/ConfirmDialog';
import LinkCell from '../../../../components/cells/LinkCell';
import ContactForm from '../../../../components/contacts/ContactForm';
import useGridPrefs from '../../../../hooks/useGridPrefs';
import useOpenAsModal from '../../../../hooks/useOpenAsModal';
import useAclPermissions from '../../../../hooks/useAclPermissions';

import {
  useCreateContactMutation,
  useDeleteContactMutation,
  useSetMainContactMutation,
  useUpdateContactMutation,
} from '../../../../store/rtk/contactsApi';
import { useListCounterpartiesQuery } from '../../../../store/rtk/counterpartyApi';

import s from './ContactsPage.module.css';

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
  const openAsModal = useOpenAsModal();
  const listRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formBusy, setFormBusy] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState(null);
  const { can } = useAclPermissions();
  const canDeleteContact = can('contact:delete');

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
  } = useGridPrefs('crm.contacts');

  const [createContact] = useCreateContactMutation();
  const [updateContact] = useUpdateContactMutation();
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
    const suffix = openAsModal ? '?modal=1' : '';
    navigate(`/main/contacts/${id}${suffix}`);
  }, [navigate, openAsModal]);

    // openCreate: открывает связанный UI-элемент.
const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };

    // openEdit: открывает связанный UI-элемент.
const openEdit = (contact) => {
    setEditing(contact);
    setOpen(true);
  };

    // closeModal: закрывает связанный UI-элемент.
const closeModal = () => {
    setOpen(false);
    setEditing(null);
  };

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
    [canDeleteContact, deleteBusyId, onSetMain, t]
  );

    // onFormSubmit: вспомогательная логика компонента.
const onFormSubmit = async (payload) => {
    setFormBusy(true);
    try {
      if (editing?.id) {
        await updateContact({ id: editing.id, payload }).unwrap();
      } else {
        await createContact(payload).unwrap();
      }
      closeModal();
      listRef.current?.refetch?.();
    } finally {
      setFormBusy(false);
    }
  };

  const defaultQuery = useMemo(
    () => ({ sort: 'createdAt', dir: 'DESC', limit: 25 }),
    []
  );

  const modalFooter = useMemo(
    () => (
      <>
        <Modal.Button onClick={closeModal}>{t('common.cancel', 'Отмена')}</Modal.Button>
        <Modal.Button
          variant="primary"
          form="contact-edit-form"
          disabled={formBusy}
        >
          {formBusy ? t('common.saving', 'Сохранение...') : t('common.save', 'Сохранить')}
        </Modal.Button>
      </>
    ),
    [formBusy, t]
  );

  return (
    <>
      <ListPage
        ref={listRef}
        source="contacts"
        title={t('contacts.title', 'Контактные лица')}
        columns={columns}
        rowActions={rowActions}
        defaultQuery={defaultQuery}
        actions={(
          <AddButton onClick={openCreate} title={t('contacts.actions.add', 'Добавить контакт')}>
            {t('contacts.actions.add', 'Добавить контакт')}
          </AddButton>
        )}
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
            controls={[
              {
                type: 'search',
                key: 'search',
                placeholder: t('contacts.filters.search', 'Поиск: имя, email, телефон'),
                debounce: 350,
              },
              {
                type: 'select',
                key: 'counterpartyId',
                label: t('contacts.filters.counterparty', 'Контрагент'),
                options: counterpartyOptions,
              },
              {
                type: 'select',
                key: 'isMain',
                label: t('contacts.filters.main', 'Основной'),
                options: [
                  { value: '', label: t('contacts.filters.allMain', 'Все') },
                  { value: 'true', label: t('contacts.values.main', 'Основной') },
                  { value: 'false', label: t('contacts.values.no', 'Не основной') },
                ],
              },
            ]}
          />
        )}
      />

      <Modal
        open={open}
        onClose={closeModal}
        title={editing?.id
          ? t('contacts.dialogs.edit', 'Редактирование контакта')
          : t('contacts.dialogs.create', 'Новый контакт')}
        size="lg"
        footer={modalFooter}
      >
        <ContactForm
          id="contact-edit-form"
          initial={editing || undefined}
          loading={formBusy}
          withButtons={false}
          onSubmit={onFormSubmit}
        />
      </Modal>

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
