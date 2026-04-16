import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import ListPage from '../../../../components/data/ListPage';
import Modal from '../../../../components/Modal';
import CounterpartyForm from '../../CounterpartyForm';

import useGridPrefs from '../../../../hooks/useGridPrefs';
import useOpenAsModal from '../../../../hooks/useOpenAsModal';

import LinkCell from '../../../../components/cells/LinkCell';
import AddressCell from '../../../../components/cells/AddressCell';
import FilterToolbar from '../../../../components/filters/FilterToolbar';
import AddButton from '../../../../components/buttons/AddButton/AddButton';

import {
  useCreateCounterpartyMutation,
} from '../../../../store/rtk/counterpartyApi';

/**
 * Страница списка лидов:
 * фиксирует type=lead и управляет таблицей/фильтрами/созданием лида.
 */
export default function LeadsPage() {
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const openAsModal = useOpenAsModal();

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
  } = useGridPrefs('crm.leads');

  const [createCounterparty, { isLoading: creating }] = useCreateCounterpartyMutation();

  // Открывает карточку лида в обычном режиме или как modal-route.
  const openDetail = useCallback(
    (id) => {
      const suffix = openAsModal ? '?modal=1' : '';
      navigate(`/main/leads/${id}${suffix}`);
    },
    [navigate, openAsModal]
  );

  // Конфигурация колонок таблицы лидов.
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
            ariaLabel={t('crm.actions.openLead', {
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
            postcode={r.postcode}
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
        key: 'owner',
        title: t('crm.table.columns.owner'),
        width: 200,
                // render: описывает рендер соответствующего блока UI.
render: (r) => r.mainResponsibleUser || '—',
      },
    ],
    [t, i18n.language, openDetail]
  );

  // ❗ Лиды — это ВСЕГДА type=lead
  const defaultQuery = useMemo(
    () => ({
      sort: 'createdAt',
      dir: 'DESC',
      limit: 25,
      type: 'lead',        // <--- фиксируем тип лида
    }),
    []
  );

  // Основная кнопка действия страницы (создать лид).
  const actions = useMemo(
    () => (
      <AddButton onClick={() => setOpen(true)} title={t('crm.actions.addLead')}>
        {t('crm.actions.addLead')}
      </AddButton>
    ),
    [t]
  );

  // Кнопки футера модалки создания лида.
  const footer = useMemo(
    () => (
      <>
        <Modal.Button onClick={() => setOpen(false)}>{t('common.cancel')}</Modal.Button>
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
        // источник остаётся "counterparties", просто всегда фильтруем по type=lead
        source="counterparties"
        title={t('crm.titles.leads')}
        endpoint="/leads"           // можешь оставить для телеметрии/логов
        columns={columns}
        defaultQuery={defaultQuery}
        actions={actions}
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
                placeholder: t('crm.filters.searchPlaceholder'),
                debounce: 400,
              },
              // ❗ На странице лидов тип не даём менять, только статус
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
            ]}
          />
        )}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('crm.dialogs.newLead')}
        size="lg"
        footer={footer}
      >
        <CounterpartyForm
            id="cp-create-form"
            defaultType="lead"
            defaultStatus="potential"
            allowedTypes={['lead']}                      // показываем только тип lead
            allowedStatuses={['potential','active','inactive']}
            lockType                                     // тип фиксированный
            loading={saving || creating}
            withButtons={false}
            onCancel={() => setOpen(false)}
            // Создаёт лида и обновляет таблицу без полного перезапуска страницы.
            onSubmit={async (values) => {
                setSaving(true);
                try {
                await createCounterparty({
                    ...values,
                    type: 'lead',                          // на всякий случай дубль
                    status: values.status || 'potential',
                }).unwrap();
                setOpen(false);
                listRef.current?.refetch?.();
                } finally {
                setSaving(false);
                }
            }}
        />
      </Modal>
    </>
  );
}

