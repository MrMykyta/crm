import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useCreateDocumentTemplateMutation,
  useDuplicateDocumentTemplateMutation,
  useGetDocumentTemplatesQuery,
  useSetTemplateAsDefaultMutation,
} from "../../../../../store/rtk/documentTemplateApi";
import { resolveTemplateDocumentTypeKey } from "../_shared/templateRouteUtils";
import { SelectField, TextField } from "../../../../../components/ui/fields";
import useAclPermissions from "../../../../../hooks/useAclPermissions";
import s from "./DocumentTemplatesPage.module.css";

const SUPPORTED_DOCUMENT_TYPES = ["oferta", "faktura_vat", "zamowienie", "wz"];

const BUSINESS_SECTIONS = {
  offers: ["oferta"],
  orders: ["zamowienie"],
  invoices: [
    "faktura_vat",
    "proforma",
    "faktura_zaliczkowa",
    "faktura_koncowa",
    "korekta",
  ],
  warehouse: ["wz", "pz", "mm", "rw", "pw", "cc"],
  other: ["nota_ksiegowa", "paragon"],
};

const SECTION_KEYS = Object.keys(BUSINESS_SECTIONS);

const DOCUMENT_TYPE_META = {
  oferta: { section: "offers", supported: true, legal: false },
  zamowienie: { section: "orders", supported: true, legal: false },
  faktura_vat: { section: "invoices", supported: true, legal: true },
  proforma: { section: "invoices", supported: false, planned: true, legal: false },
  faktura_zaliczkowa: { section: "invoices", supported: false, planned: true, legal: true },
  faktura_koncowa: { section: "invoices", supported: false, planned: true, legal: true },
  korekta: { section: "invoices", supported: false, planned: true, legal: true },
  wz: { section: "warehouse", supported: true, legal: true },
  pz: { section: "warehouse", supported: false, planned: true, legal: true },
  mm: { section: "warehouse", supported: false, planned: true, legal: true },
  rw: { section: "warehouse", supported: false, planned: true, legal: true },
  pw: { section: "warehouse", supported: false, planned: true, legal: true },
  cc: { section: "warehouse", supported: false, planned: true, legal: true },
  nota_ksiegowa: { section: "other", supported: false, planned: true, legal: true },
  paragon: { section: "other", supported: false, planned: true, legal: true },
};

function getTemplateId(template) {
  if (!template || typeof template !== "object") return null;
  return template.id || template.templateId || template._id || null;
}

function getUpdatedAt(template) {
  if (!template || typeof template !== "object") return null;
  return template.updatedAt || template.updated_at || template.modifiedAt || template.modified_at || null;
}

function formatDateTime(value, locale) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString(locale || undefined, { dateStyle: "medium", timeStyle: "short" });
}

function getCurrentVersionId(template) {
  if (!template || typeof template !== "object") return "";
  return template.currentVersionId || template.currentVersion?.id || template.versionId || template.activeVersionId || "";
}

function normalizeDocumentTypeKey(value) {
  const key = String(value || "").trim().toLowerCase();
  if (key === "credit_note") return "korekta";
  return key;
}

function getDocumentTypeKey(template) {
  if (!template || typeof template !== "object") return "";
  return normalizeDocumentTypeKey(template.documentTypeKey || template.documentType || template.typeKey);
}

function readableKey(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function documentTypeLabel(t, key) {
  const normalized = normalizeDocumentTypeKey(key);
  return t(`companySettings.documents.builder.types.${normalized}`, readableKey(normalized));
}

function sectionLabel(t, section) {
  return t(`companySettings.documents.builder.sections.${section}`, readableKey(section));
}

function sectionDescription(t, section) {
  return t(`companySettings.documents.builder.sectionDescriptions.${section}`, "");
}

function getStatus(template) {
  return String(template?.status || "").trim().toLowerCase();
}

function isCompanyDefault(template) {
  const scope = String(template?.scope || "").trim().toLowerCase();
  return template?.isDefault === true || scope === "company_default";
}

function templateBadges(template, t) {
  const badges = [];
  const status = getStatus(template);
  if (isCompanyDefault(template)) badges.push({ key: "companyDefault", tone: "info" });
  if (status === "published") badges.push({ key: "published", tone: "success" });
  if (status === "draft") badges.push({ key: "draft", tone: "warning" });
  if (status === "archived") badges.push({ key: "archived", tone: "muted" });
  if (getCurrentVersionId(template)) badges.push({ key: "active", tone: "success" });
  if (!badges.length) badges.push({ key: "draft", tone: "warning" });
  return badges.map((badge) => ({
    ...badge,
    label: t(`companySettings.documents.builder.badges.${badge.key}`),
  }));
}

function typeBadges(typeKey, t) {
  const meta = DOCUMENT_TYPE_META[normalizeDocumentTypeKey(typeKey)] || {};
  const badges = [];
  if (meta.legal) badges.push({ key: "legal", tone: "info" });
  if (meta.planned) badges.push({ key: "planned", tone: "muted" });
  if (meta.supported && !meta.planned) badges.push({ key: "systemDefault", tone: "neutral" });
  return badges.map((badge) => ({
    ...badge,
    label: t(`companySettings.documents.builder.badges.${badge.key}`),
  }));
}

function Badge({ tone = "neutral", children }) {
  return <span className={`${s.badge} ${s[`badge_${tone}`] || ""}`}>{children}</span>;
}

function buildSections(templates) {
  const byType = new Map();
  for (const template of templates) {
    const key = getDocumentTypeKey(template);
    if (!key) continue;
    const list = byType.get(key) || [];
    list.push(template);
    byType.set(key, list);
  }

  const sections = SECTION_KEYS.map((sectionKey) => ({
    key: sectionKey,
    typeKeys: [...BUSINESS_SECTIONS[sectionKey]],
  }));

  for (const key of byType.keys()) {
    if (DOCUMENT_TYPE_META[key]) continue;
    const section = sections.find((item) => item.key === "other");
    section.typeKeys.push(key);
  }

  return sections.map((section) => ({
    ...section,
    types: section.typeKeys.map((typeKey) => ({
      key: typeKey,
      meta: DOCUMENT_TYPE_META[typeKey] || { section: section.key, supported: false },
      templates: byType.get(typeKey) || [],
    })),
  }));
}

function sectionForType(typeKey) {
  const normalized = normalizeDocumentTypeKey(typeKey);
  return DOCUMENT_TYPE_META[normalized]?.section || "other";
}

function normalizeSection(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return SECTION_KEYS.includes(normalized) ? normalized : null;
}

export default function DocumentTemplatesPage() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { can } = useAclPermissions();
  const canManageTemplates = can("document:template:manage");
  const searchParams = useMemo(() => new URLSearchParams(location.search || ""), [location.search]);
  const queryKind = String(searchParams.get("kind") || "").trim().toLowerCase();
  const queryType = String(searchParams.get("type") || "").trim().toLowerCase();
  const querySection = normalizeSection(searchParams.get("section"));
  const isNewRoute = location.pathname.endsWith("/document-templates/new");
  const resolvedByKind = resolveTemplateDocumentTypeKey({ kind: queryKind, type: queryType });
  const queryDocumentTypeKey = useMemo(() => {
    if (resolvedByKind && SUPPORTED_DOCUMENT_TYPES.includes(resolvedByKind)) return resolvedByKind;
    if (queryType && SUPPORTED_DOCUMENT_TYPES.includes(queryType)) return queryType;
    return null;
  }, [queryType, resolvedByKind]);

  const initialSection = querySection || (queryDocumentTypeKey ? sectionForType(queryDocumentTypeKey) : "offers");
  const [isCreateOpen, setIsCreateOpen] = useState(Boolean(isNewRoute));
  const [documentTypeKey, setDocumentTypeKey] = useState(queryDocumentTypeKey || SUPPORTED_DOCUMENT_TYPES[0]);
  const [name, setName] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [busyId, setBusyId] = useState(null);

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetDocumentTemplatesQuery();
  const [createDocumentTemplate, { isLoading: isCreating }] = useCreateDocumentTemplateMutation();
  const [duplicateDocumentTemplate] = useDuplicateDocumentTemplateMutation();
  const [setTemplateAsDefault] = useSetTemplateAsDefaultMutation();

  const templates = useMemo(() => (Array.isArray(data?.items) ? data.items : []), [data?.items]);
  const sections = useMemo(() => buildSections(templates), [templates]);
  const activeSectionKey = normalizeSection(searchParams.get("section")) || initialSection;
  const activeSection = sections.find((section) => section.key === activeSectionKey) || sections[0];
  const activeTypeKeys = useMemo(() => activeSection?.types.map((type) => type.key) || [], [activeSection]);
  const createTypeOptions = useMemo(() => {
    return activeTypeKeys.filter((typeKey) => SUPPORTED_DOCUMENT_TYPES.includes(typeKey));
  }, [activeTypeKeys]);
  const canCreateInSection = createTypeOptions.length > 0;
  const sectionTemplateCount = useMemo(
    () => (activeSection?.types || []).reduce((sum, type) => sum + type.templates.length, 0),
    [activeSection]
  );
  const sectionPlannedCount = useMemo(
    () => (activeSection?.types || []).filter((type) => type.meta?.planned).length,
    [activeSection]
  );

  useEffect(() => {
    if (!isNewRoute) return;
    setIsCreateOpen(true);
    if (queryDocumentTypeKey) setDocumentTypeKey(queryDocumentTypeKey);
  }, [isNewRoute, queryDocumentTypeKey]);

  useEffect(() => {
    if (!createTypeOptions.length) return;
    if (createTypeOptions.includes(documentTypeKey)) return;
    setDocumentTypeKey(createTypeOptions[0] || SUPPORTED_DOCUMENT_TYPES[0]);
  }, [createTypeOptions, documentTypeKey]);

  const clearMessages = () => {
    setActionError("");
    setActionSuccess("");
  };

  const onOpenCreate = () => {
    if (!canManageTemplates) return;
    clearMessages();
    setIsCreateOpen((prev) => !prev);
  };

  const onSectionChange = (sectionKey) => {
    const nextSection = normalizeSection(sectionKey);
    if (!nextSection || nextSection === activeSectionKey) return;
    clearMessages();
    const nextParams = new URLSearchParams(location.search || "");
    nextParams.set("section", nextSection);
    nextParams.delete("kind");
    nextParams.delete("type");
    navigate(`${location.pathname}?${nextParams.toString()}`, { replace: false });
  };

  const onPreview = (template) => {
    const templateId = getTemplateId(template);
    if (!templateId) return;
    navigate(`/main/company-settings/document-templates/${templateId}/editor?mode=preview`);
  };

  const onEdit = (template) => {
    const templateId = getTemplateId(template);
    if (!templateId || !canManageTemplates) return;
    navigate(`/main/company-settings/document-templates/${templateId}/editor`);
  };

  const onSetDefault = async (template) => {
    const templateId = getTemplateId(template);
    if (!templateId || !canManageTemplates) return;
    clearMessages();
    setBusyId(`default:${templateId}`);
    try {
      await setTemplateAsDefault({ templateId }).unwrap();
      setActionSuccess(t("companySettings.documents.builder.messages.defaultUpdated"));
    } catch (requestError) {
      setActionError(
        requestError?.data?.message ||
          requestError?.data?.error ||
          t("companySettings.documents.builder.errors.setDefaultFailed")
      );
    } finally {
      setBusyId(null);
    }
  };

  const createTemplateForType = async (typeKey, customName = "") => {
    if (!canManageTemplates || !SUPPORTED_DOCUMENT_TYPES.includes(typeKey)) return null;
    const fallbackName = `${documentTypeLabel(t, typeKey)} ${t("companySettings.documents.builder.defaultTemplateName")}`;
    const created = await createDocumentTemplate({
      documentTypeKey: typeKey,
      name: String(customName || fallbackName).trim(),
    }).unwrap();
    return created;
  };

  const onCreate = async (event) => {
    event.preventDefault();
    if (!canManageTemplates) return;
    clearMessages();

    const normalizedName = String(name || "").trim();
    if (!normalizedName) {
      setActionError(t("companySettings.documents.builder.errors.nameRequired"));
      return;
    }

    try {
      const created = await createTemplateForType(documentTypeKey, normalizedName);
      const createdId = getTemplateId(created);
      if (!createdId) {
        setActionError(t("companySettings.documents.builder.errors.missingId"));
        refetch();
        return;
      }
      navigate(`/main/company-settings/document-templates/${createdId}/editor`);
    } catch (requestError) {
      setActionError(
        requestError?.data?.message ||
          requestError?.data?.error ||
          t("companySettings.documents.builder.errors.createFailed")
      );
    }
  };

  const onCreateSystemCopy = async (typeKey) => {
    if (!canManageTemplates) return;
    clearMessages();
    setBusyId(`system:${typeKey}`);
    try {
      const created = await createTemplateForType(
        typeKey,
        `${documentTypeLabel(t, typeKey)} ${t("companySettings.documents.builder.copySuffix")}`
      );
      const createdId = getTemplateId(created);
      if (createdId) navigate(`/main/company-settings/document-templates/${createdId}/editor`);
    } catch (requestError) {
      setActionError(
        requestError?.data?.message ||
          requestError?.data?.error ||
          t("companySettings.documents.builder.errors.createFailed")
      );
    } finally {
      setBusyId(null);
    }
  };

  const onDuplicate = async (template) => {
    const templateId = getTemplateId(template);
    if (!templateId || !canManageTemplates) return;
    clearMessages();
    setBusyId(`duplicate:${templateId}`);
    try {
      const baseName = template?.name || template?.templateName || documentTypeLabel(t, getDocumentTypeKey(template));
      const created = await duplicateDocumentTemplate({
        templateId,
        name: `${baseName} ${t("companySettings.documents.builder.copySuffix")}`,
      }).unwrap();
      const createdId = getTemplateId(created);
      setActionSuccess(t("companySettings.documents.builder.messages.duplicated"));
      if (createdId) navigate(`/main/company-settings/document-templates/${createdId}/editor`);
    } catch (requestError) {
      setActionError(
        requestError?.data?.message ||
          requestError?.data?.error ||
          t("companySettings.documents.builder.errors.duplicateFailed")
      );
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading && !templates.length) {
    return <div className={s.skeleton}>{t("companySettings.documents.builder.loading")}</div>;
  }

  if (isError && !templates.length) {
    return (
      <div className={s.stateCard}>
        <p className={s.stateTitle}>{t("companySettings.documents.builder.errors.loadTitle")}</p>
        <p className={s.stateText}>
          {error?.data?.message || error?.data?.error || t("companySettings.documents.common.loadErrorBody")}
        </p>
        <button type="button" className={s.ghostButton} onClick={refetch}>
          {t("companySettings.documents.common.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className={s.wrap}>
      <header className={s.header}>
        <div>
          <span className={s.eyebrow}>{t("companySettings.documents.builder.eyebrow")}</span>
          <h2 className={s.title}>{t("companySettings.documents.builder.title")}</h2>
          <p className={s.subtitle}>{t("companySettings.documents.builder.subtitle")}</p>
        </div>
        {canManageTemplates && canCreateInSection ? (
          <div className={s.headerActions}>
            <button type="button" className={s.primaryButton} onClick={onOpenCreate}>
              {isCreateOpen ? t("companySettings.documents.builder.actions.closeCreate") : t("companySettings.documents.builder.actions.create")}
            </button>
          </div>
        ) : null}
      </header>

      {canManageTemplates && canCreateInSection && isCreateOpen ? (
        <section className={s.createCard}>
          <form className={s.createForm} onSubmit={onCreate}>
            <label className={s.field}>
              <span>{t("companySettings.documents.builder.fields.documentType")}</span>
              <SelectField
                inputClassName={s.select}
                value={documentTypeKey}
                onValueChange={(value) => setDocumentTypeKey(value)}
                disabled={isCreating}
                options={createTypeOptions.map((option) => ({
                  value: option,
                  label: documentTypeLabel(t, option),
                }))}
              />
            </label>

            <label className={s.field}>
              <span>{t("companySettings.documents.builder.fields.templateName")}</span>
              <TextField
                inputClassName={s.input}
                value={name}
                onValueChange={setName}
                placeholder={t("companySettings.documents.builder.placeholders.templateName")}
                disabled={isCreating}
              />
            </label>

            <button type="submit" className={s.primaryButton} disabled={isCreating}>
              {isCreating ? t("companySettings.documents.builder.actions.creating") : t("companySettings.documents.builder.actions.create")}
            </button>
          </form>
        </section>
      ) : null}

      {actionError ? <p className={s.errorText}>{actionError}</p> : null}
      {actionSuccess ? <p className={s.successText}>{actionSuccess}</p> : null}

      <section className={s.overviewGrid}>
        <div className={s.statCard}>
          <span>{t("companySettings.documents.builder.stats.total")}</span>
          <strong>{sectionTemplateCount}</strong>
        </div>
        <div className={s.statCard}>
          <span>{t("companySettings.documents.builder.stats.supported")}</span>
          <strong>{createTypeOptions.length}</strong>
        </div>
        <div className={s.statCard}>
          <span>{t("companySettings.documents.builder.stats.planned")}</span>
          <strong>{sectionPlannedCount}</strong>
        </div>
      </section>

      <div className={s.contentShell}>
        <nav className={s.sectionNav} aria-label={t("companySettings.documents.builder.sectionNavLabel")}>
          {sections.map((section) => {
            const isActive = section.key === activeSectionKey;
            const count = section.types.reduce((sum, type) => sum + type.templates.length, 0);
            return (
              <button
                key={section.key}
                type="button"
                className={`${s.sectionButton} ${isActive ? s.sectionButtonActive : ""}`}
                onClick={() => onSectionChange(section.key)}
              >
                <span>{sectionLabel(t, section.key)}</span>
                <small>{count}</small>
              </button>
            );
          })}
        </nav>

        <section className={s.sectionPanel}>
          <header className={s.groupHeader}>
              <div>
                <h3>{sectionLabel(t, activeSection.key)}</h3>
                <p>{sectionDescription(t, activeSection.key)}</p>
              </div>
            </header>

            <div className={s.typeGrid}>
              {activeSection.types.map(({ key, meta, templates: typeTemplates }) => {
                const planned = Boolean(meta.planned);
                const supported = Boolean(meta.supported);
                const known = Boolean(DOCUMENT_TYPE_META[key]);
                return (
                  <article key={key} className={`${s.typeCard} ${planned ? s.plannedCard : ""}`}>
                    <div className={s.typeHeader}>
                      <div>
                        <h4>{documentTypeLabel(t, key)}</h4>
                        <p>
                          {planned
                            ? t("companySettings.documents.builder.plannedText")
                            : typeTemplates.length
                              ? t("companySettings.documents.builder.templatesCount", { count: typeTemplates.length })
                              : t("companySettings.documents.builder.systemDefaultText")}
                        </p>
                        {!known ? <small>{t("companySettings.documents.builder.unknownHint")}</small> : null}
                      </div>
                      <div className={s.badges}>
                        {typeBadges(key, t).map((badge) => (
                          <Badge key={badge.key} tone={badge.tone}>{badge.label}</Badge>
                        ))}
                      </div>
                    </div>

                    {typeTemplates.length ? (
                      <div className={s.templateList}>
                        {typeTemplates.map((template) => {
                          const templateId = getTemplateId(template);
                          const isArchived = getStatus(template) === "archived";
                          const isDefault = isCompanyDefault(template);
                          return (
                            <div key={templateId || `${template?.name}-${template?.updatedAt}`} className={s.templateRow}>
                              <div className={s.templateMain}>
                                <strong>{template?.name || template?.templateName || t("companySettings.documents.builder.untitled")}</strong>
                                <span>
                                  {documentTypeLabel(t, key)}
                                  {" · "}
                                  {formatDateTime(getUpdatedAt(template), i18n.language)}
                                </span>
                              </div>
                              <div className={s.badges}>
                                {templateBadges(template, t).map((badge) => (
                                  <Badge key={badge.key} tone={badge.tone}>{badge.label}</Badge>
                                ))}
                              </div>
                              <div className={s.rowActions}>
                                <button type="button" className={s.ghostButton} onClick={() => onPreview(template)} disabled={!templateId}>
                                  {t("companySettings.documents.builder.actions.preview")}
                                </button>
                                {canManageTemplates ? (
                                  <>
                                    <button type="button" className={s.ghostButton} onClick={() => onEdit(template)} disabled={!templateId}>
                                      {t("companySettings.documents.builder.actions.edit")}
                                    </button>
                                    <button
                                      type="button"
                                      className={s.ghostButton}
                                      onClick={() => onDuplicate(template)}
                                      disabled={!templateId || busyId === `duplicate:${templateId}`}
                                    >
                                      {busyId === `duplicate:${templateId}`
                                        ? t("companySettings.documents.builder.actions.duplicating")
                                        : t("companySettings.documents.builder.actions.duplicate")}
                                    </button>
                                    {!isArchived && !isDefault ? (
                                      <button
                                        type="button"
                                        className={s.ghostButton}
                                        onClick={() => onSetDefault(template)}
                                        disabled={!templateId || busyId === `default:${templateId}`}
                                      >
                                        {busyId === `default:${templateId}`
                                          ? t("companySettings.documents.builder.actions.activating")
                                          : t("companySettings.documents.builder.actions.activate")}
                                      </button>
                                    ) : null}
                                  </>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className={s.emptyType}>
                        <p>
                          {planned
                            ? t("companySettings.documents.builder.plannedEmpty")
                            : t("companySettings.documents.builder.systemDefaultEmpty")}
                        </p>
                        {supported && canManageTemplates ? (
                          <button
                            type="button"
                            className={s.ghostButton}
                            onClick={() => onCreateSystemCopy(key)}
                            disabled={busyId === `system:${key}`}
                          >
                            {busyId === `system:${key}`
                              ? t("companySettings.documents.builder.actions.creating")
                              : t("companySettings.documents.builder.actions.createEditableCopy")}
                          </button>
                        ) : null}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
        </section>
      </div>

      {isFetching ? <p className={s.syncText}>{t("companySettings.documents.builder.sync")}</p> : null}
    </div>
  );
}
