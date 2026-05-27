import { Fragment } from "react";
import { resolveBindingValue } from "../utils/resolveBindingValue";
import { isFieldEnabled, getFieldLabel, sortFieldsByConfig } from "../utils/fieldConfig";
import s from "../DocumentTemplateRenderer.module.css";

function asText(value, fallback = "—") {
  if (Array.isArray(value)) {
    const first = value.find((item) => item !== null && item !== undefined && String(item).trim() !== "");
    return first !== undefined ? String(first) : fallback;
  }
  if (value === null || value === undefined || String(value).trim() === "") return fallback;
  return String(value);
}

const FIELD_DEFS = [
  { key: "legalName",    defaultLabel: "Sprzedawca" },
  { key: "address",      defaultLabel: "Adres" },
  { key: "nip",          defaultLabel: "NIP" },
  { key: "regon",        defaultLabel: "REGON" },
  { key: "bankAccount",  defaultLabel: "Rachunek" },
];

export default function CompanyIdentityBlock({ block, dataContext }) {
  const props = block?.props || {};

  const legalName   = resolveBindingValue({ dataContext, binding: block?.bindings?.legalName || block?.bindings?.name, defaultPath: "company.legalName", fallback: "—" });
  const addressLine1 = resolveBindingValue({ dataContext, binding: block?.bindings?.addressLine1, defaultPath: "company.addressLine1" });
  const city        = resolveBindingValue({ dataContext, binding: block?.bindings?.city,       defaultPath: "company.city" });
  const postalCode  = resolveBindingValue({ dataContext, binding: block?.bindings?.postalCode, defaultPath: "company.postalCode" });
  const country     = resolveBindingValue({ dataContext, binding: block?.bindings?.country,    defaultPath: "company.country" });
  const nip         = resolveBindingValue({ dataContext, binding: block?.bindings?.nip,        defaultPath: "company.nip" });
  const regon       = resolveBindingValue({ dataContext, binding: block?.bindings?.regon,      defaultPath: "company.regon" });
  const bankAccount = resolveBindingValue({ dataContext, binding: block?.bindings?.bankAccount, defaultPath: "company.bankAccount" });

  const legacy = {
    legalName:   true,
    address:     props.showAddress    !== false,
    nip:         props.showNip        !== false,
    regon:       props.showRegon      !== false,
    bankAccount: props.showBankAccount === true,
  };

  const sortedFields = sortFieldsByConfig(FIELD_DEFS, props);

  return (
    <div className={s.identityBlock}>
      {sortedFields.map((field) => {
        if (!isFieldEnabled(props, field.key, legacy[field.key])) return null;

        if (field.key === "legalName") {
          return <div key="legalName" className={s.valueStrong}>{asText(legalName)}</div>;
        }

        if (field.key === "address") {
          const cityLine = `${asText(postalCode, "").trim()} ${asText(city, "").trim()} ${asText(country, "").trim()}`.trim() || "—";
          return (
            <Fragment key="address">
              <div className={s.value}>{asText(addressLine1)}</div>
              <div className={s.value}>{cityLine}</div>
            </Fragment>
          );
        }

        const labelText = getFieldLabel(props, field.key, field.defaultLabel);
        const valueMap = { nip: asText(nip), regon: asText(regon), bankAccount: asText(bankAccount) };
        return (
          <div key={field.key} className={s.metaRow}>
            <span className={s.label}>{labelText}</span>
            <span className={s.value}>{valueMap[field.key]}</span>
          </div>
        );
      })}
    </div>
  );
}
