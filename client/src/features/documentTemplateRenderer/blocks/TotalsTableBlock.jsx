import { resolveBindingValue } from "../utils/resolveBindingValue";
import s from "../DocumentTemplateRenderer.module.css";

function formatMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function asRows(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((row) => row && typeof row === "object");
}

function asText(value, fallback = "—") {
  if (value === null || value === undefined || String(value).trim() === "") {
    return fallback;
  }
  return String(value);
}

function withCurrency(amountText, currency, showCurrency) {
  if (!showCurrency || amountText === "—") return amountText;
  const trimmedCurrency = String(currency || "").trim();
  if (!trimmedCurrency) return amountText;
  return `${amountText} ${trimmedCurrency}`;
}

export default function TotalsTableBlock({ block, dataContext }) {
  const showByVatRate = block?.props?.showByVatRate === true;
  const showCurrency = block?.props?.showCurrency !== false;

  const totals = resolveBindingValue({
    dataContext,
    binding: block?.bindings?.totals,
    defaultPath: "totals",
    fallback: {},
  });

  const currency =
    resolveBindingValue({
      dataContext,
      binding: block?.bindings?.currency,
      defaultPath: "document.currency",
    }) || totals?.currency;

  const byVatRate = asRows(totals?.byVatRate);
  const net = withCurrency(formatMoney(totals?.net), currency, showCurrency);
  const vat = withCurrency(formatMoney(totals?.vat), currency, showCurrency);
  const gross = withCurrency(formatMoney(totals?.gross), currency, showCurrency);

  return (
    <div className={s.totalsBlock}>
      {showByVatRate && byVatRate.length > 0 && (
        <table className={s.compactTable}>
          <thead>
            <tr>
              <th>Stawka VAT</th>
              <th className={s.alignRight}>Netto</th>
              <th className={s.alignRight}>VAT</th>
              <th className={s.alignRight}>Brutto</th>
            </tr>
          </thead>
          <tbody>
            {byVatRate.map((row, index) => (
              <tr key={row.rate || `vat-${index}`}>
                <td>{asText(row.rate)}</td>
                <td className={s.alignRight}>{withCurrency(formatMoney(row.net), currency, showCurrency)}</td>
                <td className={s.alignRight}>{withCurrency(formatMoney(row.vat), currency, showCurrency)}</td>
                <td className={s.alignRight}>{withCurrency(formatMoney(row.gross), currency, showCurrency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className={s.totalsRows}>
        <div className={s.metaRow}>
          <span className={s.label}>Razem netto</span>
          <span className={s.value}>{net}</span>
        </div>
        <div className={s.metaRow}>
          <span className={s.label}>Razem VAT</span>
          <span className={s.value}>{vat}</span>
        </div>
        <div className={s.metaRow}>
          <span className={s.valueStrong}>Do zapłaty</span>
          <span className={s.valueStrong}>{gross}</span>
        </div>
      </div>
    </div>
  );
}
