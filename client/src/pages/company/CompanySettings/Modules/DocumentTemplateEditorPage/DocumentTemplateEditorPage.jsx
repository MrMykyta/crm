import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useTopbar } from "../../../../../Providers/TopbarProvider";
import {
  useGetDocumentTemplateByIdQuery,
  useGetTemplateDraftByTemplateIdQuery,
  usePublishTemplateByTemplateIdMutation,
  useSaveTemplateDraftByTemplateIdMutation,
} from "../../../../../store/rtk/documentTemplateApi";
import TopBar from "./components/TopBar";
import LeftPanel from "./components/LeftPanel";
import RightPanel from "./components/RightPanel";
import Canvas from "./components/Canvas";
import { useEditorStore, editorStoreHelpers } from "./store/editorStore";
import s from "./DocumentTemplateEditorPage.module.css";

function getDraftContent(payload) {
  if (!payload || typeof payload !== "object") return null;
  const entity = payload.item || payload.draft || payload;
  if (entity?.content && typeof entity.content === "object") {
    return entity.content;
  }
  if (entity && typeof entity === "object" && !Array.isArray(entity)) {
    return entity;
  }
  return null;
}

function getTemplateMeta(payload) {
  if (!payload || typeof payload !== "object") return null;
  return payload.item || payload.template || payload;
}

const SAVE_STATUS_LABELS = {
  idle: "Ready",
  unsaved: "Unsaved changes",
  saving: "Saving draft…",
  publishing: "Publishing…",
  published: "Published",
  publishError: "Publish failed",
  saved: "All changes saved",
  error: "Save failed",
};

function normalizeValidationIssue(rawIssue, index) {
  if (!rawIssue || typeof rawIssue !== "object") {
    return {
      severity: "BLOCKING",
      code: `PUBLISH_VALIDATION_${index + 1}`,
      message: "Unknown validation issue.",
    };
  }

  return {
    severity: String(rawIssue.severity || "BLOCKING"),
    code: String(rawIssue.code || `PUBLISH_VALIDATION_${index + 1}`),
    message: String(rawIssue.message || "Validation issue."),
    ...(rawIssue.target && typeof rawIssue.target === "object"
      ? { target: rawIssue.target }
      : {}),
  };
}

function extractValidationIssues(error) {
  const payload = error?.data || error?.payload || error;
  const issues = payload?.details?.issues;

  if (!Array.isArray(issues)) {
    return [];
  }

  return issues.map((issue, index) => normalizeValidationIssue(issue, index));
}

export default function DocumentTemplateEditorPage() {
  const { templateId } = useParams();
  const { setTitle, reset } = useTopbar();
  const hydratedTemplateRef = useRef(null);
  const [saveStatus, setSaveStatus] = useState("idle");

  const draft = useEditorStore((state) => state.draft);
  const savedHash = useEditorStore((state) => state.history.savedHash);
  const leftPanelCollapsed = useEditorStore((state) => state.ui.leftPanelCollapsed);
  const rightPanelCollapsed = useEditorStore((state) => state.ui.rightPanelCollapsed);
  const setDraft = useEditorStore((state) => state.setDraft);
  const setTemplateMeta = useEditorStore((state) => state.setTemplateMeta);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const setValidationIssues = useEditorStore((state) => state.setValidationIssues);

  const {
    data: templatePayload,
    isLoading: isTemplateLoading,
    isFetching: isTemplateFetching,
    error: templateError,
  } = useGetDocumentTemplateByIdQuery(templateId, { skip: !templateId });

  const {
    data: draftPayload,
    isLoading: isDraftLoading,
    isFetching: isDraftFetching,
    error: draftError,
  } = useGetTemplateDraftByTemplateIdQuery(templateId, { skip: !templateId });

  const [saveTemplateDraft] = useSaveTemplateDraftByTemplateIdMutation();
  const [publishTemplate, { isLoading: isPublishing }] = usePublishTemplateByTemplateIdMutation();

  const templateMeta = useMemo(() => getTemplateMeta(templatePayload), [templatePayload]);
  const draftContent = useMemo(() => getDraftContent(draftPayload), [draftPayload]);

  useEffect(() => {
    setTitle("Document Template Editor");
    return () => reset();
  }, [reset, setTitle]);

  useEffect(() => {
    hydratedTemplateRef.current = null;
    setSaveStatus("idle");
    clearSelection();
  }, [templateId, clearSelection]);

  useEffect(() => {
    if (!templateMeta) return;
    setTemplateMeta(templateMeta);
  }, [templateMeta, setTemplateMeta]);

  useEffect(() => {
    if (!templateId || !draftContent) return;
    if (hydratedTemplateRef.current === templateId) return;

    setDraft(draftContent);
    hydratedTemplateRef.current = templateId;
    setSaveStatus("saved");
  }, [templateId, draftContent, setDraft]);

  useEffect(() => {
    if (!templateId || !draft) return;
    if (hydratedTemplateRef.current !== templateId) return;

    const currentHash = editorStoreHelpers.buildHash(draft);
    if (currentHash === savedHash) {
      setSaveStatus("saved");
      return;
    }

    setSaveStatus("unsaved");

    const timerId = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await saveTemplateDraft({
          templateId,
          content: draft,
          schemaVersion: Number(draft?.schemaVersion) || 1,
        }).unwrap();

        useEditorStore.setState((state) => ({
          history: {
            ...state.history,
            savedHash: currentHash,
          },
        }));
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, 1500);

    return () => clearTimeout(timerId);
  }, [draft, savedHash, saveTemplateDraft, templateId]);

  const isLoading = isTemplateLoading || isDraftLoading || isTemplateFetching || isDraftFetching;
  const hasError = Boolean(templateError || draftError);
  const templateName = templateMeta?.name || draft?.templateName || "Document Template";
  const shellClassName = [
    s.shell,
    leftPanelCollapsed ? s.leftCollapsed : "",
    rightPanelCollapsed ? s.rightCollapsed : "",
    leftPanelCollapsed && rightPanelCollapsed ? s.bothCollapsed : "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleValidateClick = () => {
    window.console.info("[template-editor] validate placeholder clicked");
  };

  const handlePublishClick = async () => {
    if (!templateId || !draft) {
      return;
    }

    const currentHash = editorStoreHelpers.buildHash(draft);

    try {
      setSaveStatus("saving");

      await saveTemplateDraft({
        templateId,
        content: draft,
        schemaVersion: Number(draft?.schemaVersion) || 1,
      }).unwrap();

      useEditorStore.setState((state) => ({
        history: {
          ...state.history,
          savedHash: currentHash,
        },
      }));

      setSaveStatus("publishing");

      const publishResult = await publishTemplate({ templateId }).unwrap();

      useEditorStore.setState((state) => ({
        templateMeta: state.templateMeta
          ? {
              ...state.templateMeta,
              status: publishResult?.status || "published",
              currentVersionId:
                publishResult?.currentVersionId || state.templateMeta.currentVersionId || null,
            }
          : state.templateMeta,
      }));

      setValidationIssues([]);
      setSaveStatus("published");
    } catch (error) {
      const issues = extractValidationIssues(error);
      if (issues.length > 0) {
        setValidationIssues(issues);
      } else {
        setValidationIssues([
          {
            severity: "BLOCKING",
            code: "PUBLISH_FAILED",
            message:
              String(error?.data?.message || error?.message || "Failed to publish template."),
          },
        ]);
      }
      setSaveStatus("publishError");
    }
  };

  if (isLoading && !draft) {
    return <div className={s.loading}>Loading template editor…</div>;
  }

  if (hasError && !draft) {
    return (
      <div className={s.error}>
        Unable to load template data.
      </div>
    );
  }

  return (
    <div className={s.wrap}>
      <TopBar
        templateName={templateName}
        saveStatusLabel={SAVE_STATUS_LABELS[saveStatus] || SAVE_STATUS_LABELS.idle}
        onValidate={handleValidateClick}
        onPublish={handlePublishClick}
        publishInProgress={isPublishing}
      />

      <div className={shellClassName}>
        <div className={s.leftPanelSlot}>
          <LeftPanel />
        </div>
        <div className={s.canvasSlot}>
          <Canvas />
        </div>
        <div className={s.rightPanelSlot}>
          <RightPanel />
        </div>
      </div>
    </div>
  );
}
