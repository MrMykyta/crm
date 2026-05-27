import { useEditorStore } from "../store/editorStore";

export function useEditorPreview() {
  const editorMode = useEditorStore((state) => state.ui.editorMode);
  const localeMode = useEditorStore((state) => state.ui.localeMode);
  const zoom = useEditorStore((state) => state.ui.zoom);
  const setEditorMode = useEditorStore((state) => state.setEditorMode);
  const setLocaleMode = useEditorStore((state) => state.setLocaleMode);
  const setZoom = useEditorStore((state) => state.setZoom);

  return {
    editorMode,
    localeMode,
    zoom,
    setEditorMode,
    setLocaleMode,
    setZoom,
  };
}
