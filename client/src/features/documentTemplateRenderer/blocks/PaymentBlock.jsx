import { resolveBindingValue } from "../utils/resolveBindingValue";
import { isFieldEnabled, getFieldLabel, sortFieldsByConfig } from "../utils/fieldConfig";
import s from "../DocumentTemplateRenderer.module.css";

function asText(value, fallback = "—") {
  if (value === null || value === undefined || String(value).trim() === "") return fallback;
  return String(value);
}

function formatDate(value) {
  const text = asText(value);
  if (text === "—") return text;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-");
    return `${day}.${month}.${year}`;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleDateString("pl-PL");
}

function asPositiveInt(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num);
}

const FIELD_DEFS = [
  { key: "method",      defaultLabel: "Forma płatności" },
  { key: "dueDate",     defaultLabel: "Termin płatności" },
  { key: "daysNet",     defaultLabel: "Warunki" },
  { key: "bankAccount", defaultLabel: "Rachunek" },
  { key: "bankName",    defaultLabel: "Bank" },
];

export default function PaymentBlock({ block, dataContext }) {
  const props = block?.props || {};

  const methodLabel = resolveBindingValue({ dataContext, binding: block?.bindings?.methodLabel, defaultPath: "payment.methodLabel" });
  const method      = resolveBindingValue({ dataContext, binding: block?.bindings?.method,      defaultPath: "payment.method" });
  const dueDate     = resolveBindingValue({ dataContext, binding: block?.bindings?.dueDate,     defaultPath: "payment.dueDate" });
  const bankAccount = resolveBindingValue({
    dataContext,
    binding: block?.bindings?.bankAccount,
    defaultPath: "payment.bankAccount",
    fallback: resolveBindingValue({ dataContext, binding: block?.bindings?.companyBankAccount, defaultPath: "company.bankAccount" }),
  });
  const bankName = resolveBindingValue({
    dataContext,
    binding: block?.bindings?.bankName,
    defaultPath: "payment.bankName",
    fallback: resolveBindingValue({ dataContext, binding: block?.bindings?.companyBankName, defaultPath: "company.bankName" }),
  });
  const daysNetRaw = resolveBindingValue({ dataContext, binding: block?.bindings?.daysNet, defaultPath: "payment.daysNet" });
  const daysNet = asPositiveInt(daysNetRaw);

  const legacy = {
    method:      props.showMethod      !== false,
    dueDate:     props.showDueDate     !== false,
    daysNet:     props.showDaysNet     !== false,
    bankAccount: props.showBankAccount !== false,
    bankName:    props.showBankName    !== false,
  };

  const displayValues = {
    method:      asText(methodLabel || method),
    dueDate:     formatDate(dueDate),
    daysNet:     daysNet ? `${daysNet} dni` : "—",
    bankAccount: asText(bankAccount),
    bankName:    asText(bankName),
  };

  const sortedFields = sortFieldsByConfig(FIELD_DEFS, props);

  return (
    <div className={s.paymentBlock}>
      {sortedFields.map((field) => {
        if (!isFieldEnabled(props, field.key, legacy[field.key])) return null;
        return (
          <div key={field.key} className={s.metaRow}>
            <span className={s.label}>{getFieldLabel(props, field.key, field.defaultLabel)}</span>
            <span className={s.value}>{displayValues[field.key]}</span>
          </div>
        );
      })}
    </div>
  );
}
