// src/schemas/counterparty.schema.js
import { getCountryOptions } from "../utils/countries";

export const COUNTERPARTY_MAX = {
  shortName: 200,
  fullName: 200,
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

const ALL_TYPES = ["lead", "client", "partner", "supplier", "manufacturer"];
const ALL_STATUSES = ["potential", "active", "inactive"];
const NOT_LEAD_STATUSES = ["active", "inactive"];


/**
 * БАЗОВАЯ схема для контрагента (все типы, все статусы).
 * Её можно использовать там, где нужна "универсальная" форма.
 */
export function counterpartySchema(i18n, { departmentOptions = [], includeDepartmentField = false } = {}) {
  const countryOpts = getCountryOptions(i18n.language).map((c) => ({
    value: c.code,
    label: c.label,
  }));

  const typeOpts = ALL_TYPES.map((v) => ({
    value: v,
    labelKey: `crm.enums.type.${v}`,
  }));

  const statusOpts = ALL_STATUSES.map((v) => ({
    value: v,
    labelKey: `crm.enums.status.${v}`,
  }));

  return [
    { kind: "section", title: "Основное" },

    {
      name: "shortName",
      label: "crm.form.fields.shortName",
      type: "text",
      max: COUNTERPARTY_MAX.shortName,
      placeholder: "crm.form.placeholders.shortName",
      float: true,
      required: true,
    },
    {
      name: "fullName",
      label: "crm.form.fields.fullName",
      type: "text",
      max: COUNTERPARTY_MAX.fullName,
      placeholder: "crm.form.placeholders.fullName",
      float: true,
      required: true,
    },

    // селекты
    {
      name: "type",
      label: "crm.form.fields.type",
      type: "select",
      float: true,
      options: typeOpts,
    },
    {
      name: "status",
      label: "crm.form.fields.status",
      type: "select",
      float: true,
      options: statusOpts,
    },
    ...(includeDepartmentField
      ? [
          {
            name: "departmentId",
            label: "crm.form.fields.department",
            type: "select",
            float: true,
            clearable: true,
            searchable: true,
            options: departmentOptions,
            placeholder: "crm.form.placeholders.department",
            hint: "crm.form.hints.departmentVisibility",
          },
        ]
      : []),

    { kind: "section", title: "Регистрация" },

    {
      name: "nip",
      label: "crm.form.fields.nip",
      type: "text",
      max: COUNTERPARTY_MAX.nip,
      inputMode: "numeric",
      float: true,
      hint: "10 цифр",
    },
    {
      name: "regon",
      label: "crm.form.fields.regon",
      type: "text",
      max: COUNTERPARTY_MAX.regon,
      inputMode: "numeric",
      float: true,
    },
    {
      name: "krs",
      label: "crm.form.fields.krs",
      type: "text",
      max: COUNTERPARTY_MAX.krs,
      inputMode: "numeric",
      float: true,
    },
    {
      name: "bdo",
      label: "crm.form.fields.bdo",
      type: "text",
      max: COUNTERPARTY_MAX.bdo,
      float: true,
    },

    { kind: "section", title: "Адрес" },

    {
      name: "country",
      label: "crm.form.fields.country",
      type: "select",
      float: true,
      options: [{ value: "", labelKey: "common.none" }, ...countryOpts],
      upper: true,
      max: 2,
    },
    {
      name: "city",
      label: "crm.form.fields.city",
      type: "text",
      max: COUNTERPARTY_MAX.city,
      float: true,
    },
    {
      name: "postalCode",
      label: "crm.form.fields.postalCode",
      type: "text",
      max: COUNTERPARTY_MAX.postalCode,
      float: true,
      placeholder: "crm.form.placeholders.postalCode",
    },
    {
      name: "street",
      label: "crm.form.fields.street",
      type: "text",
      max: COUNTERPARTY_MAX.street,
      float: true,
    },

    { kind: "section", title: "Прочее" },

    {
      name: "description",
      label: "crm.form.fields.description",
      type: "textarea",
      full: true,
      max: COUNTERPARTY_MAX.description,
      float: true,
      rows: 5,
    },
    {
      name: "isCompany",
      label: "crm.form.fields.isCompany",
      type: "checkbox",
    },
  ];
}

/**
 * 🎯 Схема для ЛИДОВ
 * Тип можно менять (lead → client/partner/...)
 */
export function counterpartyLeadSchema(i18n, extras = {}) {
  // здесь пока просто базовая схема, со всеми типами
  return counterpartySchema(i18n, extras);
}

/**
 * 🎯 Схема для КЛИЕНТОВ
 * Тип фиксированный "client", поле type из формы убираем вообще.
 */
export function counterpartyClientSchema(i18n, extras = {}) {
  const base = counterpartySchema(i18n, extras);

  return base.map((f) => {
    if (f.name !== "type") return f;

    return {
      ...f,
      // только один вариант — client
      options: [
        {
          value: "client",
          labelKey: "crm.enums.type.client",
        },
      ],
      readOnly: true,
      componentProps: {
        ...(f.componentProps || {}),
        disabled: true,   // если SmartForm передаёт в select — он станет серым
      },
    };
  });
}

/**
 * 🎯 Схема для ПРОЧИХ КОНТРАГЕНТОВ
 * (partner / supplier / manufacturer) — без lead/client в селекте.
 */
const ENTITY_TYPES = ["partner", "supplier", "manufacturer"];


// counterpartyEntitySchema: описывает схему валидации и преобразования данных.
export function counterpartyEntitySchema(i18n, extras = {}) {
  const base = counterpartySchema(i18n, extras);

  return base.map((f) => {
    if (f.name !== "type") return f;

    return {
      ...f,
      options: f.options.filter((opt) =>
        ENTITY_TYPES.includes(opt.value)
      ),
    };
  });
}

// нормализация туда/обратно
export // toFormCounterparty : to form counterparty.
// toFormCounterparty: описывает схему валидации и преобразования данных.
const toFormCounterparty = (d) => ({
  shortName: d.shortName ?? "",
  fullName: d.fullName ?? "",
  nip: d.nip ?? "",
  regon: d.regon ?? "",
  krs: d.krs ?? "",
  bdo: d.bdo ?? "",
  country: d.country ?? "",
  city: d.city ?? "",
  postalCode: d.postalCode ?? "",
  street: d.street ?? "",
  description: d.description ?? "",
  type: d.type ?? "lead",
  status: d.status ?? "potential",
  departmentId: d.departmentId ?? "",
  isCompany: d.isCompany ?? true,
  contacts: Array.isArray(d.contacts)
    ? d.contacts.map((c) => ({
        channel: c.channel,
        value: c.valueNorm ?? c.value,
        isPrimary: !!c.isPrimary,
      }))
    : [],
});

export // toApiCounterparty : to api counterparty.
// toApiCounterparty: описывает схему валидации и преобразования данных.
const toApiCounterparty = (v) => ({
  shortName: v.shortName.trim(),
  fullName: v.fullName.trim(),
  nip: trimOrNull(v.nip),
  regon: trimOrNull(v.regon),
  krs: trimOrNull(v.krs),
  bdo: trimOrNull(v.bdo),
  country: trimOrNull(v.country),
  city: trimOrNull(v.city),
  postalCode: trimOrNull(v.postalCode),
  street: trimOrNull(v.street),
  description: v.description ?? "",
  type: v.type,
  status: v.status,
  departmentId: trimOrNull(v.departmentId),
  isCompany: !!v.isCompany,
});

// trimOrNull: описывает схему валидации и преобразования данных.
const trimOrNull = (x) => {
  if (x == null) return null;
  const s = String(x).trim();
  return s ? s : null;
};
