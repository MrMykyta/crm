import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ExternalLink,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import {
  useDeleteContactMutation,
  useGetContactsByCounterpartyQuery,
  useSetMainContactMutation,
} from '../../../store/rtk/contactsApi';
import ContactPointsSection, {
  formatPhoneValue,
  normalizePhoneForSubmit,
  platformHref,
  pointValue,
} from '../ContactPointsSection';
import { useGetContactPointsQuery } from '../../../store/rtk/contactPointsApi';
import s from './CounterpartyContactsSection.module.css';

function contactName(item) {
  const first = String(item?.firstName || '').trim();
  const last = String(item?.lastName || '').trim();
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full || item?.displayName || item?.id || '—';
}

function contactInitials(item) {
  const name = contactName(item);
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'CP';
}

function contactRole(item) {
  return item?.position || item?.jobTitle || item?.role || '';
}

function contactDepartment(item) {
  return item?.department || item?.departmentName || '';
}

function getCounterpartyTypeFromPath(pathname = '') {
  if (pathname.includes('/main/leads/')) return 'lead';
  if (pathname.includes('/main/clients/')) return 'client';
  return 'partner';
}

function primaryPoint(points, channel) {
  const list = points.filter((point) => point.channel === channel);
  return list.find((point) => point.isPrimary) || list[0] || null;
}

function ContactPersonCard({
  item,
  onOpen,
  onEdit,
  onDelete,
  onSetMain,
  deleteBusyId,
  t,
}) {
  const { data: contactPoints = [] } = useGetContactPointsQuery(
    { ownerType: 'contact', ownerId: item.id },
    { skip: !item?.id }
  );
  const isMain = item.isMain || item.isPrimary;
  const name = contactName(item);
  const role = contactRole(item);
  const department = contactDepartment(item);
  const phonePoint = primaryPoint(contactPoints, 'phone');
  const emailPoint = primaryPoint(contactPoints, 'email');
  const phoneValue = pointValue(phonePoint) || item.phone || '';
  const emailValue = pointValue(emailPoint) || item.email || '';
  const phoneHref = phonePoint ? platformHref(phonePoint.channel, phoneValue) : (phoneValue ? `tel:${normalizePhoneForSubmit(phoneValue)}` : '');
  const emailHref = emailPoint ? platformHref(emailPoint.channel, emailValue) : (emailValue ? `mailto:${emailValue}` : '');
  const hasCommunication = Boolean(phoneValue || emailValue);

  return (
    <article className={`${s.personCard} ${isMain ? s.personCardMain : ''}`}>
      <div className={s.personHead}>
        <div className={s.personAvatar} aria-hidden="true">
          {contactInitials(item)}
        </div>
        <div className={s.personIdentity}>
          <button
            type="button"
            className={s.personNameButton}
            onClick={() => onOpen(item)}
          >
            {name}
          </button>
          {role || department ? (
            <div className={s.personMeta}>
              {role ? <span>{role}</span> : null}
              {role && department ? <span className={s.metaDot}>•</span> : null}
              {department ? <span>{department}</span> : null}
            </div>
          ) : (
            <div className={s.personMeta}>{t('contacts.messages.noRole', 'Роль не указана')}</div>
          )}
        </div>
        {isMain ? (
          <span className={s.personMainBadge}>
            <Star size={12} />
            {t('contacts.values.main', 'Основной')}
          </span>
        ) : null}
      </div>

      <div className={s.personCommunication}>
        {phoneValue ? (
          <a className={s.personCommRow} href={phoneHref}>
            <Phone size={14} />
            <span>{formatPhoneValue(phoneValue) || phoneValue}</span>
          </a>
        ) : null}
        {emailValue ? (
          <a className={s.personCommRow} href={emailHref}>
            <Mail size={14} />
            <span>{emailValue}</span>
          </a>
        ) : null}
        {!hasCommunication ? (
          <div className={s.noCommunication}>
            <MessageCircle size={14} />
            <span>{t('contacts.messages.noCommunication', 'Нет контактных данных')}</span>
          </div>
        ) : null}
      </div>

      <div className={s.personActions}>
        {phoneValue ? (
          <a className={s.personActionBtn} href={phoneHref} title={t('contacts.actions.call', 'Позвонить')}>
            <Phone size={14} />
            <span>{t('contacts.actions.call', 'Позвонить')}</span>
          </a>
        ) : null}

        {emailValue ? (
          <a className={s.personActionBtn} href={emailHref} title={t('contacts.actions.email', 'Написать')}>
            <Mail size={14} />
            <span>{t('contacts.actions.email', 'Написать')}</span>
          </a>
        ) : null}

        <button
          type="button"
          className={s.personActionBtn}
          onClick={() => onOpen(item)}
          title={t('contacts.actions.open', 'Открыть')}
        >
          <ExternalLink size={14} />
          <span>{t('contacts.actions.open', 'Открыть')}</span>
        </button>

        {!isMain ? (
          <button type="button" className={s.personActionBtn} onClick={() => onSetMain(item.id)} title={t('contacts.actions.makeMain', 'Сделать основным')}>
            <Star size={14} />
          </button>
        ) : null}

        <button type="button" className={s.personActionBtn} onClick={() => onEdit(item)} title={t('common.edit', 'Редактировать')}>
          {t('common.edit', 'Редактировать')}
        </button>

        <button
          type="button"
          className={`${s.personActionBtn} ${s.actionDanger}`}
          onClick={() => onDelete(item.id)}
          disabled={deleteBusyId === item.id}
          title={t('common.delete', 'Удалить')}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </article>
  );
}

export default function CounterpartyContactsSection({ counterpartyId, counterpartyName = '', isCompany = true }) {
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

  const showPersonsSection = isCompany || items.length > 0 || isLoading || isFetching;
  const personsTitle = isCompany
    ? t('contacts.section.title', 'Контактные лица')
    : t('contacts.section.relatedTitle', 'Связанные лица');
  const personsSubtitle = isCompany
    ? t('contacts.section.subtitle', 'Люди, связанные с этим контрагентом')
    : t('contacts.section.relatedSubtitle', 'Люди, связанные с этим физическим лицом');
  const emptyPersonsText = isCompany
    ? t('contacts.messages.emptyCounterparty', 'Для этого контрагента пока нет контактных лиц')
    : t('contacts.messages.emptyRelatedPersons', 'Для этого физического лица пока нет связанных лиц');

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

  const openCreate = useCallback(() => {
    navigate(buildCreateHref(), { state: buildContactState() });
  }, [buildContactState, buildCreateHref, navigate]);

  const openContact = useCallback((contact) => {
    if (!contact?.id) return;
    navigate(`/main/contacts/${contact.id}`, { state: buildContactState() });
  }, [buildContactState, navigate]);

  const openEdit = useCallback((contact) => {
    openContact(contact);
  }, [openContact]);

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

  const onSetMain = async (id) => {
    await setMainContact(id).unwrap();
    await refetch();
  };

  return (
    <section className={s.section}>
      <ContactPointsSection
        ownerType="counterparty"
        ownerId={counterpartyId}
        title={isCompany
          ? t('contacts.companyPoints.title', 'Контакты компании')
          : t('contacts.companyPoints.personTitle', 'Контактные данные физического лица')}
        subtitle={isCompany
          ? t('contacts.companyPoints.subtitle', 'Телефоны, email и публичные каналы контрагента')
          : t('contacts.companyPoints.personSubtitle', 'Телефон, email и публичные каналы самого человека')}
        emptyTitle={isCompany
          ? t('contacts.companyPoints.emptyTitle', 'Контакты компании не добавлены')
          : t('contacts.companyPoints.personEmptyTitle', 'Контактные данные не добавлены')}
        emptyText={isCompany
          ? t('contacts.companyPoints.emptyText', 'Добавьте основной email, телефон или сайт, чтобы использовать их в коммуникации и документах.')
          : t('contacts.companyPoints.personEmptyText', 'Добавьте телефон, email или сайт физического лица.')}
        createTitle={isCompany
          ? t('contacts.companyPoints.createTitle', 'Новый контакт компании')
          : t('contacts.companyPoints.personCreateTitle', 'Новые контактные данные')}
        editTitle={isCompany
          ? t('contacts.companyPoints.editTitle', 'Редактировать контакт компании')
          : t('contacts.companyPoints.personEditTitle', 'Редактировать контактные данные')}
      />

      {showPersonsSection ? (
        <section className={s.personsSection}>
          <div className={s.header}>
            <div>
              <h3 className={s.title}>{personsTitle}</h3>
              <p className={s.kicker}>{personsSubtitle}</p>
            </div>
            <button type="button" className={s.addPointBtn} onClick={openCreate} title={t('contacts.actions.add', 'Добавить контакт')}>
              <Plus size={16} />
              {t('contacts.actions.add', 'Добавить контакт')}
            </button>
          </div>

          {isLoading || isFetching ? (
            <div className={s.state}>{t('common.loading', 'Загрузка...')}</div>
          ) : null}

          {!isLoading && !isFetching && items.length === 0 ? (
            <div className={s.state}>{emptyPersonsText}</div>
          ) : null}

          <div className={s.personCardsGrid}>
            {items.map((item) => (
              <ContactPersonCard
                key={item.id}
                item={item}
                onOpen={openContact}
                onEdit={openEdit}
                onDelete={onDelete}
                onSetMain={onSetMain}
                deleteBusyId={deleteBusyId}
                t={t}
              />
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
