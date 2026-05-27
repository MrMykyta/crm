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

export default function DocumentNumberBlock({ block, dataContext }) {
  const label = block?.props?.label || "Nr";
  const showLabel = block?.props?.showLabel !== false;
  const numberValue = resolveBindingValue({
    dataContext,
    binding: block?.bindings?.number || block?.bindings?.primary,
    defaultPath: "document.number",
    fallback: "—",
  });

  return (
    <div className={s.numberBlock}>
      {showLabel && <span className={s.label}>{label}</span>}
      <span className={s.value}>{asText(numberValue)}</span>
    </div>
  );
}
