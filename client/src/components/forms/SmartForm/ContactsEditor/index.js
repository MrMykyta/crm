import { useTranslation } from "react-i18next";
import s from "../SmartForm.module.css";

const CHANNELS = ['email','phone','website','telegram','whatsapp','linkedin'];

export default function ContactsEditor({ value = [], onChange }) {
  const { t } = useTranslation();
  const add = () => onChange([ ...value, { channel:'email', value:'', isPrimary: value.length===0 } ]);
  const upd = (i, patch) => onChange(value.map((c,idx)=> idx===i ? { ...c, ...patch } : c));
  const del = (i) => onChange(value.filter((_,idx)=> idx!==i));
  const setPrimary = (i) => onChange(value.map((c,idx)=> ({ ...c, isPrimary: idx===i })));

  return (
    <div className={s.contacts}>
      <div className={s.contactsHead}>
        <div className={s.sectionTitle}>{t('crm.form.sections.contacts')}</div>
        <button type="button" className={s.btnAdd} onClick={add}>{t('crm.form.actions.addContact')}</button>
      </div>

      {value.length===0 && <div className={s.muted}>{t('crm.form.hints.noContacts')}</div>}

      {value.map((c, i)=>(
        <div key={i} className={s.contactRow}>
          <select className={s.input} value={c.channel} onChange={e=>upd(i,{channel:e.target.value})} style={{minWidth:140}}>
            {CHANNELS.map(v=> <option key={v} value={v}>{t(`crm.channels.${v}`)}</option>)}
          </select>

          <input className={s.input} value={c.value} onChange={e=>upd(i,{value:e.target.value})}
                 placeholder={t('crm.form.placeholders.contactValue')} />

          <label className={s.chkLine}>
            <input type="radio" name="primaryContact" checked={!!c.isPrimary} onChange={()=>setPrimary(i)} />
            {t('crm.form.fields.primary')}
          </label>

          <button type="button" className={s.btnDel} onClick={()=>del(i)}>{t('crm.form.actions.remove')}</button>
        </div>
      ))}
    </div>
  );
}