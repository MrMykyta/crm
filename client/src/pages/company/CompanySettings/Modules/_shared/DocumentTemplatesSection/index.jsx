import { CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import s from "./DocumentTemplatesSection.module.css";

const SKELETON_ITEMS = 6;

const DOCUMENT_TYPE_ALIASES = {
  offer: "offer",
  order: "order",
  invoice: "invoice",
  invoice_base: "invoice",
  invoice_correction: "correction",
  correction: "correction",
  korekta: "correction",
  invoice_proforma: "proforma",
  proforma: "proforma",
  invoice_advance: "advance",
  advance: "advance",
  zaliczka: "advance",
  invoice_advance_proforma: "advance_proforma",
  advance_proforma: "advance_proforma",
  invoice_wdt: "wdt",
  wdt: "wdt",
  pz: "pz",
  wz: "wz",
  mm: "mm",
  rw: "rw",
  pw: "pw",
  faktura_vat: "invoice",
};

function getTemplateId(template) {
  if (!template || typeof template !== "object") return null;
  return String(template.id || template.templateId || template._id || "").trim() || null;
}

function getTemplateName(template, fallbackName = "") {
  const value = String(template?.name || template?.title || "").trim();
  return value || fallbackName;
}

function formatShortDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}.${month}.${year}`;
}

function normalizeTypeKey(rawValue) {
  const normalized = String(rawValue || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return DOCUMENT_TYPE_ALIASES[normalized] || normalized;
}

function resolveDocumentTypeLabel(template, t) {
  const rawType =
    template?.documentTypeLabel ||
    template?.documentTypeName ||
    template?.documentType ||
    template?.documentTypeKey ||
    template?.typeKey ||
    "";

  const normalizedKey = normalizeTypeKey(rawType);
  if (normalizedKey) {
    const translated = t(`companySettings.documents.types.${normalizedKey}`, "");
    if (translated) return translated;
  }

  const fallback = String(rawType || "")
    .trim()
    .replace(/[_-]+/g, " ");

  if (fallback) {
    return fallback.charAt(0).toUpperCase() + fallback.slice(1);
  }

  return t("companySettings.documents.templates.documentTypeFallback", "Document");
}

function buildMeta(template, t) {
  const typeLabel = resolveDocumentTypeLabel(template, t);
  const dateLabel = formatShortDate(
    template?.updatedAt || template?.updated_at || template?.modifiedAt || template?.createdAt
  );

  if (typeLabel && dateLabel) {
    return `${typeLabel} · ${dateLabel}`;
  }

  return typeLabel;
}

function renderPreview(template) {
  const previewHtml = String(template?.previewHtml || "").trim();

  if (previewHtml) {
    return (
      <div className={s.previewViewport}>
        <div className={s.previewContent} dangerouslySetInnerHTML={{ __html: previewHtml }} />
      </div>
    );
  }

  return (
    <div className={s.previewFallback}>
      <span className={s.previewLine} />
      <span className={`${s.previewLine} ${s.previewLineShort}`} />
      <span className={s.previewLine} />
      <span className={`${s.previewLine} ${s.previewLineShort}`} />
      <span className={`${s.previewLine} ${s.previewLineTiny}`} />
    </div>
  );
}

export default function DocumentTemplatesSection({
  title = "",
  addLabel = "",
  templates = [],
  isLoading = false,
  isFetching = false,
  error = null,
  extraError = "",
  extraSuccess = "",
  onRetry,
  onAdd,
  onEdit,
  onDelete,
  onSetDefault,
  settingDefaultTemplateId = null,
  deletingTemplateId = null,
  filterOptions = null,
  filterValue = "all",
  onFilterChange,
  deleteConfirmText = "",
  setDefaultConfirmText = "",
}) {
  const { t } = useTranslation();
  const items = Array.isArray(templates) ? templates : [];
  const hasFilters = Array.isArray(filterOptions) && filterOptions.length > 0;

  const fallbackTemplateName = t("companySettings.documents.templates.untitled", "Untitled");
  const resolvedTitle = title || t("companySettings.documents.templates.title", "Templates");
  const resolvedAddLabel = addLabel || t("companySettings.documents.templates.add", "Add");
  const resolvedRetryLabel = t("companySettings.documents.common.retry", "Try again");
  const resolvedLoadError = t(
    "companySettings.documents.templates.loadError",
    "Failed to load templates."
  );
  const resolvedDeleteAria = t("companySettings.documents.templates.delete", "Delete template");
  const resolvedSetDefaultAria = t(
    "companySettings.documents.templates.setDefault",
    "Set as default"
  );
  const resolvedEditLabel = t("companySettings.documents.templates.edit", "Edit");
  const resolvedDefaultBadge = t("companySettings.documents.templates.defaultBadge", "Default");
  const resolvedSyncLabel = t("companySettings.documents.templates.sync", "Syncing...");

  const handleDelete = (event, template) => {
    event.stopPropagation();
    if (!onDelete || !template || template.isDefault) return;

    const templateName = getTemplateName(template, fallbackTemplateName);
    const confirmText =
      deleteConfirmText ||
      t("companySettings.documents.templates.confirmDelete", {
        name: templateName,
        defaultValue: `Delete template "${templateName}"?`,
      });

    const confirmed = window.confirm(confirmText);
    if (!confirmed) return;

    onDelete(template);
  };

  const handleSetDefault = (event, template) => {
    event.stopPropagation();
    if (!onSetDefault || !template || template.isDefault) return;

    const templateName = getTemplateName(template, fallbackTemplateName);
    const confirmText =
      setDefaultConfirmText ||
      t("companySettings.documents.templates.confirmSetDefault", {
        name: templateName,
        defaultValue: `Set "${templateName}" as default template?`,
      });

    const confirmed = window.confirm(confirmText);
    if (!confirmed) return;

    onSetDefault(template);
  };

  return (
    <section className={s.card}>
      <header className={s.header}>
        <h2 className={s.title}>{resolvedTitle}</h2>
        {onAdd ? (
          <button type="button" className={s.addButton} onClick={onAdd}>
            {resolvedAddLabel}
          </button>
        ) : null}
      </header>

      {hasFilters ? (
        <div className={s.filterPills}>
          {filterOptions.map((option) => {
            const value = String(option?.value || "");
            const active = value === String(filterValue || "");
            return (
              <button
                key={value}
                type="button"
                className={`${s.filterButton} ${active ? s.filterButtonActive : ""}`.trim()}
                onClick={() => onFilterChange?.(value)}
                disabled={!onFilterChange}
              >
                {option?.label || value}
              </button>
            );
          })}
        </div>
      ) : null}

      {error ? (
        <div className={s.errorCard}>
          <p className={s.errorText}>
            {error?.data?.message || error?.data?.error || resolvedLoadError}
          </p>
          <button type="button" className={s.retryButton} onClick={onRetry} disabled={!onRetry}>
            {resolvedRetryLabel}
          </button>
        </div>
      ) : null}

      {!error ? (
        <>
          {isLoading ? (
            <div className={s.grid}>
              {Array.from({ length: SKELETON_ITEMS }).map((_, index) => (
                <article
                  key={`template-skeleton-${index}`}
                  className={`${s.templateCard} ${s.skeletonCard}`}
                >
                  <div className={s.cardHeader}>
                    <div className={s.cardTitleRow}>
                      <span className={s.skeletonTitle} />
                    </div>
                    <span className={s.skeletonMeta} />
                  </div>
                  <div className={s.previewButton}>
                    <div className={s.previewShell}>
                      <div className={`${s.previewPaper} ${s.skeletonPreview}`} />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {!isLoading && !items.length ? (
            <div className={s.emptyCard}>
              <p className={s.emptyTitle}>{t("companySettings.documents.templates.emptyTitle")}</p>
              <p className={s.emptyText}>{t("companySettings.documents.templates.emptyText")}</p>
            </div>
          ) : null}

          {!isLoading && items.length ? (
            <div className={s.grid}>
              {items.map((template) => {
                const templateId = getTemplateId(template);
                const isDefault = Boolean(template?.isDefault);
                const isSettingDefault =
                  templateId && settingDefaultTemplateId && String(settingDefaultTemplateId) === templateId;
                const isDeleting =
                  templateId && deletingTemplateId && String(deletingTemplateId) === templateId;
                const isBusy = Boolean(isSettingDefault || isDeleting);
                const templateName = getTemplateName(template, fallbackTemplateName);

                return (
                  <article
                    key={templateId || `${templateName}-${buildMeta(template, t)}`}
                    className={`${s.templateCard} ${isDefault ? s.templateCardDefault : ""}`.trim()}
                  >
                    <div className={s.cardHeader}>
                      <div className={s.cardTitleRow}>
                        <p className={s.cardTitle}>{templateName}</p>

                        <div className={s.cardActions}>
                          {!isDefault && onSetDefault ? (
                            <button
                              type="button"
                              className={`${s.actionButton} ${s.setDefaultButton}`}
                              onClick={(event) => handleSetDefault(event, template)}
                              disabled={isBusy}
                              aria-label={resolvedSetDefaultAria}
                            >
                              <CheckCircle2 size={14} strokeWidth={2.1} />
                            </button>
                          ) : null}

                          {!isDefault && onDelete ? (
                            <button
                              type="button"
                              className={`${s.actionButton} ${s.deleteButton}`}
                              onClick={(event) => handleDelete(event, template)}
                              disabled={isBusy}
                              aria-label={resolvedDeleteAria}
                            >
                              <Trash2 size={14} strokeWidth={2.1} />
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <p className={s.cardMeta}>{buildMeta(template, t)}</p>
                    </div>

                    <button
                      type="button"
                      className={s.previewButton}
                      onClick={() => onEdit?.(template)}
                      disabled={!onEdit || isBusy}
                    >
                      <div className={s.previewShell}>
                        {isDefault ? <span className={s.defaultBadge}>{resolvedDefaultBadge}</span> : null}
                        <div className={s.previewPaper}>{renderPreview(template)}</div>
                      </div>

                      <span className={s.previewOverlay}>
                        <Pencil size={16} strokeWidth={2.1} />
                        <span className={s.previewOverlayText}>{resolvedEditLabel}</span>
                      </span>
                    </button>
                  </article>
                );
              })}
            </div>
          ) : null}
        </>
      ) : null}

      {extraError ? <p className={s.extraError}>{extraError}</p> : null}
      {extraSuccess ? <p className={s.successText}>{extraSuccess}</p> : null}
      {isFetching && !isLoading ? <p className={s.syncText}>{resolvedSyncLabel}</p> : null}
    </section>
  );
}
