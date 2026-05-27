import { useEditorStore } from "../store/editorStore";

export function useEditorHistory() {
  const applyCommand = useEditorStore((state) => state.applyCommand);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const canUndo = useEditorStore((state) => state.history.past.length > 0);
  const canRedo = useEditorStore((state) => state.history.future.length > 0);

  return {
    applyCommand,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
