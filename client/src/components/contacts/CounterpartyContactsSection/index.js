import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import AddButton from '../../buttons/AddButton/AddButton';
import Modal from '../../Modal';
import ContactForm from '../ContactForm';
import {
  useCreateContactMutation,
  useDeleteContactMutation,
  useGetContactsByCounterpartyQuery,
  useSetMainContactMutation,
  useUpdateContactMutation,
} from '../../../store/rtk/contactsApi';
import s from './CounterpartyContactsSection.module.css';

// contactName: вспомогательная логика компонента.
function contactName(item) {
  const first = String(item?.firstName || '').trim();
  const last = String(item?.lastName || '').trim();
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full || item?.displayName || item?.id || '—';
}

// Компонент CounterpartyContactsSection: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function CounterpartyContactsSection({ counterpartyId, counterpartyName = '' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState(null);

  const { data, isLoading, isFetching, refetch } = useGetContactsByCounterpartyQuery(
    {
      counterpartyId,
      page: 1,
      limit: 50,
      sort: 'isMain',
      dir: 'DESC',
    },
    { skip: !counterpartyId }
  );

  const [createContact] = useCreateContactMutation();
  const [updateContact] = useUpdateContactMutation();
  const [deleteContact] = useDeleteContactMutation();
  const [setMainContact] = useSetMainContactMutation();

  const items = useMemo(() => {
    const source = Array.isArray(data?.items) ? data.items : [];
    return source;
  }, [data?.items]);

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

    // onSave: вспомогательная логика компонента.
const onSave = async (payload) => {
    setBusy(true);
    try {
      if (editing?.id) {
        await updateContact({ id: editing.id, payload }).unwrap();
      } else {
        await createContact(payload).unwrap();
      }
      closeModal();
      await refetch();
    } finally {
      setBusy(false);
    }
  };

    // onDelete: вспомогательная логика компонента.
const onDelete = async (id) => {
    if (!window.confirm(t('contacts.confirm.delete', 'Удалить контакт?'))) return;
    setDeleteBusyId(id);
    try {
      await deleteContact(id).unwrap();
      await refetch();
    } finally {
      setDeleteBusyId(null);
    }
  };

    // onSetMain: вспомогательная логика компонента.
const onSetMain = async (id) => {
    await setMainContact(id).unwrap();
    await refetch();
  };

  const footer = (
    <>
      <Modal.Button onClick={closeModal}>{t('common.cancel', 'Отмена')}</Modal.Button>
      <Modal.Button variant="primary" form="counterparty-contact-form" disabled={busy}>
        {busy ? t('common.saving', 'Сохранение...') : t('common.save', 'Сохранить')}
      </Modal.Button>
    </>
  );

  return (
    <section className={s.section}>
      <div className={s.header}>
        <h3 className={s.title}>{t('contacts.section.title', 'Контактные лица')}</h3>
        <AddButton onClick={openCreate} title={t('contacts.actions.add', 'Добавить контакт')}>
          {t('contacts.actions.add', 'Добавить контакт')}
        </AddButton>
      </div>

      {isLoading || isFetching ? (
        <div className={s.state}>{t('common.loading', 'Загрузка...')}</div>
      ) : null}

      {!isLoading && !isFetching && items.length === 0 ? (
        <div className={s.state}>{t('contacts.messages.emptyCounterparty', 'Для этого контрагента пока нет контактных лиц')}</div>
      ) : null}

      <div className={s.list}>
        {items.map((item) => {
          const isMain = item.isMain || item.isPrimary;
          return (
            <article key={item.id} className={s.card}>
              <div className={s.cardHead}>
                <div>
                  <div className={s.name}>{contactName(item)}</div>
                  <div className={s.sub}>{item.position || item.jobTitle || item.department || '—'}</div>
                </div>
                {isMain ? <span className={s.badgeMain}>{t('contacts.values.main', 'Основной')}</span> : null}
              </div>

              <div className={s.infoGrid}>
                <div>
                  <div className={s.infoLabel}>{t('contacts.fields.phone', 'Телефон')}</div>
                  <div className={s.infoValue}>{item.phone || '—'}</div>
                </div>
                <div>
                  <div className={s.infoLabel}>{t('contacts.fields.email', 'Email')}</div>
                  <div className={s.infoValue}>{item.email || '—'}</div>
                </div>
              </div>

              <div className={s.actions}>
                {item.phone ? (
                  <a className={s.actionBtn} href={`tel:${item.phone}`}>
                    {t('contacts.actions.call', 'Позвонить')}
                  </a>
                ) : null}

                {item.email ? (
                  <a className={s.actionBtn} href={`mailto:${item.email}`}>
                    {t('contacts.actions.email', 'Написать')}
                  </a>
                ) : null}

                <button
                  type="button"
                  className={s.actionBtn}
                  onClick={() => navigate(`/main/contacts/${item.id}`)}
                >
                  {t('contacts.actions.open', 'Открыть')}
                </button>

                {!isMain ? (
                  <button type="button" className={s.actionBtn} onClick={() => onSetMain(item.id)}>
                    {t('contacts.actions.makeMain', 'Сделать основным')}
                  </button>
                ) : null}

                <button type="button" className={s.actionBtn} onClick={() => openEdit(item)}>
                  {t('common.edit', 'Редактировать')}
                </button>

                <button
                  type="button"
                  className={`${s.actionBtn} ${s.actionDanger}`}
                  onClick={() => onDelete(item.id)}
                  disabled={deleteBusyId === item.id}
                >
                  {t('common.delete', 'Удалить')}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <Modal
        open={open}
        onClose={closeModal}
        title={editing?.id
          ? t('contacts.dialogs.edit', 'Редактирование контакта')
          : t('contacts.dialogs.create', 'Новый контакт')}
        size="lg"
        footer={footer}
      >
        <ContactForm
          id="counterparty-contact-form"
          initial={editing || undefined}
          loading={busy}
          withButtons={false}
          fixedCounterpartyId={counterpartyId}
          fixedCounterpartyName={counterpartyName}
          onSubmit={onSave}
        />
      </Modal>
    </section>
  );
}

