import { getCountryOptions } from "../utils/countries";

export const COUNTERPARTY_MAX = {
  shortName: 200, fullName: 200, nip: 10, regon: 14, krs: 14, bdo: 30,
  country: 2, city: 128, postalCode: 12, street: 128, description: 2000,
};

export function counterpartySchema(i18n){
  const countryOpts = getCountryOptions(i18n.language).map(c=>({ value:c.code, label:c.label }));
  const typeOpts = ['lead','client','partner','supplier','manufacturer']
    .map(v=>({ value:v, labelKey:`crm.enums.type.${v}` }));
  const statusOpts = ['potential','active','inactive']
    .map(v=>({ value:v, labelKey:`crm.enums.status.${v}` }));

  return [
    { kind:'section', title:'Основное' },

    { name:'shortName', label:'crm.form.fields.shortName', type:'text',
      max:COUNTERPARTY_MAX.shortName, placeholder:'crm.form.placeholders.shortName', float:true, required:true },
    { name:'fullName',  label:'crm.form.fields.fullName',  type:'text',
      max:COUNTERPARTY_MAX.fullName,  placeholder:'crm.form.placeholders.fullName',  float:true, required:true },

    // селекты
    { name:'type',   label:'crm.form.fields.type',   type:'select', float:true, options:typeOpts },
    { name:'status', label:'crm.form.fields.status', type:'select', float:true, options:statusOpts },

    { kind:'section', title:'Регистрация' },

    { name:'nip',   label:'crm.form.fields.nip',   type:'text', max:COUNTERPARTY_MAX.nip,   inputMode:'numeric', float:true, hint:'10 цифр' },
    { name:'regon', label:'crm.form.fields.regon', type:'text', max:COUNTERPARTY_MAX.regon, inputMode:'numeric', float:true },
    { name:'krs',   label:'crm.form.fields.krs',   type:'text', max:COUNTERPARTY_MAX.krs,   inputMode:'numeric', float:true },
    { name:'bdo',   label:'crm.form.fields.bdo',   type:'text', max:COUNTERPARTY_MAX.bdo,   float:true },

    { kind:'section', title:'Адрес' },

    { name:'country', label:'crm.form.fields.country', type:'select', float:true,
      options:[{value:'', labelKey:'common.none'}, ...countryOpts], upper:true, max:2 },
    { name:'city',       label:'crm.form.fields.city',       type:'text', max:COUNTERPARTY_MAX.city,       float:true },
    { name:'postalCode', label:'crm.form.fields.postalCode', type:'text', max:COUNTERPARTY_MAX.postalCode, float:true,
      placeholder:'crm.form.placeholders.postalCode' },
    { name:'street',     label:'crm.form.fields.street',     type:'text', max:COUNTERPARTY_MAX.street,     float:true },

    { kind:'section', title:'Прочее' },

    { name:'description', label:'crm.form.fields.description', type:'textarea', full:true,
      max:COUNTERPARTY_MAX.description, float:true, rows:5 },
    { name:'isCompany',   label:'crm.form.fields.isCompany',   type:'checkbox' },
  ];
}

// нормализация туда/обратно
export const toFormCounterparty = (d)=>({
  shortName: d.shortName ?? '', fullName: d.fullName ?? '',
  nip:d.nip ?? '', regon:d.regon ?? '', krs:d.krs ?? '', bdo:d.bdo ?? '',
  country:d.country ?? '', city:d.city ?? '', postalCode:d.postalCode ?? '', street:d.street ?? '',
  description:d.description ?? '', type:d.type ?? 'lead', status:d.status ?? 'potential', isCompany: d.isCompany ?? true,
  contacts: Array.isArray(d.contacts) ? d.contacts.map(c=>({ channel:c.channel, value:c.valueNorm ?? c.value, isPrimary:!!c.isPrimary })) : []
});

export const toApiCounterparty = (v)=>({
  shortName:v.shortName.trim(), fullName:v.fullName.trim(),
  nip:trimOrNull(v.nip), regon:trimOrNull(v.regon), krs:trimOrNull(v.krs), bdo:trimOrNull(v.bdo),
  country:trimOrNull(v.country), city:trimOrNull(v.city), postalCode:trimOrNull(v.postalCode), street:trimOrNull(v.street),
  description:trimOrNull(v.description), type:v.type, status:v.status, isCompany:!!v.isCompany,
});

const trimOrNull = (x)=>{ if(x==null) return null; const s=String(x).trim(); return s?s:null; };