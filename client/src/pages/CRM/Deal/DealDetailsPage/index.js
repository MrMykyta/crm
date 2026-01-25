import React, { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import EntityDetailPage from '../../../_scaffold/EntityDetailPage';
import InfoRow from '../../../../components/shared/InfoRow';
import useCompanyMembersOptions from '../../../../hooks/useCompanyMembersOptions';

import {
  useDeleteDealMutation,
  useGetDealByIdQuery,
  useUpdateDealMutation,
} from '../../../../store/rtk/dealsApi';

import s from './DealDetailsPage.module.css';

const STATUS_OPTIONS = [
  { value: 'new', labelKey: 'deals.status.new' },
  { value: 'in_progress', labelKey: 'deals.status.inProgress' },
  { value: 'won', labelKey: 'deals.status.won' },
  { value: 'lost', labelKey: 'deals.status.lost' },
];

const DealDetailTabs = ({ tab, data }) => {
  const { t } = useTranslation();
  if (!data) return null;

  const noneLabel = t('common.none', '—');
  const ownerLabel = data.responsible
    ? [data.responsible.firstName, data.responsible.lastName].filter(Boolean).join(' ') || data.responsible.email
    : noneLabel;
  const counterpartyLabel = data.counterparty?.fullName || data.counterparty?.shortName || noneLabel;

  switch (tab) {
    case 'overview':
      return (
        <>
          <InfoRow label={t('deals.sidebar.owner', 'Owner')} value={ownerLabel} />
          <InfoRow label={t('deals.sidebar.counterparty', 'Counterparty')} value={counterpartyLabel} />
          <InfoRow label={t('deals.sidebar.contacts', 'Contacts')} value={noneLabel} muted />
          <InfoRow label={t('deals.sidebar.created', 'Created')} value={data.createdAt ? new Date(data.createdAt).toLocaleString() : noneLabel} />
          <InfoRow label={t('deals.sidebar.updated', 'Updated')} value={data.updatedAt ? new Date(data.updatedAt).toLocaleString() : noneLabel} />
        </>
      );
    case 'activities':
    case 'files':
    case 'history':
      return <div className={s.placeholder}>{t('deals.tabs.comingSoon', 'Coming soon')}</div>;
    default:
      return <div className={s.placeholder}>{t('deals.tabs.comingSoon', 'Coming soon')}</div>;
  }
};

const toFormDeal = (d = {}, noneLabel = '—') => ({
  title: d.title ?? '',
  status: d.status ?? 'new',
  value: d.value ?? '',
  currency: d.currency ?? 'PLN',
  description: d.description ?? '',
  responsibleId: d.responsibleId ?? d.responsible?.id ?? '',
  counterpartyName: d.counterparty?.fullName || d.counterparty?.shortName || noneLabel,
});

const toApiDeal = (values = {}) => {
  const trimmedTitle = String(values.title || '').trim();
  const currency = String(values.currency || 'PLN').trim() || 'PLN';
  const valueRaw = values.value;
  const numValue = valueRaw === '' || valueRaw == null ? null : Number(valueRaw);

  return {
    title: trimmedTitle,
    status: values.status || 'new',
    value: Number.isNaN(numValue) ? null : numValue,
    currency,
    description: String(values.description || '').trim() || null,
    responsibleId: values.responsibleId || null,
  };
};

export default function DealDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { options: ownerOptions } = useCompanyMembersOptions();

  const {
    data: base,
    isFetching,
    error,
  } = useGetDealByIdQuery(id);

  const [updateDeal, { isLoading: saving }] = useUpdateDealMutation();
  const [deleteDeal, { isLoading: deleting }] = useDeleteDealMutation();

  const tabs = useMemo(() => ([
    { key: 'overview', label: t('deals.tabs.overview', 'Overview') },
    { key: 'activities', label: t('deals.tabs.activities', 'Activities') },
    { key: 'files', label: t('deals.tabs.files', 'Files') },
    { key: 'history', label: t('deals.tabs.history', 'History') },
  ]), [t]);

  const schemaBuilder = useMemo(() => (i18n) => ([
    {
      name: 'title',
      label: 'deals.fields.title',
      type: 'text',
      float: true,
      required: true,
      max: 256,
      cols: 4,
      placeholder: 'deals.placeholders.title',
    },
    {
      name: 'status',
      label: 'deals.fields.status',
      type: 'select',
      float: true,
      cols: 2,
      options: STATUS_OPTIONS,
    },
    {
      name: 'responsibleId',
      label: 'deals.fields.owner',
      type: 'select',
      float: true,
      cols: 2,
      options: () => ownerOptions,
    },
    {
      name: 'value',
      label: 'deals.fields.amount',
      type: 'text',
      float: true,
      cols: 2,
      inputMode: 'decimal',
    },
    {
      name: 'currency',
      label: 'deals.fields.currency',
      type: 'text',
      float: true,
      cols: 2,
    },
    {
      name: 'counterpartyName',
      label: 'deals.fields.counterparty',
      type: 'text',
      float: true,
      cols: 4,
      disabled: true,
    },
    {
      name: 'description',
      label: 'deals.fields.description',
      type: 'textarea',
      float: true,
      rows: 4,
      cols: 4,
      placeholder: 'deals.placeholders.description',
    },
  ]), [ownerOptions]);

  const save = async (entityId, payload) => {
    const saved = await updateDeal({ dealId: entityId, payload }).unwrap();
    return saved;
  };

  if (isFetching) {
    return <div className={s.emptyState}>{t('deals.details.loading', 'Loading deal…')}</div>;
  }

  if (error?.status === 403) {
    return (
      <div className={s.emptyState}>
        {t('deals.details.noPermission', 'No permission to view this deal.')}
      </div>
    );
  }

  if (error?.status === 404 || !base) {
    return <div className={s.emptyState}>{t('deals.details.notFound', 'Deal not found.')}</div>;
  }

  const noneLabel = t('common.none', '—');

  return (
    <EntityDetailPage
      id={id}
      tabs={tabs}
      tabsNamespace="crm.deal.detail"
      schemaBuilder={schemaBuilder}
      toForm={(d) => toFormDeal(d, noneLabel)}
      toApi={toApiDeal}
      isSaving={saving}
      load={async () => base}
      save={save}
      storageKeyPrefix="deal"
      autosave={{ debounceMs: 500 }}
      saveOnExit
      clearDraftOnUnmount
      RightTabsComponent={DealDetailTabs}
      leftTop={({ values, onChange }) => (
        <div className={s.header}>
          <div>
            <div className={s.breadcrumb}>
              <Link to="/main/deals">{t('deals.title', 'Deals')}</Link> / {values.title || base.title || base.id}
            </div>
            <div className={s.title}>
              {values.title || base.title || t('deals.details.untitled', 'Untitled deal')}
            </div>
          </div>
          <div className={s.actions}>
            <button
              className={s.actionBtn}
              onClick={() => onChange?.('status', 'won')}
              disabled={values.status === 'won'}
            >
              {t('deals.actions.won', 'Won')}
            </button>
            <button
              className={s.actionBtn}
              onClick={() => onChange?.('status', 'lost')}
              disabled={values.status === 'lost'}
            >
              {t('deals.actions.lost', 'Lost')}
            </button>
            <button
              className={`${s.actionBtn} ${s.actionBtnDanger}`}
              onClick={async () => {
                await deleteDeal(id).unwrap();
                navigate('/main/deals');
              }}
              disabled={deleting}
            >
              {deleting
                ? t('deals.actions.archiving', 'Archiving…')
                : t('deals.actions.archive', 'Archive')}
            </button>
          </div>
        </div>
      )}
    />
  );
}
