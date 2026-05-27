import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useCreateDocumentTemplateMutation,
  useGetDocumentTemplatesQuery,
  useSetTemplateAsDefaultMutation,
} from "../../../../../store/rtk/documentTemplateApi";
import { deleteTemplate } from "../../../../../api/documentTemplates.api";
import { resolveTemplateDocumentTypeKey } from "../_shared/templateRouteUtils";
import s from "./DocumentTemplatesPage.module.css";

const DOCUMENT_TYPE_OPTIONS = ["faktura_vat", "oferta", "zamowienie", "wz"];

function getTemplateId(template) {
  if (!template || typeof template !== "object") return null;
  return template.id || template.templateId || template._id || null;
}

function getUpdatedAt(template) {
  if (!template || typeof template !== "object") return null;
  return template.updatedAt || template.updated_at || template.modifiedAt || template.modified_at || null;
}

function formatDateTime(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString();
}

function getCurrentVersionId(template) {
  if (!template || typeof template !== "object") return "—";
  return (
    template.currentVersionId ||
    template.currentVersion?.id ||
    template.versionId ||
    template.activeVersionId ||
    "—"
  );
}

function getDocumentTypeKey(template) {
  if (!template || typeof template !== "object") return "—";
  return template.documentTypeKey || template.documentType || template.typeKey || "—";
}

export default function DocumentTemplatesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search || ""), [location.search]);
  const queryKind = String(searchParams.get("kind") || "").trim().toLowerCase();
  const queryType = String(searchParams.get("type") || "").trim().toLowerCase();
  const isNewRoute = location.pathname.endsWith("/document-templates/new");
  const resolvedByKind = resolveTemplateDocumentTypeKey({ kind: queryKind, type: queryType });
  const queryDocumentTypeKey = useMemo(() => {
    if (resolvedByKind && DOCUMENT_TYPE_OPTIONS.includes(resolvedByKind)) {
      return resolvedByKind;
    }
    if (queryType && DOCUMENT_TYPE_OPTIONS.includes(queryType)) {
      return queryType;
    }
    return null;
  }, [queryType, resolvedByKind]);

  const [isCreateOpen, setIsCreateOpen] = useState(Boolean(isNewRoute));
  const [documentTypeKey, setDocumentTypeKey] = useState(queryDocumentTypeKey || DOCUMENT_TYPE_OPTIONS[0]);
  const [name, setName] = useState("");
  const [createError, setCreateError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletingTemplateId, setDeletingTemplateId] = useState(null);
  const [setDefaultError, setSetDefaultError] = useState("");
  const [settingDefaultId, setSettingDefaultId] = useState(null);

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetDocumentTemplatesQuery();
  const [createDocumentTemplate, { isLoading: isCreating }] = useCreateDocumentTemplateMutation();
  const [setTemplateAsDefault] = useSetTemplateAsDefaultMutation();

  const templates = useMemo(() => {
    if (Array.isArray(data?.items)) return data.items;
    return [];
  }, [data?.items]);

  useEffect(() => {
    if (!isNewRoute) return;
    setIsCreateOpen(true);
    if (queryDocumentTypeKey) {
      setDocumentTypeKey(queryDocumentTypeKey);
    }
  }, [isNewRoute, queryDocumentTypeKey]);

  const onOpenCreate = () => {
    setCreateError("");
    setIsCreateOpen((prev) => !prev);
  };

  const onEdit = (template) => {
    const templateId = getTemplateId(template);
    if (!templateId) return;
    navigate(`/main/company-settings/document-templates/${templateId}/editor`);
  };

  const onSetDefault = async (template) => {
    const templateId = getTemplateId(template);
    if (!templateId) return;
    setSetDefaultError("");
    setSettingDefaultId(templateId);
    try {
      await setTemplateAsDefault({ templateId }).unwrap();
    } catch (requestError) {
      setSetDefaultError(
        requestError?.data?.message ||
          requestError?.data?.error ||
          "Failed to set template as default."
      );
    } finally {
      setSettingDefaultId(null);
    }
  };

  const onDelete = async (template) => {
    const templateId = getTemplateId(template);
    if (!templateId) return;

    if (!window.confirm("Delete this template?")) {
      return;
    }

    setDeleteError("");
    setDeletingTemplateId(templateId);
    try {
      await deleteTemplate(templateId);
      navigate("/main/company-settings/document-templates");
    } catch (requestError) {
      setDeleteError(
        requestError?.payload?.message ||
          requestError?.payload?.error ||
          requestError?.message ||
          "Failed to delete template."
      );
    } finally {
      setDeletingTemplateId(null);
    }
  };

  const onCreate = async (event) => {
    event.preventDefault();
    setCreateError("");

    const normalizedName = String(name || "").trim();
    if (!normalizedName) {
      setCreateError("Template name is required.");
      return;
    }

    try {
      const created = await createDocumentTemplate({
        documentTypeKey,
        name: normalizedName,
      }).unwrap();

      const createdId = getTemplateId(created);
      if (!createdId) {
        setCreateError("Template created but response did not return template id.");
        refetch();
        return;
      }

      navigate(`/main/company-settings/document-templates/${createdId}/editor`);
    } catch (requestError) {
      setCreateError(
        requestError?.data?.message ||
          requestError?.data?.error ||
          "Failed to create document template."
      );
    }
  };

  if (isLoading && !templates.length) {
    return <div className={s.skeleton}>Loading document templates…</div>;
  }

  if (isError && !templates.length) {
    return (
      <div className={s.stateCard}>
        <p className={s.stateTitle}>Unable to load document templates</p>
        <p className={s.stateText}>
          {error?.data?.message || error?.data?.error || "Unexpected API error"}
        </p>
        <button type="button" className={s.ghostButton} onClick={refetch}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={s.wrap}>
      <header className={s.header}>
        <div>
          <h2 className={s.title}>Document Templates</h2>
          <p className={s.subtitle}>
            Manage templates and open the template editor for selected document types.
          </p>
        </div>
        <div className={s.headerActions}>
          <button type="button" className={s.primaryButton} onClick={onOpenCreate}>
            {isCreateOpen ? "Close Create" : "Create Template"}
          </button>
        </div>
      </header>

      {isCreateOpen ? (
        <section className={s.createCard}>
          <form className={s.createForm} onSubmit={onCreate}>
            <label className={s.field}>
              <span>Document Type</span>
              <select
                className={s.select}
                value={documentTypeKey}
                onChange={(event) => setDocumentTypeKey(event.target.value)}
                disabled={isCreating}
              >
                {DOCUMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className={s.field}>
              <span>Template Name</span>
              <input
                className={s.input}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Faktura VAT default"
                disabled={isCreating}
              />
            </label>

            <button type="submit" className={s.primaryButton} disabled={isCreating}>
              {isCreating ? "Creating…" : "Create Template"}
            </button>
          </form>
          {createError ? <p className={s.errorText}>{createError}</p> : null}
        </section>
      ) : null}
      {deleteError ? <p className={s.errorText}>{deleteError}</p> : null}
      {setDefaultError ? <p className={s.errorText}>{setDefaultError}</p> : null}

      {!templates.length ? (
        <section className={s.emptyCard}>
          <p className={s.stateTitle}>No templates yet</p>
          <p className={s.stateText}>Create your first document template to open it in the editor.</p>
        </section>
      ) : (
        <section className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Document Type</th>
                <th>Status</th>
                <th>Current Version</th>
                <th>Updated At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => {
                const templateId = getTemplateId(template);
                const isDefault = template?.scope === "company_default";
                const isArchived = template?.status === "archived";
                const isSettingThis = settingDefaultId === templateId;
                return (
                  <tr key={templateId || `${template?.name || "template"}-${template?.updatedAt || "na"}`}>
                    <td>
                      {template?.name || template?.templateName || "—"}
                      {isDefault ? (
                        <span style={{ marginLeft: 6, fontSize: 11, padding: "1px 6px", borderRadius: 10, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", fontWeight: 500 }}>
                          Default
                        </span>
                      ) : null}
                    </td>
                    <td>{getDocumentTypeKey(template)}</td>
                    <td>{template?.status || "—"}</td>
                    <td>{getCurrentVersionId(template)}</td>
                    <td>{formatDateTime(getUpdatedAt(template))}</td>
                    <td>
                      <button
                        type="button"
                        className={s.ghostButton}
                        onClick={() => onEdit(template)}
                        disabled={!templateId}
                      >
                        Edit
                      </button>
                      {!isArchived && !isDefault ? (
                        <button
                          type="button"
                          className={s.ghostButton}
                          onClick={() => onSetDefault(template)}
                          disabled={!templateId || isSettingThis}
                        >
                          {isSettingThis ? "Setting…" : "Set as default"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={s.ghostButton}
                        onClick={() => onDelete(template)}
                        disabled={!templateId || deletingTemplateId === templateId}
                      >
                        {deletingTemplateId === templateId ? "Deleting…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {isFetching ? <p className={s.syncText}>Syncing latest templates…</p> : null}
    </div>
  );
}
