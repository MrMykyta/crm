import { useEditorStore } from "../store/editorStore";

export function useEditorValidation() {
  const issues = useEditorStore((state) => state.validation.issues);
  const isValid = useEditorStore((state) => state.validation.isValid);
  const lastValidated = useEditorStore((state) => state.validation.lastValidated);
  const setValidationIssues = useEditorStore((state) => state.setValidationIssues);

  return {
    issues,
    isValid,
    lastValidated,
    setValidationIssues,
  };
}
