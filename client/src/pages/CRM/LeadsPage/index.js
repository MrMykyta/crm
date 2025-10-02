import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ListPage from '../../../components/ListPage';
import Modal from '../../../components/Modal';
import CounterpartyForm from '../CounterpartyForm';
import { createResource } from '../../../api/resources';

function fmtDate(s, locale){ if(!s) return ''; try{ return new Date(s).toLocaleDateString(locale); }catch{ return s; } }

export default function LeadsPage() {
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { t, i18n } = useTranslation();

  const columns = [
    {
      key:'shortName',
      title: t('crm.table.columns.lead'),
      sortable:true,
      render:(r)=>(
        <div style={{display:'flex', flexDirection:'column', gap:4}}>
          <div style={{fontWeight:600}}>{r.shortName || r.fullName}</div>
          <div style={{fontSize:12, color:'var(--muted)'}}>
            {t(`crm.enums.status.${r.status}`)}
            {r.city ? ` • ${r.city}` : ''}
            {r.nip ? ` • NIP: ${r.nip}` : ''}
          </div>
        </div>
      )
    },
    {
      key:'createdAt',
      title: t('crm.table.columns.createdAt'),
      sortable:true,
      render:(r)=> fmtDate(r.createdAt, i18n.language)
    },
  ];

  const footer = (
    <>
      <button type="button" className="btn" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
      <button form="lead-create-form" className="primary" disabled={saving}>
        {saving ? t('common.saving') : t('common.save')}
      </button>
    </>
  );

  return (
    <>
      <ListPage
        ref={listRef}
        title={t('crm.titles.leads')}
        endpoint="/counterparties"
        columns={columns}
        defaultQuery={{ type:'lead', sort:'createdAt', dir:'DESC', limit:25 }}
        actions={<button className="primary" onClick={()=>setOpen(true)}>{t('crm.actions.addLead')}</button>}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('crm.dialogs.newLead')}
        size="lg"
        footer={footer}
      >
        <CounterpartyForm
          id="lead-create-form"
          defaultType="lead"
          loading={saving}
          withButtons={false}
          onCancel={() => setOpen(false)}
          onSubmit={async (values)=>{
            setSaving(true);
            try{
              await createResource('/counterparties', { ...values, type:'lead' });
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