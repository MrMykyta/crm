import { resolveBindingValue } from "../utils/resolveBindingValue";
import s from "../DocumentTemplateRenderer.module.css";

function asSingleValue(value) {
  if (Array.isArray(value)) {
    return value.find((item) => item !== null && item !== undefined && String(item).trim() !== "");
  }
  return value;
}

export default function DocumentTitleBlock({ block, dataContext }) {
  const fallback = block?.props?.fallbackLabel || "DOCUMENT";
  const resolved = resolveBindingValue({
    dataContext,
    binding: block?.bindings?.primary,
    defaultPath: "document.typeLabel",
    fallback,
  });

  const rawText = asSingleValue(resolved);
  const text = String(rawText ?? fallback);
  const uppercase = block?.props?.uppercase !== false;
  const align = ["left", "center", "right"].includes(block?.props?.align)
    ? block.props.align
    : "left";

  return (
    <div className={s.titleBlock} style={{ textAlign: align }}>
      {uppercase ? text.toUpperCase() : text}
    </div>
  );
}
