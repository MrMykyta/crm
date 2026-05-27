import { resolveBindingValue } from "../utils/resolveBindingValue";
import { isFieldEnabled, getFieldLabel, sortFieldsByConfig } from "../utils/fieldConfig";
import s from "../DocumentTemplateRenderer.module.css";

function asText(value, fallback = "—") {
  if (Array.isArray(value)) {
    const first = value.find((item) => item !== null && item !== undefined && String(item).trim() !== "");
    return first !== undefined ? String(first) : fallback;
  }
  if (value === null || value === undefined || String(value).trim() === "") {
    return fallback;
  }
  return String(value);
}

function formatDate(value) {
  const text = asText(value, "—");
  if (text === "—") return text;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-");
    return `${day}.${month}.${year}`;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleDateString("pl-PL");
}

const FIELD_DEFS = [
  { key: "issueDate", defaultLabel: "Data wystawienia" },
  { key: "saleDate",  defaultLabel: "Data sprzedaży" },
  { key: "dueDate",   defaultLabel: "Termin płatności" },
];

export default function DocumentDatesBlock({ block, dataContext }) {
  const props = block?.props || {};

  const issueDate = resolveBindingValue({ dataContext, binding: block?.bindings?.issueDate, defaultPath: "document.issueDate" });
  const saleDate  = resolveBindingValue({ dataContext, binding: block?.bindings?.saleDate,  defaultPath: "document.saleDate" });
  const dueDate   = resolveBindingValue({ dataContext, binding: block?.bindings?.dueDate,   defaultPath: "payment.dueDate" });

  const values = { issueDate: formatDate(issueDate), saleDate: formatDate(saleDate), dueDate: formatDate(dueDate) };

  // Legacy visibility flags (fallback when fieldsConfig not set)
  const legacy = {
    issueDate: props.showIssueDate !== false,
    saleDate:  props.showSaleDate  !== false,
    dueDate:   props.showDueDate   !== false,
  };

  const sortedFields = sortFieldsByConfig(FIELD_DEFS, props);

  return (
    <div className={s.datesBlock}>
      {sortedFields.map((field) => {
        if (!isFieldEnabled(props, field.key, legacy[field.key])) return null;
        return (
          <div key={field.key} className={s.metaRow}>
            <span className={s.label}>{getFieldLabel(props, field.key, field.defaultLabel)}</span>
            <span className={s.value}>{values[field.key]}</span>
          </div>
        );
      })}
    </div>
  );
}
