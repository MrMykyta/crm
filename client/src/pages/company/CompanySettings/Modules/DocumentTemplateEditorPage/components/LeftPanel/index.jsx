import { useEditorStore } from "../../store/editorStore";
import SectionsTab from "./SectionsTab";
import BlockLibraryTab from "./BlockLibraryTab";
import DataBindingsTab from "./DataBindingsTab";
import s from "./LeftPanel.module.css";

const TABS = [
  { key: "sections", label: "Sections" },
  { key: "blocks", label: "Blocks" },
  { key: "bindings", label: "Data Bindings" },
];

export default function LeftPanel() {
  const activeLeftTab = useEditorStore((state) => state.ui.activeLeftTab);
  const setLeftTab = useEditorStore((state) => state.setLeftTab);

  return (
    <aside className={s.wrap}>
      <nav className={s.tabs} aria-label="Editor left panel tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setLeftTab(tab.key)}
            className={`${s.tabBtn} ${activeLeftTab === tab.key ? s.active : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className={s.content}>
        {activeLeftTab === "sections" && <SectionsTab />}
        {activeLeftTab === "blocks" && <BlockLibraryTab />}
        {activeLeftTab === "bindings" && <DataBindingsTab />}
      </div>
    </aside>
  );
}
