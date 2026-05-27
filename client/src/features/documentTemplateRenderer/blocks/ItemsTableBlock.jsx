import { resolveBindingValue } from "../utils/resolveBindingValue";
import { isFieldEnabled, getFieldLabel, sortFieldsByConfig } from "../utils/fieldConfig";
import s from "../DocumentTemplateRenderer.module.css";

const COLUMN_PRESETS = {
  lp:           { key: "lp",           label: "Lp.",        align: "right" },
  name:         { key: "name",         label: "Nazwa",      align: "left" },
  quantity:     { key: "quantity",     label: "Ilość",      align: "right" },
  unit:         { key: "unit",         label: "JM",         align: "left" },
  unitNetPrice: { key: "unitNetPrice", label: "Cena netto", align: "right", kind: "money" },
  vatRate:      { key: "vatRate",      label: "VAT",        align: "right", kind: "vat" },
  netAmount:    { key: "netAmount",    label: "Netto",      align: "right", kind: "money" },
  vatAmount:    { key: "vatAmount",    label: "VAT",        align: "right", kind: "money" },
  grossAmount:  { key: "grossAmount",  label: "Brutto",     align: "right", kind: "money" },
};

const DEFAULT_COLUMNS = [
  "lp", "name", "quantity", "unit",
  "unitNetPrice", "vatRate", "netAmount", "vatAmount", "grossAmount",
];

function asRows(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((row) => row && typeof row === "object");
}

/**
 * Build the visible, ordered column list from props.columns (or defaults),
 * then apply fieldsConfig: filter disabled, apply custom labels, sort by order.
 */
function resolveColumns(props) {
  const rawSource = Array.isArray(props?.columns) && props.columns.length > 0
    ? props.columns
    : DEFAULT_COLUMNS;

  // 1. Map to column descriptors
  const cols = rawSource
    .map((entry) => {
      if (typeof entry === "string") return COLUMN_PRESETS[entry] || null;
      if (!entry || typeof entry !== "object") return null;
      const key = String(entry.key || "").trim();
      if (!key) return null;
      const base = COLUMN_PRESETS[key] || { key, label: key, align: "left" };
      return {
        ...base,
        label: typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : base.label,
        align: entry.align === "right" || entry.align === "center" ? entry.align : base.align,
        kind:  typeof entry.kind === "string" ? entry.kind : base.kind,
      };
    })
    .filter(Boolean);

  // 2. Filter disabled via fieldsConfig (legacy default: enabled)
  const visible = cols.filter((col) => isFieldEnabled(props, col.key, true));

  // 3. Apply custom labels from fieldsConfig
  const labelled = visible.map((col) => ({
    ...col,
    label: getFieldLabel(props, col.key, col.label),
  }));

  // 4. Sort by fieldsConfig[key].order
  return sortFieldsByConfig(labelled, props);
}

function formatNumber(value, fractionDigits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("pl-PL", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatValue(value, column) {
  if (value === null || value === undefined || value === "") return "—";

  if (column.kind === "money") return formatNumber(value, 2);

  if (column.kind === "vat") {
    const text = String(value).trim();
    if (!text) return "—";
    return text.endsWith("%") ? text : `${text}%`;
  }

  if (column.key === "quantity") {
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value);
    if (Number.isInteger(num)) return String(num);
    return num.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  }

  return String(value);
}

function resolveCellValue({ row, rowIndex, column }) {
  if (column.key === "lp") {
    if (row.lp !== null && row.lp !== undefined && row.lp !== "") return row.lp;
    return rowIndex + 1;
  }
  return row[column.key];
}

export default function ItemsTableBlock({ block, dataContext }) {
  const props = block?.props || {};
  const showHeader = props.showHeader !== false;
  const columns = resolveColumns(props);

  const resolvedItems = resolveBindingValue({
    dataContext,
    binding: block?.bindings?.items,
    defaultPath: "items",
    fallback: [],
  });
  const rows = asRows(resolvedItems);

  if (columns.length === 0) {
    return <div className={s.value}>Brak konfiguracji kolumn.</div>;
  }

  return (
    <div className={s.itemsTableBlock}>
      <table className={s.dataTable}>
        {showHeader && (
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={column.align === "right" ? s.alignRight : ""}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td className={s.emptyTableCell} colSpan={columns.length}>
                Brak pozycji.
              </td>
            </tr>
          )}
          {rows.map((row, rowIndex) => (
            <tr key={row.id || row.key || `item-${rowIndex}`}>
              {columns.map((column) => {
                const value = resolveCellValue({ row, rowIndex, column });
                return (
                  <td key={column.key} className={column.align === "right" ? s.alignRight : ""}>
                    {formatValue(value, column)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
