import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import EntityDetailPage from '../../../_scaffold/EntityDetailPage';
import DetailTabs from '../../../../components/data/DetailTabs';
import EntityNotesSection from '../../../../components/notes/EntityNotesSection';
import AvatarEditable from '../../../../components/media/AvatarEditable';
import {
  contactEntitySchema,
  toApiContact,
  toFormContact,
} from '../../../../schemas/contact.schema';
import {
  useDeleteContactMutation,
  useGetContactsQuery,
  useGetContactByIdQuery,
  useSetMainContactMutation,
  useUpdateContactMutation,
} from '../../../../store/rtk/contactsApi';
import { useListCounterpartiesQuery } from '../../../../store/rtk/counterpartyApi';
import { useUploadFileMutation } from '../../../../store/rtk/filesApi';
import s from './ContactDetailPage.module.css';

// formatDate: форматирует данные для отображения.
function formatDate(value, locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(+date)) return '—';
  return date.toLocaleString(locale || undefined);
}

// fullName: вспомогательная логика компонента.
function fullName(contact) {
  const first = String(contact?.firstName || '').trim();
  const last = String(contact?.lastName || '').trim();
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full || contact?.displayName || '—';
}

// counterpartyHref: вспомогательная логика компонента.
function counterpartyHref(type, id) {
  if (!id) return null;
  if (type === 'lead') return `/main/crm/leads/${id}`;
  if (type === 'client') return `/main/crm/clients/${id}`;
  return `/main/crm/counterparties/${id}`;
}

// Компонент ContactDetailTabs: отвечает за отображение UI и обработку взаимодействий пользователя.
function ContactDetailTabs({ tab, data, values, onChange }) {
  if (tab === 'notes') {
    return (
      <EntityNotesSection
        ownerType="contact"
        ownerId={data?.id}
        title="Заметки контакта"
      />
    );
  }

  return <DetailTabs tab={tab} data={data} values={values} onChange={onChange} />;
}

// Компонент Skeleton: отвечает за отображение UI и обработку взаимодействий пользователя.
function Skeleton() {
  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          height: 20,
          width: 240,
          borderRadius: 8,
          background: 'color-mix(in srgb, var(--card-bg) 88%, transparent)',
        }}
      />
      <div
        style={{
          height: 12,
          width: 320,
          marginTop: 12,
          borderRadius: 8,
          background: 'color-mix(in srgb, var(--card-bg) 88%, transparent)',
        }}
      />
    </div>
  );
}

// Компонент ContactDetailPage: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function ContactDetailPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [revision, setRevision] = useState(0);
  const [dangerBusy, setDangerBusy] = useState(false);

  const defaultQuery = useMemo(
    () => ({ sort: 'createdAt', dir: 'DESC', limit: 25 }),
    []
  );

  const { data: listData } = useGetContactsQuery(defaultQuery, {
    refetchOnMountOrArgChange: false,
    skip: !id,
  });

  const cachedFromList = useMemo(() => {
    const items = Array.isArray(listData?.items) ? listData.items : [];
    return items.find((item) => String(item.id) === String(id));
  }, [listData?.items, id]);

  const { data: detail, isFetching, isLoading } = useGetContactByIdQuery(id, {
    skip: !id,
    refetchOnMountOrArgChange: true,
  });

  const { data: counterpartiesData } = useListCounterpartiesQuery(
    { limit: 200, sort: 'shortName', dir: 'ASC' },
    { refetchOnMountOrArgChange: false }
  );

  const counterpartyOptions = useMemo(() => {
    const items = Array.isArray(counterpartiesData?.items) ? counterpartiesData.items : [];
    return items
      .map((cp) => ({
        value: cp.id,
        label: cp.shortName || cp.fullName || cp.id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, i18n.language || undefined));
  }, [counterpartiesData?.items, i18n.language]);

  const counterpartyLabelById = useMemo(() => {
    const map = new Map();
    counterpartyOptions.forEach((opt) => map.set(String(opt.value), opt.label));
    return map;
  }, [counterpartyOptions]);

  const schemaBuilder = useCallback(
    (schemaI18n) => contactEntitySchema(schemaI18n, { counterpartyOptions }),
    [counterpartyOptions]
  );

  const base = detail || cachedFromList || null;

  const [updateContact, { isLoading: saving }] = useUpdateContactMutation();
  const [deleteContact] = useDeleteContactMutation();
  const [setMainContact] = useSetMainContactMutation();
  const [uploadFile] = useUploadFileMutation();

  const avatarUploader = useCallback(async (file) => {
    if (!id) throw new Error('contactId is required');

    const res = await uploadFile({
      ownerType: 'contact',
      ownerId: id,
      file,
      purpose: 'avatar',
      visibility: 'private',
    }).unwrap();

    const fileId = res?.data?.id || res?.id || null;
    if (fileId) return { id: fileId };
    const url = res?.data?.url || res?.url || res?.path || '';
    return { url };
  }, [id, uploadFile]);

  const avatarUrlUploader = useCallback(async (url) => ({ url }), []);

  const save = useCallback(
    async (entityId, payload) => {
      const saved = await updateContact({ id: entityId, payload }).unwrap();
      return saved;
    },
    [updateContact]
  );

  const onDelete = useCallback(async () => {
    if (!window.confirm(t('contacts.confirm.delete', 'Удалить контакт?'))) return;
    setDangerBusy(true);
    try {
      await deleteContact(id).unwrap();
      navigate('/main/contacts');
    } finally {
      setDangerBusy(false);
    }
  }, [deleteContact, id, navigate, t]);

  const onMakeMain = useCallback(async () => {
    setDangerBusy(true);
    try {
      await setMainContact(id).unwrap();
      setRevision((value) => value + 1);
    } finally {
      setDangerBusy(false);
    }
  }, [id, setMainContact]);

  const renderLeftTop = useCallback(({ values, onChange }) => {
    const name = fullName(values);
    const isMain = Boolean(values?.isMain);
    const counterpartyId = String(values?.counterpartyId || '').trim();
    const counterpartyName =
      values?.counterpartyName ||
      counterpartyLabelById.get(counterpartyId) ||
      counterpartyId ||
      '—';
    const counterpartyPath = counterpartyHref(values?.counterpartyType, counterpartyId);

    return (
      <div className={s.headPanel}>
        <div className={s.identityRow}>
          <div className={s.avatarCol}>
            <AvatarEditable
              value={values?.avatarUrl || ''}
              onChange={(url) => onChange?.('avatarUrl', url)}
              label={t('common.edit', 'Изменить')}
              size={108}
              uploader={avatarUploader}
              urlUploader={avatarUrlUploader}
            />
          </div>

          <div className={s.headMeta}>
            <div className={s.headTop}>
              <div>
                <h2 className={s.title}>{name}</h2>
                <div className={s.subtitle}>
                  {counterpartyPath ? (
                    <button
                      type="button"
                      className={s.linkBtn}
                      onClick={() => navigate(counterpartyPath)}
                    >
                      {counterpartyName}
                    </button>
                  ) : (
                    counterpartyName
                  )}
                </div>
              </div>
              {isMain ? (
                <span className={s.badgeMain}>{t('contacts.values.main', 'Основной')}</span>
              ) : null}
            </div>

            <div className={s.metaGrid}>
              <div className={s.metaItem}>
                <span className={s.metaLabel}>{t('contacts.meta.createdAt', 'Создан')}</span>
                <span className={s.metaValue}>{formatDate(values?.createdAt, i18n.language)}</span>
              </div>
              <div className={s.metaItem}>
                <span className={s.metaLabel}>{t('contacts.meta.updatedAt', 'Обновлен')}</span>
                <span className={s.metaValue}>{formatDate(values?.updatedAt, i18n.language)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={s.actions}>
          {counterpartyPath ? (
            <button
              type="button"
              className={s.actionBtn}
              onClick={() => navigate(counterpartyPath)}
            >
              {t('contacts.fields.counterparty', 'Контрагент')}
            </button>
          ) : null}

          {isMain ? null : (
            <button
              type="button"
              className={s.actionBtn}
              onClick={onMakeMain}
              disabled={dangerBusy}
            >
              {t('contacts.actions.makeMain', 'Сделать основным')}
            </button>
          )}

          {values?.phone ? (
            <a className={s.actionBtn} href={`tel:${values.phone}`}>
              {t('contacts.actions.call', 'Позвонить')}
            </a>
          ) : null}

          {values?.email ? (
            <a className={s.actionBtn} href={`mailto:${values.email}`}>
              {t('contacts.actions.email', 'Написать')}
            </a>
          ) : null}

          <button
            type="button"
            className={`${s.actionBtn} ${s.actionDanger}`}
            onClick={onDelete}
            disabled={dangerBusy}
          >
            {t('common.delete', 'Удалить')}
          </button>
        </div>
      </div>
    );
  }, [
    avatarUploader,
    avatarUrlUploader,
    counterpartyLabelById,
    dangerBusy,
    i18n.language,
    navigate,
    onDelete,
    onMakeMain,
    t,
  ]);

  if (!base && (isLoading || isFetching)) {
    return <Skeleton />;
  }

  if (!base) {
    return (
      <div className={s.missingWrap}>
        <div className={s.missingCard}>{t('contacts.messages.notFound', 'Контакт не найден')}</div>
      </div>
    );
  }

  return (
    <EntityDetailPage
      key={`${id}:${revision}`}
      id={id}
      tabs={[
        { key: 'overview', label: 'Описание' },
        { key: 'notes', label: 'Заметки' },
        { key: 'files', label: 'Файлы' },
        { key: 'history', label: 'История изменений' },
        { key: 'tasks', label: 'Задания' },
      ]}
      tabsNamespace="crm.contacts.detail"
      schemaBuilder={schemaBuilder}
      toForm={toFormContact}
      toApi={toApiContact}
      isSaving={saving}
      load={async () => base}
      save={save}
      storageKeyPrefix="contact"
      autosave={{ debounceMs: 500 }}
      saveOnExit
      clearDraftOnUnmount
      leftTop={renderLeftTop}
      RightTabsComponent={ContactDetailTabs}
    />
  );
}

