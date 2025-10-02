// src/pages/crm/counterparties/CounterpartiesPage.jsx
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ListPage, { Button } from '../../../components/ListPage';
import Modal from '../../../components/Modal';
import CounterpartyForm from '../CounterpartyForm';
import { createResource } from '../../../api/resources';
import { countryLabel } from '../../../utils/countries';
import { useNavigate, useSearchParams } from 'react-router-dom';

function fmtDate(s, locale){ if(!s) return ''; try{ return new Date(s).toLocaleDateString(locale); }catch{ return s; } }
function primaryContact(contacts=[]){
  const p = contacts.find(c=>c.isPrimary) || contacts.find(c=>c.channel==='email') || contacts.find(c=>c.channel==='phone');
  return p ? `${p.channel}: ${p.valueNorm ?? p.value}` : null;
}

export default function CounterpartiesPage() {
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const openAsModal = params.get('modal') === '1';

  const openDetail = (id) => {
    const suffix = openAsModal ? '?modal=1' : '';
    navigate(`/main/crm/counterparties/${id}${suffix}`);
  };

  const columns = [
    {
      key:'shortName',
      title: t('crm.table.columns.counterparty'),
      sortable:true,
      render:(r)=>(
        <button
          onClick={()=>openDetail(r.id)}
          className="rowLinkReset"
          style={{display:'flex', flexDirection:'column', gap:4, textAlign:'left'}}
          aria-label={t('crm.actions.openCounterparty', { name: r.shortName || r.fullName })}
        >
          <div style={{fontWeight:600}}>{r.shortName || r.fullName}</div>
          <div style={{fontSize:12, color:'var(--muted)'}}>
            {t(`crm.enums.type.${r.type}`)} • {t(`crm.enums.status.${r.status}`)}
            {r.city ? ` • ${r.city}` : ''}
            {r.country ? `, ${countryLabel(r.country, i18n.language)}` : ''}
            {r.nip ? ` • NIP: ${r.nip}` : ''}
          </div>
        </button>
      )
    },
    {
      key:'contacts',
      title: t('crm.table.columns.contacts'),
      render:(r)=>{
        const count = r.contacts?.length || 0;
        const main = primaryContact(r.contacts||[]);
        return (
          <div style={{display:'flex', flexDirection:'column'}}>
            <div>{count ? t('crm.table.contactCount', { count }) : '—'}</div>
            {main && <div style={{fontSize:12, color:'var(--muted)'}}>{main}</div>}
          </div>
        );
      }
    },
    {
      key:'updatedAt',
      title: t('crm.table.columns.updatedAt'),
      sortable:true,
      render:(r)=> fmtDate(r.updatedAt, i18n.language)
    },
  ];

  const footer = (
    <>
      <Modal.Button onClick={()=>setOpen(false)}>
        {t('common.cancel')}
      </Modal.Button>
      <Modal.Button variant="primary" form="cp-create-form" disabled={saving}>
        {saving ? t('common.saving') : t('common.save')}
      </Modal.Button>
    </>
  );

  return (
    <>
      <style>{`
        /* сбрасываем стили button, чтобы выглядело как текст в твоей таблице */
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
        defaultQuery={{ sort:'createdAt', dir:'DESC', limit:25 }}
        actions={
          <Button variant="primary" onClick={()=>setOpen(true)}>
            {t('crm.actions.addCounterparty')}
          </Button>
        }
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
          onSubmit={async (values)=>{
            setSaving(true);
            try{
              await createResource('/counterparties', values);
              setOpen(false);
              listRef.current?.refetch();
            } finally {
              setSaving(false);
            }
          }}
        />
      </Modal>
    </>
  );
}