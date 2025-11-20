// src/pages/CRM/Counterparty/ClientsPage/index.jsx
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

export default function ClientsPage() {
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const openAsModal = useOpenAsModal();

  // prefs таблицы — отдельный ключ под клиентов
  const { colWidths, colOrder, onColumnResize, onColumnOrderChange } =
    useGridPrefs('crm.clients');

  const [createCounterparty, { isLoading: creating }] =
    useCreateCounterpartyMutation();

  const openDetail = useCallback(
    (id) => {
      const suffix = openAsModal ? '?modal=1' : '';
      // клиенты → на страницу деталей клиентов
      navigate(`/main/crm/clients/${id}${suffix}`);
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
        render: (r) => (
          <LinkCell
            primary={r.shortName || r.fullName}
            secondary={
              r.fullName && r.fullName !== r.shortName ? r.fullName : null
            }
            onClick={() => openDetail(r.id)}
            ariaLabel={t('crm.actions.openClient', {
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
        render: (r) => r.nip || '—',
      },
      {
        key: 'address',
        title: t('crm.table.columns.address'),
        width: 360,
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
        render: (r) => t(`crm.enums.type.${r.type}`),
      },
      {
        key: 'status',
        title: t('crm.table.columns.status'),
        sortable: true,
        width: 140,
        render: (r) => t(`crm.enums.status.${r.status}`),
      },
      {
        key: 'owner',
        title: t('crm.table.columns.owner'),
        width: 200,
        render: (r) => r.mainResponsibleUser || '—',
      },
    ],
    [t, i18n.language, openDetail]
  );

  // клиенты — ВСЕГДА type=client
  const defaultQuery = useMemo(
    () => ({
      sort: 'createdAt',
      dir: 'DESC',
      limit: 25,
      type: 'client',
    }),
    []
  );

  const actions = useMemo(
    () => (
      <AddButton
        onClick={() => setOpen(true)}
        title={t('crm.actions.addClient')}
      >
        {t('crm.actions.addClient')}
      </AddButton>
    ),
    [t]
  );

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
        // источник — та же сущность counterparty, но фильтр type=client
        source="counterparties"
        title={t('crm.titles.clients')}
        endpoint="/clients"
        columns={columns}
        defaultQuery={defaultQuery}
        actions={actions}
        columnWidths={colWidths}
        onColumnResize={onColumnResize}
        columnOrder={colOrder}
        onColumnOrderChange={onColumnOrderChange}
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
        title={t('crm.dialogs.newClient')}
        size="lg"
        footer={footer}
      >
        <CounterpartyForm
          id="cp-create-form"
          defaultType="client"
          defaultStatus="active"
          allowedTypes={['client']} // создаём только клиентов
          allowedStatuses={['potential', 'active', 'inactive']}
          lockType
          loading={saving || creating}
          withButtons={false}
          onCancel={() => setOpen(false)}
          onSubmit={async (values) => {
            setSaving(true);
            try {
              await createCounterparty({
                ...values,
                type: 'client',
                status: values.status || 'active',
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