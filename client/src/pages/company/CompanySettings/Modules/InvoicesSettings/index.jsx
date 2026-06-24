import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HtmlEditorField, SelectField } from "../../../../../components/ui/fields";
import {
  useGetCompanyInvoiceSettingsQuery,
  useUpdateCompanyInvoiceSettingsMutation,
} from "../../../../../store/rtk/companyInvoiceSettingsApi";
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
import s from "./InvoicesSettings.module.css";

const TYPE_ORDER = ["invoice", "correction", "proforma", "advance", "advance_proforma", "wdt"];

const FALLBACK_TYPES = [
  {
    typeKey: "invoice",
    label: "invoice",
    enabled: true,
    numberingType: "INVOICE",
    numberPattern: "FV/$Y/$M/$NY(4)",
    lastSequence: 0,
    lastNumber: "0",
    nextSequence: 1,
    nextNumber: "FV/2026/04/0001",
  },
  {
    typeKey: "correction",
    label: "correction",
    enabled: true,
    numberingType: "INVOICE_CORRECTION",
    numberPattern: "FVK/$Y/$M/$NY(4)",
    lastSequence: 0,
    lastNumber: "0",
    nextSequence: 1,
    nextNumber: "FVK/2026/04/0001",
  },
  {
    typeKey: "proforma",
    label: "proforma",
    enabled: true,
    numberingType: "INVOICE_PROFORMA",
    numberPattern: "FV/$Y/$M/$NY(4)/PRO",
    lastSequence: 0,
    lastNumber: "0",
    nextSequence: 1,
    nextNumber: "FV/2026/04/0001/PRO",
  },
  {
    typeKey: "advance",
    label: "advance",
    enabled: false,
    numberingType: "INVOICE_ADVANCE",
    numberPattern: "FVZ/$Y/$M/$NY(4)",
    lastSequence: 0,
    lastNumber: "0",
    nextSequence: 1,
    nextNumber: "FVZ/2026/04/0001",
  },
  {
    typeKey: "advance_proforma",
    label: "advance_proforma",
    enabled: false,
    numberingType: "INVOICE_ADVANCE_PROFORMA",
    numberPattern: "FVZ/$Y/$M/$NY(4)/PRO",
    lastSequence: 0,
    lastNumber: "0",
    nextSequence: 1,
    nextNumber: "FVZ/2026/04/0001/PRO",
  },
  {
    typeKey: "wdt",
    label: "wdt",
    enabled: false,
    numberingType: "INVOICE_WDT",
    numberPattern: "FV/$Y/$M/$NY(4)/WDT",
    lastSequence: 0,
    lastNumber: "0",
    nextSequence: 1,
    nextNumber: "FV/2026/04/0001/WDT",
  },
];

const DEFAULT_FORM = {
  invoiceDefaultType: "invoice",
  invoiceDefaultPaymentMethod: "bank_transfer",
  invoiceDefaultPaymentTermDays: 30,
  invoiceDefaultCurrency: "PLN",
  invoiceStockUpdateMode: "disabled",
  invoiceAnnotationMode: "empty",
  invoiceAnnotationTemplateHtml: null,
  invoiceTypes: FALLBACK_TYPES,
};

const PAYMENT_METHOD_VALUES = [
  "bank_transfer",
  "cash",
  "card",
  "blik",
  "online",
  "cash_on_delivery",
  "other",
];

const PAYMENT_TERM_VALUES = [0, 3, 7, 14, 21, 30, 45, 60, 90];

const CURRENCY_OPTIONS = [
  "PLN",
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "CZK",
  "SEK",
  "NOK",
  "DKK",
  "UAH",
  "HUF",
  "RON",
  "BGN",
  "TRY",
  "CAD",
  "AUD",
  "JPY",
  "CNY",
].map((currency) => ({ value: currency, label: currency }));

const STOCK_UPDATE_VALUES = ["disabled", "create_warehouse_document"];

const ANNOTATION_VALUES = ["empty", "copy_from_documents", "template"];

const INVOICE_TEMPLATE_FILTER_VALUES = [
  "all",
  "invoice",
  "correction",
  "proforma",
  "advance",
  "advance_proforma",
  "wdt",
];

// TODO(templates): map dedicated template documentTypeKey per invoice subtype when backend registry adds them.
const INVOICE_TEMPLATE_DOCUMENT_TYPE_KEYS = new Set(["faktura_vat"]);

function stripHtml(value = "") {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTemplateId(template) {
  if (!template || typeof template !== "object") return null;
  return template.id || template.templateId || template._id || null;
}

function getTemplateDocumentTypeKey(template) {
  if (!template || typeof template !== "object") return "";
  return String(template.documentTypeKey || template.documentType || template.typeKey || "").trim().toLowerCase();
}

function getInvoiceTypeLabel(typeKey, t, { short = false } = {}) {
  const normalizedType = String(typeKey || "").trim().toLowerCase();
  const key = short
    ? `companySettings.documents.invoices.filter.${normalizedType}`
    : `companySettings.documents.types.${normalizedType}`;

  const translated = t(key, "");
  if (translated) return translated;

  return String(typeKey || "").trim();
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
    const lastSequence = Number.isInteger(rawLastSequence) && rawLastSequence >= 0
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
  const invoiceTypes = normalizeTypes(data?.invoiceTypes || []);
  const enabled = invoiceTypes.filter((row) => row.enabled);
  const fallbackType = enabled[0]?.typeKey || "invoice";
  const providedDefault = String(data?.invoiceDefaultType || "").trim() || fallbackType;
  const defaultType = enabled.some((row) => row.typeKey === providedDefault)
    ? providedDefault
    : fallbackType;

  return {
    invoiceDefaultType: defaultType,
    invoiceDefaultPaymentMethod: String(data?.invoiceDefaultPaymentMethod || "bank_transfer"),
    invoiceDefaultPaymentTermDays: Number(data?.invoiceDefaultPaymentTermDays || 30),
    invoiceDefaultCurrency: String(data?.invoiceDefaultCurrency || "PLN").toUpperCase(),
    invoiceStockUpdateMode: String(data?.invoiceStockUpdateMode || "disabled"),
    invoiceAnnotationMode: String(data?.invoiceAnnotationMode || "empty"),
    invoiceAnnotationTemplateHtml:
      data?.invoiceAnnotationTemplateHtml === null || data?.invoiceAnnotationTemplateHtml === undefined
        ? null
        : String(data.invoiceAnnotationTemplateHtml),
    invoiceTypes,
  };
}

function toComparable(form = DEFAULT_FORM) {
  return JSON.stringify({
    invoiceDefaultType: form.invoiceDefaultType,
    invoiceDefaultPaymentMethod: form.invoiceDefaultPaymentMethod,
    invoiceDefaultPaymentTermDays: Number(form.invoiceDefaultPaymentTermDays || 0),
    invoiceDefaultCurrency: form.invoiceDefaultCurrency,
    invoiceStockUpdateMode: form.invoiceStockUpdateMode,
    invoiceAnnotationMode: form.invoiceAnnotationMode,
    invoiceAnnotationTemplateHtml: form.invoiceAnnotationTemplateHtml || null,
    invoiceTypes: sortTypes(form.invoiceTypes || []).map((row) => ({
      typeKey: row.typeKey,
      enabled: Boolean(row.enabled),
      numberPattern: String(row.numberPattern || ""),
    })),
  });
}

export default function InvoicesSettings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useAclPermissions();
  const canUpdateSettings = can("company:settings:update");
  const canManageTemplates = can("document:template:manage");
  const { data, isFetching, error, refetch } = useGetCompanyInvoiceSettingsQuery();
  const [updateSettings, { isLoading: isSaving }] = useUpdateCompanyInvoiceSettingsMutation();

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
  const paymentMethodOptions = useMemo(
    () =>
      PAYMENT_METHOD_VALUES.map((value) => ({
        value,
        label: t(`companySettings.documents.options.paymentMethod.${value}`),
      })),
    [t]
  );
  const paymentTermOptions = useMemo(
    () =>
      PAYMENT_TERM_VALUES.map((value) => ({
        value: String(value),
        label: t("companySettings.documents.options.paymentTermDays", { count: value }),
      })),
    [t]
  );
  const stockUpdateOptions = useMemo(
    () =>
      STOCK_UPDATE_VALUES.map((value) => ({
        value,
        label: t(`companySettings.documents.options.stockUpdate.${value}`),
      })),
    [t]
  );
  const annotationOptions = useMemo(
    () =>
      ANNOTATION_VALUES.map((value) => ({
        value,
        label: t(`companySettings.documents.options.annotation.${value === "copy_from_documents" ? "copyFromDocuments" : value}`),
      })),
    [t]
  );
  const invoiceTemplateFilterOptions = useMemo(
    () =>
      INVOICE_TEMPLATE_FILTER_VALUES.map((value) => ({
        value,
        label: value === "all"
          ? t("companySettings.documents.common.filters.all")
          : getInvoiceTypeLabel(value, t, { short: true }),
      })),
    [t]
  );

  useEffect(() => {
    const normalized = normalizeForm(data || DEFAULT_FORM);
    setForm(normalized);
    setInitialForm(normalized);
  }, [data]);

  const isTemplateMode = form.invoiceAnnotationMode === "template";
  const templateKind = "invoice";
  const templateType =
    templateFilter === "all" ? form.invoiceDefaultType || "invoice" : templateFilter;
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
    const invoiceTemplates = items.filter((template) =>
      INVOICE_TEMPLATE_DOCUMENT_TYPE_KEYS.has(getTemplateDocumentTypeKey(template))
    );
    const enrich = (template) => ({
      ...template,
      documentKind: template.documentKind || templateKind,
      documentType: template.documentType || templateType,
    });
    if (templateFilter === "all") {
      return invoiceTemplates.map(enrich);
    }
    if (!templateDocumentTypeKey) {
      return [];
    }
    const targetKey = String(templateDocumentTypeKey).trim().toLowerCase();
    return invoiceTemplates
      .filter((template) => getTemplateDocumentTypeKey(template) === targetKey)
      .map(enrich);
  }, [templateData?.items, templateDocumentTypeKey, templateFilter, templateKind, templateType]);

  const isDirty = useMemo(
    () => toComparable(form) !== toComparable(initialForm),
    [form, initialForm]
  );

  const enabledTypes = useMemo(
    () => (form.invoiceTypes || []).filter((row) => row.enabled),
    [form.invoiceTypes]
  );

  const defaultTypeOptions = useMemo(
    () =>
      enabledTypes.map((row) => ({
        value: row.typeKey,
        label: getInvoiceTypeLabel(row.typeKey, t),
      })),
    [enabledTypes, t]
  );

  const patternErrorsByType = useMemo(() => {
    const out = {};
    for (const row of form.invoiceTypes || []) {
      out[row.typeKey] = validateNumberPattern(row.numberPattern, numberPatternValidationMessages);
    }
    return out;
  }, [form.invoiceTypes, numberPatternValidationMessages]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setValidationError("");
    setSaveError("");
    setSaveSuccess("");
  };

  const setInvoiceTypes = (invoiceTypes = []) => {
    setForm((prev) => ({
      ...prev,
      invoiceTypes,
    }));
    setValidationError("");
    setSaveError("");
    setSaveSuccess("");
  };

  const toggleType = (typeKey) => {
    const target = form.invoiceTypes.find((row) => row.typeKey === typeKey);
    if (!target) return;

    const enabledCount = form.invoiceTypes.filter((row) => row.enabled).length;
    if (target.enabled && enabledCount <= 1) {
      setValidationError(t("companySettings.documents.invoices.validation.atLeastOneEnabled"));
      return;
    }

    if (target.enabled && form.invoiceDefaultType === typeKey) {
      setValidationError(t("companySettings.documents.validation.cannotDisableDefaultType"));
      return;
    }

    setForm((prev) => ({
      ...prev,
      invoiceTypes: prev.invoiceTypes.map((row) =>
        row.typeKey === typeKey ? { ...row, enabled: !row.enabled } : row
      ),
    }));
    setValidationError("");
    setSaveError("");
    setSaveSuccess("");
  };

  const validateBeforeSave = () => {
    if (!enabledTypes.length) {
      return t("companySettings.documents.invoices.validation.atLeastOneEnabled");
    }
    if (!enabledTypes.some((row) => row.typeKey === form.invoiceDefaultType)) {
      return t("companySettings.documents.validation.defaultTypeMustBeEnabled");
    }

    const firstPatternError = sortTypes(form.invoiceTypes).find((row) =>
      Boolean(patternErrorsByType[row.typeKey])
    );
    if (firstPatternError) {
      return patternErrorsByType[firstPatternError.typeKey];
    }

    if (isTemplateMode && !stripHtml(form.invoiceAnnotationTemplateHtml || "")) {
      return t("companySettings.documents.invoices.validation.templateRequired");
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
      invoiceDefaultType: form.invoiceDefaultType,
      invoiceDefaultPaymentMethod: form.invoiceDefaultPaymentMethod,
      invoiceDefaultPaymentTermDays: Number(form.invoiceDefaultPaymentTermDays || 30),
      invoiceDefaultCurrency: form.invoiceDefaultCurrency,
      invoiceStockUpdateMode: form.invoiceStockUpdateMode,
      invoiceAnnotationMode: form.invoiceAnnotationMode,
      invoiceAnnotationTemplateHtml:
        form.invoiceAnnotationMode === "template"
          ? form.invoiceAnnotationTemplateHtml || null
          : null,
      invoiceTypes: sortTypes(form.invoiceTypes).map((row) => ({
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
      setSaveSuccess(t("companySettings.documents.invoices.success.saved"));
    } catch (updateError) {
      setSaveError(
        updateError?.data?.message ||
          updateError?.data?.error ||
          t("companySettings.documents.invoices.errors.saveFailed")
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
    return <div className={s.skeleton}>{t("companySettings.documents.invoices.loading")}</div>;
  }

  if (error && !data) {
    return (
      <div className={s.stateCard}>
        <p className={s.stateTitle}>{t("companySettings.documents.invoices.errors.loadTitle")}</p>
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
        </header>

        <div className={s.fieldsGrid}>
          <div className={s.field}>
            <label className={s.label}>{t("companySettings.documents.invoices.fields.defaultType")}</label>
            <div className={s.selectWrap}>
              <SelectField
                value={form.invoiceDefaultType}
                options={defaultTypeOptions}
                onValueChange={(value) => setField("invoiceDefaultType", value)}
                placeholder={t("companySettings.documents.common.selectInvoiceType")}
                disabled={isSaving}
              />
            </div>
          </div>

          <div className={s.field}>
            <label className={s.label}>{t("companySettings.documents.invoices.fields.defaultPaymentMethod")}</label>
            <div className={s.selectWrap}>
              <SelectField
                value={form.invoiceDefaultPaymentMethod}
                options={paymentMethodOptions}
                onValueChange={(value) => setField("invoiceDefaultPaymentMethod", value)}
                placeholder={t("companySettings.documents.common.selectPaymentMethod")}
                disabled={isSaving}
              />
            </div>
          </div>

          <div className={s.field}>
            <label className={s.label}>{t("companySettings.documents.invoices.fields.defaultPaymentTerm")}</label>
            <div className={s.selectWrap}>
              <SelectField
                value={String(form.invoiceDefaultPaymentTermDays)}
                options={paymentTermOptions}
                onValueChange={(value) => setField("invoiceDefaultPaymentTermDays", Number(value || 30))}
                placeholder={t("companySettings.documents.common.selectPaymentTerm")}
                disabled={isSaving}
              />
            </div>
          </div>

          <div className={s.field}>
            <label className={s.label}>{t("companySettings.documents.invoices.fields.defaultCurrency")}</label>
            <div className={s.selectWrap}>
              <SelectField
                value={form.invoiceDefaultCurrency}
                options={CURRENCY_OPTIONS}
                onValueChange={(value) => setField("invoiceDefaultCurrency", value)}
                placeholder={t("companySettings.documents.common.selectCurrency")}
                disabled={isSaving}
              />
            </div>
          </div>

          <div className={s.field}>
            <label className={s.label}>{t("companySettings.documents.invoices.fields.stockUpdateMode")}</label>
            <div className={s.selectWrap}>
              <SelectField
                value={form.invoiceStockUpdateMode}
                options={stockUpdateOptions}
                onValueChange={(value) => setField("invoiceStockUpdateMode", value)}
                placeholder={t("companySettings.documents.common.selectStockMode")}
                disabled={isSaving}
              />
            </div>
          </div>

          <div className={s.field}>
            <label className={s.label}>{t("companySettings.documents.invoices.fields.annotation")}</label>
            <div className={s.selectWrap}>
              <SelectField
                value={form.invoiceAnnotationMode}
                options={annotationOptions}
                onValueChange={(value) => setField("invoiceAnnotationMode", value)}
                placeholder={t("companySettings.documents.common.selectAnnotationMode")}
                disabled={isSaving}
              />
            </div>
          </div>
        </div>

        {isTemplateMode ? (
          <div className={s.field}>
            <label className={s.label}>{t("companySettings.documents.common.annotationTemplateLabel")}</label>
            <HtmlEditorField
              value={form.invoiceAnnotationTemplateHtml || ""}
              onValueChange={(value) => setField("invoiceAnnotationTemplateHtml", value || null)}
              placeholder={t("companySettings.documents.invoices.annotationTemplatePlaceholder")}
              minHeight={170}
              toolbarPreset="annotation"
              disabled={isSaving}
            />
          </div>
        ) : null}

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
        rows={sortTypes(form.invoiceTypes).map((row) => ({
          ...row,
          label: getInvoiceTypeLabel(row.typeKey, t),
        }))}
        onRowsChange={setInvoiceTypes}
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
        filterOptions={invoiceTemplateFilterOptions}
        filterValue={templateFilter}
        onFilterChange={setTemplateFilter}
      />
    </div>
  );
}
