import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import ListPage from '../../../../components/data/ListPage';
import FilterToolbar from '../../../../components/filters/FilterToolbar';
import LinkCell from '../../../../components/cells/LinkCell';
import AddButton from '../../../../components/buttons/AddButton/AddButton';
import Modal from '../../../../components/Modal';
import ConfirmDialog from '../../../../components/dialogs/ConfirmDialog';
import {
  AutocompleteField,
  DateField,
  NumberField,
  SelectField,
  TextareaField,
  TextField,
} from '../../../../components/ui/fields';
import useGridPrefs from '../../../../hooks/useGridPrefs';
import useOpenAsModal from '../../../../hooks/useOpenAsModal';
import useCompanyMembersOptions from '../../../../hooks/useCompanyMembersOptions';
import useAclPermissions from '../../../../hooks/useAclPermissions';

import {
  useCreateDealMutation,
  useDeleteDealMutation,
  useMarkWonMutation,
  useMarkLostMutation,
} from '../../../../store/rtk/dealsApi';
import { useGetCounterpartyLookupQuery } from '../../../../store/rtk/counterpartyApi';

import s from './DealsListPage.module.css';

// buildStatusLabels: собирает итоговую структуру данных в рамках UI-компонента.
const buildStatusLabels = (t) => ({
  new: t('deals.status.new', 'New'),
  in_progress: t('deals.status.inProgress', 'In progress'),
  won: t('deals.status.won', 'Won'),
  lost: t('deals.status.lost', 'Lost'),
});

// buildStatusOptions: собирает итоговую структуру данных в рамках UI-компонента.
const buildStatusOptions = (t, labels, includeAll = false) => {
  const options = [
    { value: 'new', label: labels.new },
    { value: 'in_progress', label: labels.in_progress },
    { value: 'won', label: labels.won },
    { value: 'lost', label: labels.lost },
  ];
  if (!includeAll) return options;
  return [
    { value: '', label: t('deals.filters.allStatuses', 'All statuses') },
    ...options,
  ];
};

// formatMoney: форматирует данные для отображения.
function formatMoney(value, currency, noneLabel = '—') {
  if (value === null || value === undefined || value === '') return noneLabel;
  const num = Number(value);
  if (Number.isNaN(num)) return `${value} ${currency || ''}`.trim();
  const cur = currency || 'PLN';
  return `${num.toLocaleString()} ${cur}`;
}

// Компонент DealForm: отвечает за отображение UI и обработку взаимодействий пользователя.
function DealForm({ onSubmit, onCancel, loading }) {
  const { t } = useTranslation();
  const { options: ownerOptions } = useCompanyMembersOptions();
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    counterpartyId: '',
    value: '',
    currency: 'PLN',
    status: 'new',
    responsibleId: '',
    description: '',
  });
  const [counterpartyTerm, setCounterpartyTerm] = useState('');
  const [selectedCounterparty, setSelectedCounterparty] = useState(null);
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const statusLabels = useMemo(() => buildStatusLabels(t), [t]);
  const statusOptions = useMemo(
    () => buildStatusOptions(t, statusLabels, false),
    [t, statusLabels]
  );

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedTerm(counterpartyTerm.trim());
    }, 320);
    return () => clearTimeout(id);
  }, [counterpartyTerm]);

  const { data: lookupOptions = [], isFetching: lookupLoading } =
    useGetCounterpartyLookupQuery(
      { term: debouncedTerm, limit: 12 },
      { skip: !debouncedTerm }
    );

    // set: обновляет состояние компонента.
const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    // submit: вспомогательная логика компонента.
const submit = (e) => {
    e?.preventDefault();
    setError('');
    if (!form.title.trim()) {
      setError(t('deals.validation.titleRequired', 'Title is required'));
      return;
    }
    const counterpartyId = String(form.counterpartyId || '').trim();
    if (!counterpartyId) {
      setError(t('deals.validation.counterpartyRequired', 'Select a counterparty'));
      return;
    }

    const payload = {
      title: form.title.trim(),
      counterpartyId,
      status: form.status,
      currency: form.currency.trim() || 'PLN',
      description: form.description.trim() || null,
    };
    if (form.value !== '') payload.value = Number(form.value);
    if (form.responsibleId) payload.responsibleId = form.responsibleId;

    onSubmit?.(payload);
  };

  return (
    <form className={s.form} onSubmit={submit}>
      <div className={s.field}>
        <div className={s.label}>
          {t('deals.fields.title', 'Title')}
        </div>
        <TextField
          inputClassName={s.input}
          value={form.title}
          onValueChange={(value) => set('title', value)}
          placeholder={t('deals.placeholders.title', 'Deal title')}
        />
      </div>

      <div className={s.row2}>
        <div className={s.field}>
          <div className={s.label}>
            {t('deals.modal.new.counterpartyLabel', 'Counterparty')}
          </div>
          <AutocompleteField
            value={selectedCounterparty}
            inputValue={counterpartyTerm}
            onInputChange={(value) => {
              setCounterpartyTerm(value);
              if (selectedCounterparty && value.trim() !== selectedCounterparty.name) {
                setSelectedCounterparty(null);
                set('counterpartyId', '');
              }
            }}
            options={lookupOptions}
            onChange={(nextValue, opt) => {
              if (!opt) return;
              setSelectedCounterparty(opt);
              set('counterpartyId', String(nextValue || opt.id || ''));
              setCounterpartyTerm(opt.name || '');
              setError('');
            }}
            placeholder={t(
              'deals.modal.new.counterpartyPlaceholder',
              'Type a name or NIP...'
            )}
            hint={t('deals.common.typeToSearch', 'Type name or NIP')}
            searchingLabel={t(
              'deals.modal.new.counterpartySearching',
              'Searching...'
            )}
            emptyLabel={t(
              'deals.modal.new.counterpartyEmpty',
              'No counterparties found'
            )}
            loading={Boolean(debouncedTerm) && lookupLoading}
            getOptionLabel={(opt) => opt?.name || String(opt?.id || '')}
            getOptionSecondary={(opt) => {
              const parts = [];
              if (opt?.nip) parts.push(`${t('deals.common.nipLabel', 'NIP')}: ${opt.nip}`);
              if (opt?.email) parts.push(opt.email);
              if (opt?.city) parts.push(opt.city);
              return parts.join(' • ');
            }}
            inputClassName={s.input}
          />
        </div>
        <div className={s.field}>
          <div className={s.label}>
            {t('deals.fields.owner', 'Owner')}
          </div>
          <SelectField
            inputClassName={s.select}
            value={form.responsibleId}
            onValueChange={(value) => set('responsibleId', value)}
            options={[
              { value: '', label: t('deals.form.ownerUnassigned', 'Unassigned') },
              ...ownerOptions,
            ]}
          />
        </div>
      </div>

      <div className={s.row2}>
        <div className={s.field}>
          <div className={s.label}>
            {t('deals.fields.amount', 'Amount')}
          </div>
          <NumberField
            inputClassName={s.input}
            step="0.01"
            value={form.value}
            emitAs="string"
            onValueChange={(value) => set('value', value)}
            placeholder="0.00"
          />
        </div>
        <div className={s.field}>
          <div className={s.label}>
            {t('deals.fields.currency', 'Currency')}
          </div>
          <TextField
            inputClassName={s.input}
            value={form.currency}
            onValueChange={(value) => set('currency', value)}
            placeholder="PLN"
          />
        </div>
      </div>

      <div className={s.row2}>
        <div className={s.field}>
          <div className={s.label}>
            {t('deals.fields.status', 'Status')}
          </div>
          <SelectField
            inputClassName={s.select}
            value={form.status}
            onValueChange={(value) => set('status', value)}
            options={statusOptions}
          />
        </div>
      </div>

      <div className={s.field}>
        <div className={s.label}>
          {t('deals.fields.description', 'Description')}
        </div>
        <TextareaField
          inputClassName={s.textarea}
          value={form.description}
          onValueChange={(value) => set('description', value)}
          placeholder={t('deals.placeholders.description', 'Optional description')}
        />
      </div>

      {error && <div className={s.error}>{error}</div>}

      <div>
        <Modal.Button type="button" onClick={onCancel}>
          {t('common.cancel', 'Cancel')}
        </Modal.Button>
        <Modal.Button variant="primary" type="submit" disabled={loading}>
          {loading
            ? t('common.saving', 'Saving…')
            : t('deals.actions.create', 'Create deal')}
        </Modal.Button>
      </div>
    </form>
  );
}

// Компонент DealsListPage: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function DealsListPage() {
  const listRef = useRef(null);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const openAsModal = useOpenAsModal();
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
  } = useGridPrefs('crm.deals');

  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [createDeal, { isLoading: creating }] = useCreateDealMutation();
  const [deleteDeal, { isLoading: deleting }] = useDeleteDealMutation();
  const [markWon] = useMarkWonMutation();
  const [markLost] = useMarkLostMutation();
  const { can } = useAclPermissions();
  const canDeleteDeal = can('deal:delete');
  const { options: ownerOptions } = useCompanyMembersOptions();
  const statusLabels = useMemo(() => buildStatusLabels(t), [t]);
  const statusOptions = useMemo(
    () => buildStatusOptions(t, statusLabels, true),
    [t, statusLabels]
  );

  const openDetail = useCallback((id) => {
    const suffix = openAsModal ? '?modal=1' : '';
    navigate(`/main/deals/${id}${suffix}`);
  }, [navigate, openAsModal]);

  const columns = useMemo(() => ([
    {
      key: 'title',
      title: t('deals.columns.title', 'Deal'),
      sortable: true,
      width: 320,
            // render: описывает рендер соответствующего блока UI.
render: (r) => (
        <LinkCell
          primary={r.title}
          secondary={r.counterparty?.fullName || r.counterparty?.shortName || undefined}
          onClick={() => openDetail(r.id)}
          ariaLabel={t('deals.aria.openDeal', {
            title: r.title || r.id,
            defaultValue: `Open deal ${r.title || r.id}`,
          })}
        />
      ),
    },
    {
      key: 'value',
      title: t('deals.columns.amount', 'Amount'),
      sortable: true,
      width: 160,
            // render: описывает рендер соответствующего блока UI.
render: (r) => formatMoney(r.value, r.currency, t('common.none', '—')),
    },
    {
      key: 'status',
      title: t('deals.columns.status', 'Status'),
      sortable: true,
      width: 140,
            // render: описывает рендер соответствующего блока UI.
render: (r) => statusLabels[r.status] || r.status || t('common.none', '—'),
    },
    {
      key: 'responsible',
      title: t('deals.columns.owner', 'Owner'),
      width: 200,
            // render: описывает рендер соответствующего блока UI.
render: (r) => {
        const u = r.responsible;
        return u
          ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email
          : t('common.none', '—');
      },
    },
    {
      key: 'updatedAt',
      title: t('deals.columns.updated', 'Updated'),
      sortable: true,
      width: 180,
            // render: описывает рендер соответствующего блока UI.
render: (r) => (r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : t('common.none', '—')),
    },
  ]), [openDetail, statusLabels, t]);

  const defaultQuery = useMemo(() => ({
    sort: 'createdAt',
    dir: 'DESC',
    limit: 25,
  }), []);

  const actions = useMemo(() => (
    <AddButton onClick={() => setOpen(true)} title={t('deals.actions.new', 'New deal')}>
     {t('deals.actions.new', 'New deal')}
    </AddButton>
  ), [t]);

  const rowActions = useCallback((row) => {
    const isWon = row.status === 'won';
    const isLost = row.status === 'lost';
    return (
      <div className={s.rowActions}>
        <button className={s.rowLink} onClick={() => openDetail(row.id)}>
          {t('deals.actions.open', 'Open')}
        </button>
        <span className={s.sep}>·</span>
        <button
          className={s.rowLink}
          disabled={isWon}
          onClick={() => markWon(row.id)}
        >
          {t('deals.actions.won', 'Won')}
        </button>
        <span className={s.sep}>·</span>
        <button
          className={s.rowDanger}
          disabled={isLost}
          onClick={() => markLost(row.id)}
        >
          {t('deals.actions.lost', 'Lost')}
        </button>
        {canDeleteDeal ? (
          <>
            <span className={s.sep}>·</span>
            <button
              type="button"
              className={s.rowDanger}
              disabled={deleting}
              onClick={() => setDeleteTarget(row)}
            >
              {t('common.delete', 'Удалить')}
            </button>
          </>
        ) : null}
      </div>
    );
  }, [canDeleteDeal, deleting, markLost, markWon, openDetail, t]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget?.id) return;
    await deleteDeal(deleteTarget.id).unwrap();
    setDeleteTarget(null);
    listRef.current?.refetch?.();
  }, [deleteDeal, deleteTarget]);

  return (
    <>
      <ListPage
        ref={listRef}
        title={t('deals.title', 'Deals')}
        source="deals"
        columns={columns}
        defaultQuery={defaultQuery}
        actions={actions}
        rowActions={rowActions}
        rowActionsWidth={280}
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
                key: 'q',
                placeholder: t('deals.filters.searchPlaceholder', 'Search deals'),
                debounce: 400,
              },
              {
                type: 'select',
                key: 'pipelineId',
                label: t('deals.filters.pipeline', 'Pipeline'),
                options: [{ value: '', label: t('deals.filters.allPipelines', 'All pipelines') }],
              },
              {
                type: 'select',
                key: 'stageId',
                label: t('deals.filters.stage', 'Stage'),
                options: [{ value: '', label: t('deals.filters.allStages', 'All stages') }],
              },
              {
                type: 'select',
                key: 'responsibleId',
                label: t('deals.filters.owner', 'Owner'),
                options: [{ value: '', label: t('deals.filters.allOwners', 'All owners') }, ...ownerOptions],
              },
              {
                type: 'select',
                key: 'status',
                label: t('deals.filters.status', 'Status'),
                options: statusOptions,
              },
              {
                type: 'custom',
                                // render: описывает рендер соответствующего блока UI.
render: ({ query, onChange }) => (
                  <div className={s.dateRange}>
                    <DateField
                      inputClassName={s.dateInput}
                      value={query.dateFrom || ''}
                      onValueChange={(value) => onChange((q) => ({
                        ...q,
                        dateFrom: value || undefined,
                        page: 1,
                      }))}
                      fullWidth={false}
                    />
                    <DateField
                      inputClassName={s.dateInput}
                      value={query.dateTo || ''}
                      onValueChange={(value) => onChange((q) => ({
                        ...q,
                        dateTo: value || undefined,
                        page: 1,
                      }))}
                      fullWidth={false}
                    />
                  </div>
                ),
              },
            ]}
          />
        )}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('deals.modal.new.title', 'New deal')}
        size="lg"
      >
        <DealForm
          loading={creating}
          onCancel={() => setOpen(false)}
          onSubmit={async (payload) => {
            try {
              await createDeal(payload).unwrap();
              setOpen(false);
              listRef.current?.refetch?.();
            } catch {}
          }}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('deals.confirm.deleteTitle', 'Удалить сделку?')}
        text={t(
          'deals.confirm.deleteText',
          'Сделка будет удалена или архивирована согласно настройкам системы.'
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
