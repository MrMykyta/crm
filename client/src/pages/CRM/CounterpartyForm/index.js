import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import s from './CounterpartyForm.module.css';
import { getCountryOptions } from '../../../utils/countries';

const TYPES = ['lead','client','partner','supplier','manufacturer'];
const STATUSES = ['potential','active','inactive'];

const CONTACT_CHANNELS = ['email','phone','website','telegram','whatsapp','linkedin'];

const MAX = {
  shortName: 200, fullName: 200, nip: 10, regon: 14, krs: 14, bdo: 30,
  country: 2, city: 128, postalCode: 12, street: 128, description: 2000,
};

function trimOrNull(v){ if(v==null) return null; const t=String(v).trim(); return t.length?t:null; }
function onlyDigits(s){ return /^\d+$/.test(s); }
const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const phoneRx = /^[+()\d\-.\s]{5,}$/;

function validate(values, contacts, t){
  const e = {};
  if (!values.shortName?.trim()) e.shortName = t('crm.form.errors.requiredShort');
  if (!values.fullName?.trim())  e.fullName  = t('crm.form.errors.requiredFull');

  Object.entries(MAX).forEach(([k,max])=>{
    if (values[k]!=null && String(values[k]).length>max) e[k]=t('crm.form.errors.max', { max });
  });

  if (!TYPES.includes(values.type))   e.type   = t('crm.form.errors.badType');
  if (!STATUSES.includes(values.status)) e.status = t('crm.form.errors.badStatus');

  if (values.nip){
    if (!onlyDigits(values.nip)) e.nip = t('crm.form.errors.digitsOnly');
    else if (values.nip.length!==10) e.nip = t('crm.form.errors.nipLen');
  }
  if (values.regon && !onlyDigits(values.regon)) e.regon = t('crm.form.errors.digitsOnly');
  if (values.krs   && !onlyDigits(values.krs))   e.krs   = t('crm.form.errors.digitsOnly');
  if (values.country && !/^[A-Za-z]{2}$/.test(values.country)) e.country = t('crm.form.errors.countryIso');

  const contactsErr = [];
  contacts.forEach((c, idx)=>{
    const rowErr = {};
    if (!c.channel) rowErr.channel = t('crm.form.errors.selectChannel');
    if (!c.value || !String(c.value).trim()) rowErr.value = t('crm.form.errors.valueRequired');
    if (c.channel==='email' && c.value && !emailRx.test(c.value)) rowErr.value=t('crm.form.errors.badEmail');
    if (c.channel==='phone' && c.value && !phoneRx.test(c.value)) rowErr.value=t('crm.form.errors.badPhone');
    contactsErr[idx] = Object.keys(rowErr).length ? rowErr : null;
  });
  if (contactsErr.some(Boolean)) e.contacts = contactsErr;

  return e;
}

export default function CounterpartyForm({
  id,
  defaultType='client',
  defaultStatus,
  onSubmit,
  onCancel,
  loading=false,
  withButtons=true,
  initial={},
}) {
  const { t, i18n } = useTranslation();

  const initialState = useMemo(()=>({
    shortName:'', fullName:'', nip:'', regon:'', krs:'', bdo:'',
    country:'', city:'', postalCode:'', street:'', description:'',
    type: defaultType,
    status: defaultStatus ?? (defaultType==='lead' ? 'potential' : 'active'),
    isCompany: true,
    ...initial,
  }), [defaultType, defaultStatus, initial]);

  const [values, setValues] = useState(initialState);
  const [contacts, setContacts] = useState(initial.contacts || []);
  const [errors, setErrors] = useState({});

  const countryOptions = useMemo(() => getCountryOptions(i18n.language), [i18n.language]);

  const set = (name, value) => {
    if (name==='country') value = value.toUpperCase().slice(0, MAX.country);
    if (typeof value==='string' && MAX[name]) value = value.slice(0, MAX[name]);
    setValues(v => ({ ...v, [name]: value }));
  };

  const addContact = () => setContacts(list => [...list, { channel:'email', value:'', isPrimary: list.length===0 }]);
  const updContact = (idx, patch) => setContacts(list => list.map((c,i)=> i===idx ? { ...c, ...patch } : c));
  const delContact = (idx) => setContacts(list => list.filter((_,i)=> i!==idx));
  const setPrimary = (idx) => setContacts(list => list.map((c,i)=> ({ ...c, isPrimary: i===idx })));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = {
      ...values,
      shortName: values.shortName?.trim(),
      fullName:  values.fullName?.trim(),
      nip:        trimOrNull(values.nip),
      regon:      trimOrNull(values.regon),
      krs:        trimOrNull(values.krs),
      bdo:        trimOrNull(values.bdo),
      country:    trimOrNull(values.country),
      city:       trimOrNull(values.city),
      postalCode: trimOrNull(values.postalCode),
      street:     trimOrNull(values.street),
      description:trimOrNull(values.description),
    };
    const cleanContacts = contacts
      .map(c => ({ channel:c.channel, value:String(c.value||'').trim(), isPrimary: !!c.isPrimary }))
      .filter(c => c.value);

    const v = validate(next, cleanContacts, t);
    setErrors(v);
    if (Object.keys(v).length) return;

    await onSubmit({ ...next, contacts: cleanContacts });
  };

  const counter = (name) => {
    const max = MAX[name]; if (!max) return null;
    const val = values[name] ? String(values[name]) : '';
    return <span className={s.counter}>{val.length} / {max}</span>;
  };

  return (
    <form id={id} className={s.form} onSubmit={handleSubmit}>
      <div className={s.grid}>
        {/* Названия */}
        <div className={s.field}>
          <label className={s.label}>
            {t('crm.form.fields.shortName')}* {counter('shortName')}
          </label>
          <input
            data-autofocus
            className={`${s.input} ${errors.shortName ? s.invalid : ''}`}
            value={values.shortName}
            onChange={(e)=>set('shortName', e.target.value)}
            maxLength={MAX.shortName}
            placeholder={t('crm.form.placeholders.shortName')}
            required
          />
          {errors.shortName && <div className={s.err}>{errors.shortName}</div>}
        </div>

        <div className={s.field}>
          <label className={s.label}>
            {t('crm.form.fields.fullName')}* {counter('fullName')}
          </label>
          <input
            className={`${s.input} ${errors.fullName ? s.invalid : ''}`}
            value={values.fullName}
            onChange={(e)=>set('fullName', e.target.value)}
            maxLength={MAX.fullName}
            placeholder={t('crm.form.placeholders.fullName')}
            required
          />
          {errors.fullName && <div className={s.err}>{errors.fullName}</div>}
        </div>

        {/* Тип/Статус */}
        <div className={s.field}>
          <label className={s.label}>{t('crm.form.fields.type')}</label>
          <select
            className={`${s.input} ${errors.type ? s.invalid : ''}`}
            value={values.type}
            onChange={(e)=>set('type', e.target.value)}
          >
            {TYPES.map(v => <option key={v} value={v}>{t(`crm.enums.type.${v}`)}</option>)}
          </select>
          {errors.type && <div className={s.err}>{errors.type}</div>}
        </div>

        <div className={s.field}>
          <label className={s.label}>{t('crm.form.fields.status')}</label>
          <select
            className={`${s.input} ${errors.status ? s.invalid : ''}`}
            value={values.status}
            onChange={(e)=>set('status', e.target.value)}
          >
            {STATUSES.map(v => <option key={v} value={v}>{t(`crm.enums.status.${v}`)}</option>)}
          </select>
          {errors.status && <div className={s.err}>{errors.status}</div>}
        </div>

        {/* Рег. номера */}
        <div className={s.field}>
          <label className={s.label}>
            {t('crm.form.fields.nip')} {counter('nip')}
          </label>
          <input
            className={`${s.input} ${errors.nip ? s.invalid : ''}`}
            value={values.nip}
            onChange={(e)=>set('nip', e.target.value.replace(/[^\d]/g,''))}
            maxLength={MAX.nip}
            inputMode="numeric"
            placeholder={t('crm.form.placeholders.nip')}
          />
          {errors.nip && <div className={s.err}>{errors.nip}</div>}
        </div>

        <div className={s.field}>
          <label className={s.label}>
            {t('crm.form.fields.regon')} {counter('regon')}
          </label>
          <input
            className={`${s.input} ${errors.regon ? s.invalid : ''}`}
            value={values.regon}
            onChange={(e)=>set('regon', e.target.value.replace(/[^\d]/g,''))}
            maxLength={MAX.regon}
            inputMode="numeric"
          />
          {errors.regon && <div className={s.err}>{errors.regon}</div>}
        </div>

        <div className={s.field}>
          <label className={s.label}>
            {t('crm.form.fields.krs')} {counter('krs')}
          </label>
          <input
            className={`${s.input} ${errors.krs ? s.invalid : ''}`}
            value={values.krs}
            onChange={(e)=>set('krs', e.target.value.replace(/[^\d]/g,''))}
            maxLength={MAX.krs}
            inputMode="numeric"
          />
          {errors.krs && <div className={s.err}>{errors.krs}</div>}
        </div>

        <div className={s.field}>
          <label className={s.label}>
            {t('crm.form.fields.bdo')} {counter('bdo')}
          </label>
          <input
            className={`${s.input} ${errors.bdo ? s.invalid : ''}`}
            value={values.bdo}
            onChange={(e)=>set('bdo', e.target.value)}
            maxLength={MAX.bdo}
          />
          {errors.bdo && <div className={s.err}>{errors.bdo}</div>}
        </div>

        {/* Адрес */}
        <div className={s.field}>
          <label className={s.label}>{t('crm.form.fields.country')}</label>
          <select
            className={`${s.input} ${errors.country ? s.invalid : ''}`}
            value={values.country || ''}
            onChange={(e)=>set('country', e.target.value)}
          >
            <option value="">{t('common.none')}</option>
            {countryOptions.map(c => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
          {errors.country && <div className={s.err}>{errors.country}</div>}
        </div>

        <div className={s.field}>
          <label className={s.label}>
            {t('crm.form.fields.city')} {counter('city')}
          </label>
          <input
            className={`${s.input} ${errors.city ? s.invalid : ''}`}
            value={values.city}
            onChange={(e)=>set('city', e.target.value)}
            maxLength={MAX.city}
          />
          {errors.city && <div className={s.err}>{errors.city}</div>}
        </div>

        <div className={s.field}>
          <label className={s.label}>
            {t('crm.form.fields.postalCode')} {counter('postalCode')}
          </label>
          <input
            className={`${s.input} ${errors.postalCode ? s.invalid : ''}`}
            value={values.postalCode}
            onChange={(e)=>set('postalCode', e.target.value)}
            maxLength={MAX.postalCode}
            placeholder={t('crm.form.placeholders.postalCode')}
          />
          {errors.postalCode && <div className={s.err}>{errors.postalCode}</div>}
        </div>

        <div className={s.field}>
          <label className={s.label}>
            {t('crm.form.fields.street')} {counter('street')}
          </label>
          <input
            className={`${s.input} ${errors.street ? s.invalid : ''}`}
            value={values.street}
            onChange={(e)=>set('street', e.target.value)}
            maxLength={MAX.street}
          />
          {errors.street && <div className={s.err}>{errors.street}</div>}
        </div>

        {/* Описание */}
        <div className={`${s.field} ${s.full}`}>
          <label className={s.label}>
            {t('crm.form.fields.description')} {counter('description')}
          </label>
          <textarea
            className={`${s.input} ${errors.description ? s.invalid : ''}`}
            rows={4}
            value={values.description}
            onChange={(e)=>set('description', e.target.value)}
            maxLength={MAX.description}
          />
          {errors.description && <div className={s.err}>{errors.description}</div>}
        </div>
      </div>

      {/* Контакты */}
      <div className={s.sectionHeader}>
        <h4>{t('crm.form.sections.contacts')}</h4>
        <button type="button" className={s.btnAdd} onClick={addContact}>
          {t('crm.form.actions.addContact')}
        </button>
      </div>

      <div className={s.contactsGrid}>
        {contacts.length === 0 && (
          <div className={s.muted}>{t('crm.form.hints.noContacts')}</div>
        )}
        {contacts.map((c, idx) => {
          const rowErr = Array.isArray(errors.contacts) ? errors.contacts[idx] : null;
          return (
            <div key={idx} className={s.contactRow}>
              <select
                className={`${s.input} ${rowErr?.channel ? s.invalid:''}`}
                value={c.channel}
                onChange={(e)=>updContact(idx, { channel: e.target.value })}
                style={{minWidth:140}}
              >
                {CONTACT_CHANNELS.map(v => (
                  <option key={v} value={v}>{t(`crm.channels.${v}`)}</option>
                ))}
              </select>

              <input
                className={`${s.input} ${rowErr?.value ? s.invalid:''}`}
                value={c.value}
                onChange={(e)=>updContact(idx, { value: e.target.value })}
                placeholder={t('crm.form.placeholders.contactValue')}
              />

              <label className={s.chkPrimary}>
                <input type="radio" name="primaryContact" checked={!!c.isPrimary} onChange={()=>setPrimary(idx)} />
                <span>{t('crm.form.fields.primary')}</span>
              </label>

              <button type="button" className={s.btnDel} onClick={()=>delContact(idx)}>
                {t('crm.form.actions.remove')}
              </button>

              {rowErr?.channel && <div className={s.errRow}>{rowErr.channel}</div>}
              {rowErr?.value && <div className={s.errRow}>{rowErr.value}</div>}
            </div>
          );
        })}
      </div>

      {withButtons && (
        <div className={s.actions}>
          <button type="button" className={s.btn} onClick={onCancel}>{t('common.cancel')}</button>
          <button type="submit" className={s.primary} disabled={loading}>
            {loading ? t('common.saving') : t('common.save')}
          </button>
        </div>
      )}
    </form>
  );
}