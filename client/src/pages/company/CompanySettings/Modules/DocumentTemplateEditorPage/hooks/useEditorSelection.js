import { useMemo } from "react";
import { useEditorStore } from "../store/editorStore";

export function useEditorSelection() {
  const draft = useEditorStore((state) => state.draft);
  const selectedSectionKey = useEditorStore((state) => state.ui.selectedSectionKey);
  const selectedBlockKey = useEditorStore((state) => state.ui.selectedBlockKey);
  const selectedFieldKey = useEditorStore((state) => state.ui.selectedFieldKey);
  const setSelectedSection = useEditorStore((state) => state.setSelectedSection);
  const setSelectedBlock = useEditorStore((state) => state.setSelectedBlock);
  const setSelectedField = useEditorStore((state) => state.setSelectedField);
  const clearSelection = useEditorStore((state) => state.clearSelection);

  const selectedSection = useMemo(() => {
    const sections = Array.isArray(draft?.sections) ? draft.sections : [];
    return sections.find((section) => section?.key === selectedSectionKey) || null;
  }, [draft, selectedSectionKey]);

  const selectedBlock = useMemo(() => {
    const blocks = Array.isArray(selectedSection?.blocks) ? selectedSection.blocks : [];
    return blocks.find((block) => block?.key === selectedBlockKey) || null;
  }, [selectedSection, selectedBlockKey]);

  const selectSection = (sectionKey) => {
    setSelectedSection(sectionKey);
  };

  const selectBlock = (sectionKey, blockKey) => {
    setSelectedBlock(sectionKey, blockKey);
  };

  const selectField = (sectionKey, blockKey, fieldKey) => {
    setSelectedField(sectionKey, blockKey, fieldKey);
  };

  return {
    selectedSectionKey,
    selectedBlockKey,
    selectedFieldKey,
    selectedSection,
    selectedBlock,
    selectSection,
    selectBlock,
    selectField,
    clearSelection,
  };
}
