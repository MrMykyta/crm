import { getCountryOptions } from "../utils/countries";

export const COMPANY_MAX = {
  name: 200,
  website: 200,
  nip: 10,
  regon: 14,
  krs: 14,
  bdo: 30,
  country: 2,
  city: 128,
  postalCode: 12,
  street: 128,
  description: 2000,
};

export function companySchema(i18n) {
  const countryOpts = getCountryOptions(i18n.language).map(c => ({ value: c.code, label: c.label }));

  return [
    { kind: "section", title: "Основное" },
    { name: "name", label: "company.form.fields.name", type: "text",
      max: COMPANY_MAX.name, placeholder: "company.form.placeholders.name", float: true, required: true },

    { name: "website", label: "company.form.fields.website", type: "text",
      max: COMPANY_MAX.website, placeholder: "https://example.com", float: true },

    { kind: "section", title: "Регистрация" },
    { name: "nip",   label: "company.form.fields.nip",   type: "text", max: COMPANY_MAX.nip,   inputMode: "numeric", float: true},
    { name: "regon", label: "company.form.fields.regon", type: "text", max: COMPANY_MAX.regon, inputMode: "numeric", float: true },
    { name: "krs",   label: "company.form.fields.krs",   type: "text", max: COMPANY_MAX.krs,   inputMode: "numeric", float: true },
    { name: "bdo",   label: "company.form.fields.bdo",   type: "text", max: COMPANY_MAX.bdo,   float: true },

    { kind: "section", title: "Адрес" },
    { name: "country",    label: "company.form.fields.country", type: "select", float: true,
      options: [{ value: "", labelKey: "common.none" }, ...countryOpts], upper: true, max: COMPANY_MAX.country },
    { name: "city",       label: "company.form.fields.city",       type: "text", max: COMPANY_MAX.city,       float: true },
    { name: "postalCode", label: "company.form.fields.postalCode", type: "text", max: COMPANY_MAX.postalCode, float: true,
      placeholder: "company.form.placeholders.postalCode" },
    { name: "street",     label: "company.form.fields.street",     type: "text", max: COMPANY_MAX.street,     float: true },

    { kind: "section", title: "Прочее" },
    { name: "description", label: "company.form.fields.description", type: "textarea", full: true,
      max: COMPANY_MAX.description, float: true, rows: 5 },
  ];
}

export const toFormCompany = (d) => ({
  name:        d?.name ?? '',
  website:     d?.website ?? '',
  email:       d?.email ?? '',
  phone:       d?.phone ?? '',
  nip:         d?.nip ?? '',
  regon:       d?.regon ?? '',
  krs:         d?.krs ?? '',
  bdo:         d?.bdo ?? '',
  country:     d?.country ?? '',
  city:        d?.city ?? '',
  postalCode:  d?.postalCode ?? '',
  street:      d?.street ?? '',
  description: d?.description ?? '',
  avatarUrl:   d?.avatarUrl || '', // ← берём то, что вернул API
});

export const toApiCompany = (v) => ({
  name:        v.name?.trim(),
  website:     trimOrNull(v.website),
  email:       trimOrNull(v.email),
  phone:       trimOrNull(v.phone),
  nip:         trimOrNull(v.nip),
  regon:       trimOrNull(v.regon),
  krs:         trimOrNull(v.krs),
  bdo:         trimOrNull(v.bdo),
  country:     trimOrNull(v.country),
  city:        trimOrNull(v.city),
  postalCode:  trimOrNull(v.postalCode),
  street:      trimOrNull(v.street),
  description: trimOrNull(v.description),
  avatarUrl:   trimOrNull(v.avatarUrl), // ← сохраняем, если юзер руками подставил ссылку
});

const trimOrNull = (x) => {
  if (x == null) return null;
  const s = String(x).trim();
  return s ? s : null;
};