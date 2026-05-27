import s from "./LeftPanel.module.css";
import { BLOCK_LIBRARY_PLACEHOLDER_GROUPS } from "./blockLibraryPlaceholder";
import { useEditorStore } from "../../store/editorStore";

export default function BlockLibraryTab() {
  const selectedSectionKey = useEditorStore((state) => state.ui.selectedSectionKey);
  const addBlockToSection = useEditorStore((state) => state.addBlockToSection);

  const onBlockClick = (blockType) => {
    if (!selectedSectionKey) {
      if (typeof window !== "undefined" && typeof window.alert === "function") {
        window.alert("Select a section first.");
      } else {
        console.warn("Select a section first.");
      }
      return;
    }
    addBlockToSection(selectedSectionKey, blockType);
  };

  return (
    <div className={s.blockGroups}>
      {BLOCK_LIBRARY_PLACEHOLDER_GROUPS.map((group) => (
        <section key={group.group} className={s.blockGroup}>
          <h4 className={s.groupTitle}>{group.group}</h4>
          <ul className={s.list}>
            {group.blocks.map((block) => (
              <li key={block.type}>
                <button
                  type="button"
                  className={s.listItem}
                  onClick={() => onBlockClick(block.type)}
                >
                  <span className={s.primaryText}>{block.displayName}</span>
                  <span className={s.secondaryText}>{block.type}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
