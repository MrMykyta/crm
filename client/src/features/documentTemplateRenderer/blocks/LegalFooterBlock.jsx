import { resolveBindingValue } from "../utils/resolveBindingValue";
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

export default function LegalFooterBlock({ block, dataContext }) {
  const showKsefReference = block?.props?.showKsefReference !== false;
  const ksefNumber = resolveBindingValue({
    dataContext,
    binding: block?.bindings?.ksefNumber,
    defaultPath: "document.ksefNumber",
  });
  const ksefDate = resolveBindingValue({
    dataContext,
    binding: block?.bindings?.ksefDate,
    defaultPath: "document.ksefDate",
  });

  return (
    <div className={s.legalBlock}>
      <div className={s.value}>Dokument wygenerowany na podstawie aktywnego szablonu.</div>
      {showKsefReference && (
        <div className={s.denseList}>
          <div className={s.metaRow}>
            <span className={s.label}>KSeF</span>
            <span className={s.value}>{asText(ksefNumber)}</span>
          </div>
          <div className={s.metaRow}>
            <span className={s.label}>Data KSeF</span>
            <span className={s.value}>{asText(ksefDate)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
