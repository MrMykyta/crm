import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import AddButton from '../../buttons/AddButton/AddButton';
import {
  useDeleteContactMutation,
  useGetContactsByCounterpartyQuery,
  useSetMainContactMutation,
} from '../../../store/rtk/contactsApi';
import s from './CounterpartyContactsSection.module.css';

// contactName: вспомогательная логика компонента.
function contactName(item) {
  const first = String(item?.firstName || '').trim();
  const last = String(item?.lastName || '').trim();
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full || item?.displayName || item?.id || '—';
}

function getCounterpartyTypeFromPath(pathname = '') {
  if (pathname.includes('/main/leads/')) return 'lead';
  if (pathname.includes('/main/clients/')) return 'client';
  return 'partner';
}

// Компонент CounterpartyContactsSection: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function CounterpartyContactsSection({ counterpartyId, counterpartyName = '' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

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

  const [deleteContact] = useDeleteContactMutation();
  const [setMainContact] = useSetMainContactMutation();

  const items = useMemo(() => {
    const source = Array.isArray(data?.items) ? data.items : [];
    return source;
  }, [data?.items]);

  const counterpartyType = getCounterpartyTypeFromPath(location.pathname);
  const returnToContacts = `${location.pathname}?tab=contacts${location.hash || ''}`;
  const returnLabel = counterpartyName || t('contacts.fields.counterparty', 'Контрагент');

  const buildCreateHref = useCallback(() => {
    const params = new URLSearchParams();
    if (counterpartyId) params.set('counterpartyId', counterpartyId);
    if (counterpartyName) params.set('counterpartyName', counterpartyName);
    if (counterpartyType) params.set('counterpartyType', counterpartyType);
    params.set('returnTo', returnToContacts);
    return `/main/contacts/new?${params.toString()}`;
  }, [counterpartyId, counterpartyName, counterpartyType, returnToContacts]);

  const buildContactState = useCallback(() => ({
    returnTo: returnToContacts,
    returnLabel,
    counterpartyId,
    counterpartyName,
    counterpartyType,
  }), [counterpartyId, counterpartyName, counterpartyType, returnLabel, returnToContacts]);

    // openCreate: открывает связанный UI-элемент.
const openCreate = useCallback(() => {
    navigate(buildCreateHref(), { state: buildContactState() });
  }, [buildContactState, buildCreateHref, navigate]);

    // openContact: открывает связанный UI-элемент.
const openContact = useCallback((contact) => {
    if (!contact?.id) return;
    navigate(`/main/contacts/${contact.id}`, { state: buildContactState() });
  }, [buildContactState, navigate]);

    // openEdit: открывает связанный UI-элемент.
const openEdit = useCallback((contact) => {
    openContact(contact);
  }, [openContact]);

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
                  <button
                    type="button"
                    className={s.nameButton}
                    onClick={() => openContact(item)}
                  >
                    {contactName(item)}
                  </button>
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
                  onClick={() => openContact(item)}
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
    </section>
  );
}
