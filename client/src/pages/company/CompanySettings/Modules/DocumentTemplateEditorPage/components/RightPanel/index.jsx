import { useEditorSelection } from "../../hooks/useEditorSelection";
import DocumentSettingsPanel from "./DocumentSettingsPanel";
import SectionInspector from "./SectionInspector";
import BlockInspector from "./BlockInspector";
import FieldInspector from "./FieldInspector";
import LegalStatusPanel from "./LegalStatusPanel";
import s from "./RightPanel.module.css";

function ContextPanel() {
  const { selectedSectionKey, selectedBlockKey, selectedFieldKey } = useEditorSelection();

  if (selectedFieldKey) {
    return <FieldInspector fieldKey={selectedFieldKey} />;
  }

  if (selectedBlockKey) {
    return <BlockInspector blockKey={selectedBlockKey} />;
  }

  if (selectedSectionKey) {
    return <SectionInspector sectionKey={selectedSectionKey} />;
  }

  return <DocumentSettingsPanel />;
}

export default function RightPanel() {
  return (
    <aside className={s.wrap}>
      <div className={s.main}>
        <ContextPanel />
      </div>
      <div className={s.legal}>
        <LegalStatusPanel />
      </div>
    </aside>
  );
}
