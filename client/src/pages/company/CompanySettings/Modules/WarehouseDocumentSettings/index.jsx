import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SelectField } from "../../../../../components/ui/fields";
import {
  useGetCompanyWarehouseDocumentSettingsQuery,
  useUpdateCompanyWarehouseDocumentSettingsMutation,
} from "../../../../../store/rtk/companyWarehouseDocumentSettingsApi";
import {
  useGetDocumentTemplatesQuery,
  useSetTemplateAsDefaultMutation,
} from "../../../../../store/rtk/documentTemplateApi";
import { deleteTemplate } from "../../../../../api/documentTemplates.api";
import DocumentNumberingSettingsTable from "../_shared/DocumentNumberingSettingsTable";
import DocumentTemplatesSection from "../_shared/DocumentTemplatesSection";
import {
  getNumberPatternValidationMessages,
  validateNumberPattern,
} from "../_shared/numberPatternUtils";
import {
  buildTemplateEditorRoute,
  buildTemplateNewRoute,
  resolveTemplateDocumentTypeKey,
} from "../_shared/templateRouteUtils";
import useAclPermissions from "../../../../../hooks/useAclPermissions";
import s from "./WarehouseDocumentSettings.module.css";

const TYPE_ORDER = ["pz", "wz", "mm", "rw", "pw"];

const FALLBACK_TYPES = [
  {
    typeKey: "pz",
    label: "PZ",
    enabled: true,
    numberingType: "PZ",
    numberPattern: "PZ/$Y/$M/$NY(4)",
    lastSequence: 0,
    lastNumber: "0",
    nextSequence: 1,
    nextNumber: "PZ/2026/04/0001",
  },
  {
    typeKey: "wz",
    label: "WZ",
    enabled: true,
    numberingType: "WZ",
    numberPattern: "WZ/$Y/$M/$NY(4)",
    lastSequence: 0,
    lastNumber: "0",
    nextSequence: 1,
    nextNumber: "WZ/2026/04/0001",
  },
  {
    typeKey: "mm",
    label: "MM",
    enabled: true,
    numberingType: "MM",
    numberPattern: "MM/$Y/$M/$NY(4)",
    lastSequence: 0,
    lastNumber: "0",
    nextSequence: 1,
    nextNumber: "MM/2026/04/0001",
  },
  {
    typeKey: "rw",
    label: "RW",
    enabled: true,
    numberingType: "RW",
    numberPattern: "RW/$Y/$M/$NY(4)",
    lastSequence: 0,
    lastNumber: "0",
    nextSequence: 1,
    nextNumber: "RW/2026/04/0001",
  },
  {
    typeKey: "pw",
    label: "PW",
    enabled: true,
    numberingType: "PW",
    numberPattern: "PW/$Y/$M/$NY(4)",
    lastSequence: 0,
    lastNumber: "0",
    nextSequence: 1,
    nextNumber: "PW/2026/04/0001",
  },
];

const DEFAULT_FORM = {
  warehouseDefaultDocumentType: "wz",
  warehouseDocumentTypes: FALLBACK_TYPES,
};

const WAREHOUSE_TEMPLATE_FILTER_VALUES = ["all", "pz", "wz", "mm", "rw", "pw"];

// TODO(templates-warehouse): split documentTypeKey per warehouse subtype when registry adds dedicated keys.
const WAREHOUSE_TEMPLATE_DOCUMENT_TYPE_KEYS = new Set(["wz"]);

function getTemplateId(template) {
  if (!template || typeof template !== "object") return null;
  return template.id || template.templateId || template._id || null;
}

function getTemplateDocumentTypeKey(template) {
  if (!template || typeof template !== "object") return "";
  return String(template.documentTypeKey || template.documentType || template.typeKey || "").trim().toLowerCase();
}

function getWarehouseTypeLabel(typeKey, t) {
  const normalizedType = String(typeKey || "").trim().toLowerCase();
  return t(`companySettings.documents.types.${normalizedType}`, String(typeKey || "").trim());
}

function sortTypes(items = []) {
  const order = TYPE_ORDER.reduce((acc, key, index) => {
    acc[key] = index;
    return acc;
  }, {});
  return [...items].sort((left, right) => {
    const li = Number.isInteger(order[left.typeKey]) ? order[left.typeKey] : 999;
    const ri = Number.isInteger(order[right.typeKey]) ? order[right.typeKey] : 999;
    return li - ri;
  });
}

function normalizeTypes(items = []) {
  const fromApi = new Map((items || []).map((item) => [String(item?.typeKey || ""), item]));
  const merged = FALLBACK_TYPES.map((fallback) => {
    const current = fromApi.get(fallback.typeKey) || {};
    const nextSequence = Number(current.nextSequence || 1);
    const rawLastSequence = Number(current.lastSequence);
    const lastSequence =
      Number.isInteger(rawLastSequence) && rawLastSequence >= 0
        ? rawLastSequence
        : Math.max(nextSequence - 1, 0);
    const lastNumberRaw = String(current.lastNumber ?? "").trim();

    return {
      typeKey: fallback.typeKey,
      label: current.label || fallback.label,
      enabled: current.enabled === undefined ? fallback.enabled : Boolean(current.enabled),
      numberingType: current.numberingType || fallback.numberingType,
      numberPattern: current.numberPattern || fallback.numberPattern,
      lastSequence,
      lastNumber: lastSequence > 0 ? lastNumberRaw || "0" : "0",
      nextSequence,
      nextNumber: String(current.nextNumber || ""),
    };
  });
  return sortTypes(merged);
}

function normalizeForm(data = {}) {
  const warehouseDocumentTypes = normalizeTypes(data?.warehouseDocumentTypes || []);
  const enabledRows = warehouseDocumentTypes.filter((row) => row.enabled);
  const fallbackDefault = enabledRows[0]?.typeKey || "wz";
  const providedDefault = String(data?.warehouseDefaultDocumentType || fallbackDefault).trim().toLowerCase();
  const warehouseDefaultDocumentType = enabledRows.some((row) => row.typeKey === providedDefault)
    ? providedDefault
    : fallbackDefault;

  return {
    warehouseDefaultDocumentType,
    warehouseDocumentTypes,
  };
}

function toComparable(form = DEFAULT_FORM) {
  return JSON.stringify({
    warehouseDefaultDocumentType: form.warehouseDefaultDocumentType,
    warehouseDocumentTypes: sortTypes(form.warehouseDocumentTypes || []).map((row) => ({
      typeKey: row.typeKey,
      enabled: Boolean(row.enabled),
      numberPattern: String(row.numberPattern || ""),
    })),
  });
}

export default function WarehouseDocumentSettings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useAclPermissions();
  const canUpdateSettings = can("company:settings:update");
  const canManageTemplates = can("document:template:manage");
  const { data, isFetching, error, refetch } = useGetCompanyWarehouseDocumentSettingsQuery();
  const [updateSettings, { isLoading: isSaving }] = useUpdateCompanyWarehouseDocumentSettingsMutation();

  const [form, setForm] = useState(DEFAULT_FORM);
  const [initialForm, setInitialForm] = useState(DEFAULT_FORM);
  const [validationError, setValidationError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [templateActionError, setTemplateActionError] = useState("");
  const [templateActionSuccess, setTemplateActionSuccess] = useState("");
  const [deletingTemplateId, setDeletingTemplateId] = useState(null);
  const [settingDefaultTemplateId, setSettingDefaultTemplateId] = useState(null);
  const numberPatternValidationMessages = useMemo(
    () => getNumberPatternValidationMessages(t),
    [t]
  );
  const warehouseTemplateFilterOptions = useMemo(
    () =>
      WAREHOUSE_TEMPLATE_FILTER_VALUES.map((value) => ({
        value,
        label: value === "all"
          ? t("companySettings.documents.common.filters.all")
          : getWarehouseTypeLabel(value, t),
      })),
    [t]
  );

  useEffect(() => {
    const normalized = normalizeForm(data || DEFAULT_FORM);
    setForm(normalized);
    setInitialForm(normalized);
  }, [data]);

  const isDirty = useMemo(
    () => toComparable(form) !== toComparable(initialForm),
    [form, initialForm]
  );

  const enabledTypes = useMemo(
    () => (form.warehouseDocumentTypes || []).filter((row) => row.enabled),
    [form.warehouseDocumentTypes]
  );
  const templateKind = "warehouse";
  const templateType =
    templateFilter === "all"
      ? form.warehouseDefaultDocumentType || "wz"
      : templateFilter;
  const templateDocumentTypeKey = useMemo(
    () => resolveTemplateDocumentTypeKey({ kind: templateKind, type: templateType }),
    [templateKind, templateType]
  );
  const templateQuery = useMemo(() => {
    if (templateFilter === "all") {
      return undefined;
    }
    if (!templateDocumentTypeKey) {
      return undefined;
    }
    return { documentTypeKey: templateDocumentTypeKey };
  }, [templateDocumentTypeKey, templateFilter]);
  const {
    data: templateData,
    isLoading: isTemplatesLoading,
    isFetching: isTemplatesFetching,
    error: templatesError,
    refetch: refetchTemplates,
  } = useGetDocumentTemplatesQuery(templateQuery);
  const [setTemplateAsDefault, { isLoading: isSettingDefault }] = useSetTemplateAsDefaultMutation();
  const templates = useMemo(() => {
    const items = Array.isArray(templateData?.items) ? templateData.items : [];
    const warehouseTemplates = items.filter((template) =>
      WAREHOUSE_TEMPLATE_DOCUMENT_TYPE_KEYS.has(getTemplateDocumentTypeKey(template))
    );
    const enrich = (template) => ({
      ...template,
      documentKind: template.documentKind || templateKind,
      documentType: template.documentType || templateType,
    });
    if (templateFilter === "all") {
      return warehouseTemplates.map(enrich);
    }
    if (!templateDocumentTypeKey) {
      return [];
    }
    const targetKey = String(templateDocumentTypeKey).trim().toLowerCase();
    return warehouseTemplates
      .filter((template) => getTemplateDocumentTypeKey(template) === targetKey)
      .map(enrich);
  }, [templateData?.items, templateDocumentTypeKey, templateFilter, templateKind, templateType]);

  const defaultTypeOptions = useMemo(
    () =>
      enabledTypes.map((row) => ({
        value: row.typeKey,
        label: getWarehouseTypeLabel(row.typeKey, t),
      })),
    [enabledTypes, t]
  );

  const patternErrorsByType = useMemo(() => {
    const out = {};
    for (const row of form.warehouseDocumentTypes || []) {
      out[row.typeKey] = validateNumberPattern(row.numberPattern, numberPatternValidationMessages);
    }
    return out;
  }, [form.warehouseDocumentTypes, numberPatternValidationMessages]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setValidationError("");
    setSaveError("");
    setSaveSuccess("");
  };

  const setWarehouseDocumentTypes = (warehouseDocumentTypes = []) => {
    setForm((prev) => ({
      ...prev,
      warehouseDocumentTypes,
    }));
    setValidationError("");
    setSaveError("");
    setSaveSuccess("");
  };

  const toggleType = (typeKey) => {
    const target = form.warehouseDocumentTypes.find((row) => row.typeKey === typeKey);
    if (!target) return;

    const enabledCount = form.warehouseDocumentTypes.filter((row) => row.enabled).length;
    if (target.enabled && enabledCount <= 1) {
      setValidationError(t("companySettings.documents.warehouse.validation.atLeastOneEnabled"));
      return;
    }

    if (target.enabled && form.warehouseDefaultDocumentType === typeKey) {
      setValidationError(t("companySettings.documents.validation.cannotDisableDefaultType"));
      return;
    }

    setForm((prev) => ({
      ...prev,
      warehouseDocumentTypes: prev.warehouseDocumentTypes.map((row) =>
        row.typeKey === typeKey ? { ...row, enabled: !row.enabled } : row
      ),
    }));
    setValidationError("");
    setSaveError("");
    setSaveSuccess("");
  };

  const validateBeforeSave = () => {
    if (!enabledTypes.length) {
      return t("companySettings.documents.warehouse.validation.atLeastOneEnabled");
    }
    if (!enabledTypes.some((row) => row.typeKey === form.warehouseDefaultDocumentType)) {
      return t("companySettings.documents.validation.defaultTypeMustBeEnabled");
    }

    const firstPatternError = sortTypes(form.warehouseDocumentTypes).find((row) =>
      Boolean(patternErrorsByType[row.typeKey])
    );
    if (firstPatternError) {
      return patternErrorsByType[firstPatternError.typeKey];
    }

    return "";
  };

  const onSave = async () => {
    if (!canUpdateSettings) return;
    setValidationError("");
    setSaveError("");
    setSaveSuccess("");

    const formError = validateBeforeSave();
    if (formError) {
      setValidationError(formError);
      return;
    }

    const payload = {
      warehouseDefaultDocumentType: form.warehouseDefaultDocumentType,
      warehouseDocumentTypes: sortTypes(form.warehouseDocumentTypes).map((row) => ({
        typeKey: row.typeKey,
        enabled: Boolean(row.enabled),
        numberingType: row.numberingType,
        numberPattern: row.numberPattern,
      })),
    };

    try {
      const saved = await updateSettings(payload).unwrap();
      const normalized = normalizeForm(saved || payload);
      setForm(normalized);
      setInitialForm(normalized);
      setSaveSuccess(t("companySettings.documents.warehouse.success.saved"));
    } catch (updateError) {
      setSaveError(
        updateError?.data?.message ||
          updateError?.data?.error ||
          t("companySettings.documents.warehouse.errors.saveFailed")
      );
    }
  };

  const onAddTemplate = () => {
    setTemplateActionError("");
    setTemplateActionSuccess("");
    navigate(buildTemplateNewRoute({ kind: templateKind, type: templateType }));
  };

  const onEditTemplate = (template) => {
    const templateId = getTemplateId(template);
    if (!templateId) return;
    navigate(buildTemplateEditorRoute(templateId));
  };

  const onDeleteTemplate = async (template) => {
    const templateId = getTemplateId(template);
    if (!templateId) return;
    if (template?.isDefault) {
      setTemplateActionError(t("companySettings.documents.templates.errors.cannotDeleteDefault"));
      setTemplateActionSuccess("");
      return;
    }

    setTemplateActionError("");
    setTemplateActionSuccess("");
    setDeletingTemplateId(templateId);
    try {
      await deleteTemplate(templateId);
      await refetchTemplates();
      setTemplateActionSuccess(t("companySettings.documents.templates.success.deleted"));
    } catch (requestError) {
      setTemplateActionError(
        requestError?.payload?.message ||
          requestError?.payload?.error ||
          requestError?.message ||
          t("companySettings.documents.templates.errors.deleteFailed")
      );
    } finally {
      setDeletingTemplateId(null);
    }
  };

  const onSetDefaultTemplate = async (template) => {
    const templateId = getTemplateId(template);
    if (!templateId || template?.isDefault) return;

    setTemplateActionError("");
    setTemplateActionSuccess("");
    setSettingDefaultTemplateId(templateId);
    try {
      await setTemplateAsDefault({
        templateId,
        documentKind: template.documentKind || templateKind,
        documentType: template.documentType || templateType,
      }).unwrap();
      await refetchTemplates();
      setTemplateActionSuccess(t("companySettings.documents.templates.success.defaultUpdated"));
    } catch (requestError) {
      setTemplateActionError(
        requestError?.data?.message ||
          requestError?.data?.error ||
          t("companySettings.documents.templates.errors.setDefaultFailed")
      );
    } finally {
      setSettingDefaultTemplateId(null);
    }
  };

  if (isFetching && !data) {
    return <div className={s.skeleton}>{t("companySettings.documents.warehouse.loading")}</div>;
  }

  if (error && !data) {
    return (
      <div className={s.stateCard}>
        <p className={s.stateTitle}>{t("companySettings.documents.warehouse.errors.loadTitle")}</p>
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
      <section className={s.card}>
        <header className={s.header}>
          <h2 className={s.title}>{t("companySettings.documents.common.basicSettings")}</h2>
          <p className={s.subtitle}>
            {t("companySettings.documents.warehouse.subtitle")}
          </p>
        </header>

        <div className={s.field}>
          <label className={s.label}>{t("companySettings.documents.warehouse.fields.defaultType")}</label>
          <div className={s.selectWrap}>
            <SelectField
              value={form.warehouseDefaultDocumentType}
              options={defaultTypeOptions}
              onValueChange={(value) => setField("warehouseDefaultDocumentType", value)}
              placeholder={t("companySettings.documents.common.selectDocumentType")}
              disabled={isSaving}
            />
          </div>
        </div>

        {validationError ? <p className={s.error}>{validationError}</p> : null}
        {saveError ? <p className={s.error}>{saveError}</p> : null}
        {saveSuccess ? <p className={s.success}>{saveSuccess}</p> : null}

        <div className={s.actions}>
          <button
            type="button"
            className={s.ghostButton}
            onClick={refetch}
            disabled={isSaving || isFetching}
          >
            {t("companySettings.documents.common.refresh")}
          </button>
          <button
            type="button"
            className={s.primaryButton}
            onClick={onSave}
            disabled={isSaving || !isDirty || !canUpdateSettings}
          >
            {isSaving
              ? t("companySettings.documents.common.saving")
              : t("companySettings.documents.common.saveSettings")}
          </button>
        </div>
      </section>

      <DocumentNumberingSettingsTable
        rows={sortTypes(form.warehouseDocumentTypes).map((row) => ({
          ...row,
          label: getWarehouseTypeLabel(row.typeKey, t),
        }))}
        onRowsChange={setWarehouseDocumentTypes}
        errors={patternErrorsByType}
        allowToggle
        allowDisableLast={false}
        onToggleRow={(typeKey) => toggleType(typeKey)}
        disabled={isSaving || !canUpdateSettings}
        columns={{
          documentType: t("companySettings.documents.numbering.columns.documentType"),
          numberPattern: t("companySettings.documents.numbering.columns.numberPattern"),
          lastNumber: t("companySettings.documents.numbering.columns.lastNumber"),
          nextNumber: t("companySettings.documents.numbering.columns.nextNumber"),
          enabled: t("companySettings.documents.numbering.columns.enabled"),
        }}
      />

      <DocumentTemplatesSection
        templates={templates}
        isLoading={isTemplatesLoading}
        isFetching={isTemplatesFetching}
        error={templatesError}
        extraError={templateActionError}
        extraSuccess={templateActionSuccess}
        onRetry={refetchTemplates}
        onAdd={canManageTemplates ? onAddTemplate : null}
        onEdit={canManageTemplates ? onEditTemplate : null}
        onDelete={canManageTemplates ? onDeleteTemplate : null}
        onSetDefault={canManageTemplates ? onSetDefaultTemplate : null}
        settingDefaultTemplateId={isSettingDefault ? settingDefaultTemplateId : null}
        deletingTemplateId={deletingTemplateId}
        filterOptions={warehouseTemplateFilterOptions}
        filterValue={templateFilter}
        onFilterChange={setTemplateFilter}
      />
    </div>
  );
}
