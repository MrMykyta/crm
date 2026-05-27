import { useEffect, useMemo, useState } from "react";
import DocumentForm from "./DocumentForm";
import useDocumentFormState from "./useDocumentFormState";
import { buildDocumentPayload, mapDocumentToFormState } from "./documentFormMapping";
import { useListCounterpartiesQuery } from "../../store/rtk/counterpartyApi";
import {
  useCreateDocumentMutation,
  useGetDocumentByIdQuery,
  useUpdateDocumentMutation,
} from "../../store/rtk/documentsApi";

export const DOCUMENT_EDITOR_MODES = {
  CREATE: "create",
  EDIT: "edit",
};

function isNotFoundError(error) {
  const status = Number(error?.status || error?.originalStatus || error?.data?.status || 0);
  return status === 404;
}

function toErrorText(error) {
  return (
    error?.data?.message ||
    error?.data?.error ||
    error?.error ||
    error?.message ||
    "Не удалось сохранить документ"
  );
}

export default function DocumentEditorContainer({
  mode = DOCUMENT_EDITOR_MODES.CREATE,
  documentId = "",
  initialFormState,
  initialFormStateKey = "",
  onCreateSuccess,
  onEditSuccess,
  children,
}) {
  const normalizedInitialFormState =
    initialFormState && typeof initialFormState === "object" && !Array.isArray(initialFormState)
      ? initialFormState
      : undefined;
  const formState = useDocumentFormState(normalizedInitialFormState);
  const { hydrate } = formState;
  const isEditMode = mode === DOCUMENT_EDITOR_MODES.EDIT;
  const normalizedDocumentId = String(documentId || "").trim();
  const normalizedInitialFormStateKey = String(initialFormStateKey || "").trim();

  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [hydratedDocumentId, setHydratedDocumentId] = useState("");
  const [hydratedInitialKey, setHydratedInitialKey] = useState("");

  const { data: counterpartiesData, isFetching: isClientsLoading } = useListCounterpartiesQuery({
    page: 1,
    limit: 200,
  });
  const [createDocument, { isLoading: isCreating }] = useCreateDocumentMutation();
  const [updateDocument, { isLoading: isUpdating }] = useUpdateDocumentMutation();

  const shouldLoadDocument = isEditMode && Boolean(normalizedDocumentId);
  const {
    data: document,
    isLoading: isDocumentLoading,
    isFetching: isDocumentFetching,
    error: documentError,
    refetch: refetchDocument,
  } = useGetDocumentByIdQuery(normalizedDocumentId, {
    skip: !shouldLoadDocument,
    refetchOnMountOrArgChange: true,
  });

  useEffect(() => {
    setSaveError("");
    setSaveSuccess("");
  }, [isEditMode, normalizedDocumentId]);

  useEffect(() => {
    if (!isEditMode) return;
    setHydratedDocumentId("");
  }, [isEditMode, normalizedDocumentId]);

  useEffect(() => {
    if (isEditMode) return;
    if (!normalizedInitialFormStateKey) return;
    if (hydratedInitialKey === normalizedInitialFormStateKey) return;
    hydrate(normalizedInitialFormState || {});
    setHydratedInitialKey(normalizedInitialFormStateKey);
  }, [
    hydrate,
    hydratedInitialKey,
    normalizedInitialFormState,
    isEditMode,
    normalizedInitialFormStateKey,
  ]);

  useEffect(() => {
    if (isEditMode) return;
    if (normalizedInitialFormStateKey) return;
    setHydratedInitialKey("");
  }, [isEditMode, normalizedInitialFormStateKey]);

  useEffect(() => {
    if (!isEditMode) return;
    const nextId = String(document?.id || "");
    if (!nextId || hydratedDocumentId === nextId) return;

    hydrate(mapDocumentToFormState(document));
    setHydratedDocumentId(nextId);
  }, [document, hydrate, hydratedDocumentId, isEditMode]);

  const isInitialLoading = isEditMode && shouldLoadDocument && !document && (isDocumentLoading || isDocumentFetching);
  const notFound = isEditMode && !isInitialLoading && !document && isNotFoundError(documentError);
  const loadError = isEditMode && !isInitialLoading && !document && !notFound ? documentError : null;
  const isSaving = isCreating || isUpdating;

  const editorState = useMemo(
    () => ({
      mode,
      documentId: normalizedDocumentId,
      document,
      formState,
      clients: counterpartiesData?.items || [],
      isClientsLoading,
      isInitialLoading,
      isSaving,
      saveError,
      saveSuccess,
      notFound,
      loadError,
      refetchDocument,
    }),
    [
      counterpartiesData?.items,
      document,
      formState,
      isClientsLoading,
      isInitialLoading,
      isSaving,
      loadError,
      mode,
      normalizedDocumentId,
      notFound,
      refetchDocument,
      saveError,
      saveSuccess,
    ]
  );

  const handleSave = async () => {
    if (isSaving) return null;
    setSaveError("");
    setSaveSuccess("");

    const validationError = formState.validate();
    if (validationError) {
      setSaveError(validationError);
      return null;
    }

    const payload = buildDocumentPayload(formState.values);

    try {
      if (isEditMode) {
        const updated = await updateDocument({ id: normalizedDocumentId, payload }).unwrap();
        if (updated) {
          hydrate(mapDocumentToFormState(updated));
          setHydratedDocumentId(String(updated?.id || normalizedDocumentId));
        }
        setSaveSuccess("Изменения сохранены");
        onEditSuccess?.(updated);
        return updated;
      }

      const created = await createDocument(payload).unwrap();
      onCreateSuccess?.(created);
      return created;
    } catch (error) {
      setSaveError(toErrorText(error));
      return null;
    }
  };

  if (typeof children === "function") {
    return children({
      ...editorState,
      onSave: handleSave,
    });
  }

  return (
    <DocumentForm
      formState={formState}
      clients={counterpartiesData?.items || []}
      isClientsLoading={isClientsLoading}
      disabled={isSaving}
      error={saveError}
    />
  );
}
