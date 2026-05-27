import { useEditorStore } from "../../store/editorStore";
import s from "./Canvas.module.css";

export default function CanvasPlaceholder() {
  const draft = useEditorStore((state) => state.draft);
  const mode = useEditorStore((state) => state.ui.editorMode);
  const locale = useEditorStore((state) => state.ui.localeMode);
  const selectedSectionKey = useEditorStore((state) => state.ui.selectedSectionKey);
  const selectedBlockKey = useEditorStore((state) => state.ui.selectedBlockKey);
  const selectedFieldKey = useEditorStore((state) => state.ui.selectedFieldKey);
  const sectionsCount = Array.isArray(draft?.sections) ? draft.sections.length : 0;

  return (
    <div className={s.placeholder}>
      <h3 className={s.title}>Canvas Placeholder</h3>
      <ul className={s.metrics}>
        <li><span>Mode</span><strong>{mode}</strong></li>
        <li><span>Locale</span><strong>{locale}</strong></li>
        <li><span>Selected Section</span><strong>{selectedSectionKey || "—"}</strong></li>
        <li><span>Selected Block</span><strong>{selectedBlockKey || "—"}</strong></li>
        <li><span>Selected Field</span><strong>{selectedFieldKey || "—"}</strong></li>
        <li><span>Sections in Draft</span><strong>{sectionsCount}</strong></li>
      </ul>
    </div>
  );
}
