import { resolveBindingValue } from "../utils/resolveBindingValue";
import s from "../DocumentTemplateRenderer.module.css";

function asText(value, fallback = "—") {
  if (Array.isArray(value)) {
    const joined = value
      .filter((item) => item !== null && item !== undefined && String(item).trim() !== "")
      .map((item) => String(item))
      .join("\n");
    return joined || fallback;
  }
  if (value === null || value === undefined || String(value).trim() === "") {
    return fallback;
  }
  return String(value);
}

export default function NotesBlock({ block, dataContext }) {
  const label = block?.props?.label || "Uwagi";
  const notes = resolveBindingValue({
    dataContext,
    binding: block?.bindings?.primary || block?.bindings?.notes,
    defaultPath: "document.notes",
    fallback: resolveBindingValue({
      dataContext,
      binding: block?.bindings?.secondary || block?.bindings?.privateNotes,
      defaultPath: "document.privateNotes",
      fallback: "—",
    }),
  });

  return (
    <div className={s.notesBlock}>
      <div className={s.labelMuted}>{label}</div>
      <div className={s.noteText}>{asText(notes)}</div>
    </div>
  );
}
