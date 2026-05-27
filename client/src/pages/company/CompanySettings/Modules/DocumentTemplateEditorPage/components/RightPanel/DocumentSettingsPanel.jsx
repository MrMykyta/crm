import { useEditorStore } from "../../store/editorStore";
import s from "./RightPanel.module.css";

export default function DocumentSettingsPanel() {
  const templateMeta = useEditorStore((state) => state.templateMeta);
  const draft = useEditorStore((state) => state.draft);
  const sectionsCount = Array.isArray(draft?.sections) ? draft.sections.length : 0;

  return (
    <section className={s.panel}>
      <h3 className={s.title}>Document Settings</h3>
      <div className={s.metaList}>
        <div className={s.row}>
          <span className={s.label}>Template ID</span>
          <span className={s.value}>{templateMeta?.id || "—"}</span>
        </div>
        <div className={s.row}>
          <span className={s.label}>Document Type</span>
          <span className={s.value}>{templateMeta?.documentTypeKey || draft?.documentTypeKey || "—"}</span>
        </div>
        <div className={s.row}>
          <span className={s.label}>Sections</span>
          <span className={s.value}>{sectionsCount}</span>
        </div>
      </div>
      <div className={s.note}>Document-level inspector shell placeholder.</div>
    </section>
  );
}
