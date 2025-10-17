// src/pages/crm/counterparties/CounterpartiesPage.jsx
import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ListPage, { Button } from '../../../components/ListPage';
import Modal from '../../../components/Modal';
import CounterpartyForm from '../CounterpartyForm';
import { createResource } from '../../../api/resources';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getMyPreferences, saveMyPreferences } from '../../../api/user';

const LS_KEY = 'grid.counterparties.colWidths';

export default function CounterpartiesPage() {
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const openAsModal = params.get('modal') === '1';

  // === ширины колонок
  const [colWidths, setColWidths] = useState({});
  const saveTimer = useRef(null);

  // 1) быстрый старт из localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setColWidths(JSON.parse(raw));
    } catch {}
  }, []);

  // 2) догружаем prefs с сервера и МЕРЖИМ (приоритет локалки)
  useEffect(() => {
    (async () => {
      try {
        const prefs = await getMyPreferences();
        const fromPrefs = prefs?.appearance?.grids?.counterparties?.columnWidths || {};
        setColWidths(prev => ({ ...fromPrefs, ...prev }));
      } catch {}
    })();
  }, []);

  // 3) хендлер ресайза получает ВСЮ карту ширин (DataTable шлёт nextMap)
  const handleColumnResize = useCallback((nextMap) => {
    setColWidths(nextMap);
    try { localStorage.setItem(LS_KEY, JSON.stringify(nextMap)); } catch {}

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const prefs = await getMyPreferences();
        const prevAppearance = prefs?.appearance || {};
        const nextAppearance = {
          ...prevAppearance,
          grids: {
            ...(prevAppearance.grids || {}),
            counterparties: {
              ...(prevAppearance.grids?.counterparties || {}),
              // сохраняем всю карту ширин
              columnWidths: { ...(prevAppearance.grids?.counterparties?.columnWidths || {}), ...nextMap },
            },
          },
        };
        await saveMyPreferences({ appearance: nextAppearance });
      } catch {}
    }, 400);
  }, []);

  const openDetail = useCallback((id) => {
    const suffix = openAsModal ? '?modal=1' : '';
    navigate(`/main/crm/counterparties/${id}${suffix}`);
  }, [navigate, openAsModal]);

  const columns = useMemo(() => ([
    {
      key: 'shortName',
      title: t('crm.table.columns.name'),
      sortable: true,
      render: (r) => (
        <button
          onClick={() => openDetail(r.id)}
          className="rowLinkReset"
          style={{ display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left' }}
          aria-label={t('crm.actions.openCounterparty', { name: r.shortName || r.fullName })}
        >
          <div style={{ fontWeight: 600 }}>{r.shortName || r.fullName}</div>
          {r.fullName && r.fullName !== r.shortName && (
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.fullName}</div>
          )}
        </button>
      ),
    },
    {
      key: 'nip',
      title: t('crm.table.columns.nip'),
      sortable: true,
      render: (r) => r.nip || '—',
    },
    {
      key: 'address',
      title: t('crm.table.columns.address'),
      render: (r) => {
        const parts = [r.street, r.postcode, r.city, r.country].filter(Boolean).join(', ');
        return parts || '—';
      },
    },
    {
      key: 'type',
      title: t('crm.table.columns.type'),
      sortable: true,
      render: (r) => t(`crm.enums.type.${r.type}`),
    },
    {
      key: 'status',
      title: t('crm.table.columns.status'),
      sortable: true,
      render: (r) => t(`crm.enums.status.${r.status}`),
    },
    {
      key: 'owner',
      title: t('crm.table.columns.owner'),
      render: (r) => r.mainResponsibleUser || '—',
    },
  ]), [t, i18n.language, openDetail]);

  const defaultQuery = useMemo(() => ({ sort: 'createdAt', dir: 'DESC', limit: 25 }), []);
  const actions = useMemo(() => (
    <Button variant="primary" onClick={() => setOpen(true)}>
      {t('crm.actions.addCounterparty')}
    </Button>
  ), [t]);

  const footer = useMemo(() => (
    <>
      <Modal.Button onClick={() => setOpen(false)}>
        {t('common.cancel')}
      </Modal.Button>
      <Modal.Button variant="primary" form="cp-create-form" disabled={saving}>
        {saving ? t('common.saving') : t('common.save')}
      </Modal.Button>
    </>
  ), [t, saving]);

  return (
    <>
      <style>{`
        .rowLinkReset{
          appearance:none; background:none; border:0; padding:0; margin:0; color:inherit; font:inherit;
          cursor:pointer;
        }
        .rowLinkReset:hover div:first-child{ text-decoration: underline; }
      `}</style>

      <ListPage
        ref={listRef}
        title={t('crm.titles.counterparties')}
        endpoint="/counterparties"
        columns={columns}
        defaultQuery={defaultQuery}
        actions={actions}
        columnWidths={colWidths}              // ← текущие ширины
        onColumnResize={handleColumnResize}   // ← сохраняем всю карту
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('crm.dialogs.newCounterparty')}
        size="lg"
        footer={footer}
      >
        <CounterpartyForm
          id="cp-create-form"
          defaultType="client"
          loading={saving}
          withButtons={false}
          onCancel={() => setOpen(false)}
          onSubmit={async (values) => {
            setSaving(true);
            try {
              await createResource('/counterparties', values);
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