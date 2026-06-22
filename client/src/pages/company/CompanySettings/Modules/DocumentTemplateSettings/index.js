import { useEffect, useMemo, useState } from "react";
import { DOCUMENT_TYPE_OPTIONS } from "../../../../../components/documents/documentTypeConfig";
import DocumentTemplateRenderer from "../../../../../components/documents/DocumentTemplateRenderer";
import { buildDocumentTemplateSampleModel } from "../../../../../components/documents/documentTemplateSampleModel";
import {
  TEMPLATE_LAYOUT_DENSITIES,
  TEMPLATE_BLOCK_TOGGLE_FIELDS,
  TEMPLATE_BUYER_FIELD_TOGGLE_FIELDS,
  TEMPLATE_SELLER_FIELD_TOGGLE_FIELDS,
  TEMPLATE_SECTION_LABELS,
  buildDefaultTemplateSetting,
  getTemplatePresetByKey,
  getTemplatePresetsForType,
  resolveTemplateSectionOrder,
  resolveTemplatePresetForType,
} from "../../../../../components/documents/documentTemplatePresets";
import {
  MAX_TITLE_OVERRIDE_LENGTH,
  normalizeTemplateSettingsRows,
  validateTemplateSettingsRows,
} from "../../../../../components/documents/documentTemplateSettingsModel";
import {
  useGetDocumentTemplateSettingsQuery,
  useUpdateDocumentTemplateSettingsMutation,
} from "../../../../../store/rtk/documentTemplateSettingsApi";
import { useGetCompanyQuery } from "../../../../../store/rtk/companyApi";
import { useListCounterpartiesQuery } from "../../../../../store/rtk/counterpartyApi";
import { CheckboxField, SelectField, TextField } from "../../../../../components/ui/fields";
import s from "./DocumentTemplateSettings.module.css";

const TYPE_LABELS = DOCUMENT_TYPE_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const TOGGLE_LABELS = Object.freeze({
  showLogo: "Показывать логотип",
  showSellerBlock: "Показывать блок продавца",
  showBuyerBlock: "Показывать блок покупателя",
  showPaymentBlock: "Показывать блок оплаты",
  showNotesBlock: "Показывать блок примечаний",
  showSourceReference: "Показывать ссылку на источник",
  showVatSummary: "Показывать итог НДС",
  showStatusBadge: "Показывать badge статуса",
  showTermsBlock: "Показывать блок условий",
  showSellerName: "Название продавца",
  showSellerAddress: "Адрес продавца",
  showSellerPostalCity: "Индекс и город продавца",
  showSellerCountry: "Страна продавца",
  showSellerNip: "NIP / VAT ID продавца",
  showSellerEmail: "Email продавца",
  showSellerPhone: "Телефон продавца",
  showSellerBank: "Банк продавца",
  showSellerBankAccount: "Счёт продавца",
  showSellerWebsite: "Сайт продавца",
  showBuyerName: "Название покупателя",
  showBuyerAddress: "Адрес покупателя",
  showBuyerPostalCity: "Индекс и город покупателя",
  showBuyerCountry: "Страна покупателя",
  showBuyerNip: "NIP / VAT ID покупателя",
  showBuyerEmail: "Email покупателя",
  showBuyerPhone: "Телефон покупателя",
});

const DENSITY_LABELS = Object.freeze({
  compact: "compact",
  comfortable: "comfortable",
  spacious: "spacious",
});

function patchRow(rows, documentType, patch) {
  return rows.map((row) => {
    if (row.documentType !== documentType) return row;
    return { ...row, ...patch };
  });
}

function moveSection(sectionOrder = [], fromIndex, toIndex) {
  const list = Array.isArray(sectionOrder) ? [...sectionOrder] : [];
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) {
    return list;
  }
  const [moved] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, moved);
  return list;
}

export default function DocumentTemplateSettings() {
  const { data, isFetching, refetch } = useGetDocumentTemplateSettingsQuery();
  const { data: companyData } = useGetCompanyQuery();
  const { data: counterpartiesData } = useListCounterpartiesQuery({ page: 1, limit: 30 });
  const [updateSettings, { isLoading: isSaving }] = useUpdateDocumentTemplateSettingsMutation();

  const [rows, setRows] = useState(() => normalizeTemplateSettingsRows([]));
  const [activeType, setActiveType] = useState("INVOICE");
  const [isDirty, setIsDirty] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  useEffect(() => {
    const incomingRows = normalizeTemplateSettingsRows(data?.items || []);
    setRows(incomingRows);
    setIsDirty(false);
  }, [data]);

  const orderedRows = useMemo(() => {
    return normalizeTemplateSettingsRows(rows);
  }, [rows]);

  const activeRow = useMemo(() => {
    const row = orderedRows.find((item) => item.documentType === activeType);
    return row || buildDefaultTemplateSetting(activeType);
  }, [orderedRows, activeType]);

  const activePresets = useMemo(() => {
    return getTemplatePresetsForType(activeType);
  }, [activeType]);

  const activePresetConfig = useMemo(() => {
    return getTemplatePresetByKey(activeRow.templatePreset);
  }, [activeRow.templatePreset]);

  const previewBuyer = useMemo(() => {
    const rows = Array.isArray(counterpartiesData?.items) ? counterpartiesData.items : [];
    if (!rows.length) return null;
    const preferred = rows.find((row) => String(row?.type || "").toLowerCase() === "client");
    return preferred || rows[0];
  }, [counterpartiesData?.items]);

  const previewModel = useMemo(
    () =>
      buildDocumentTemplateSampleModel(activeType, {
        company: companyData,
        buyer: previewBuyer,
      }),
    [activeType, companyData, previewBuyer]
  );
  const hasPreviewData = useMemo(() => {
    if (!previewModel || typeof previewModel !== "object") return false;
    const hasItems = Array.isArray(previewModel.items) && previewModel.items.length > 0;
    return Boolean(
      previewModel.type ||
        previewModel.number ||
        previewModel?.seller?.name ||
        previewModel?.buyer?.name ||
        hasItems
    );
  }, [previewModel]);

  const onRowChange = (patch) => {
    setRows((prev) => patchRow(prev, activeType, patch));
    setIsDirty(true);
    setSaveError("");
    setSaveSuccess("");
  };

  const onPresetChange = (nextPreset) => {
    const resolvedPreset = resolveTemplatePresetForType(activeType, nextPreset);
    const preset = getTemplatePresetByKey(resolvedPreset);
    const defaults = preset?.defaults || {};
    onRowChange({
      templatePreset: resolvedPreset,
      layoutDensity: defaults.layoutDensity || activeRow.layoutDensity,
      sectionOrder: resolveTemplateSectionOrder(activeType, resolvedPreset, []),
      ...[...TEMPLATE_BLOCK_TOGGLE_FIELDS, ...TEMPLATE_SELLER_FIELD_TOGGLE_FIELDS, ...TEMPLATE_BUYER_FIELD_TOGGLE_FIELDS].reduce((acc, fieldName) => {
        acc[fieldName] = typeof defaults[fieldName] === "boolean" ? defaults[fieldName] : activeRow[fieldName];
        return acc;
      }, {}),
    });
  };

  const onSave = async () => {
    const payload = normalizeTemplateSettingsRows(rows);
    const validationMessage = validateTemplateSettingsRows(payload);
    if (validationMessage) {
      setSaveError(validationMessage);
      setSaveSuccess("");
      return;
    }

    try {
      const response = await updateSettings(payload).unwrap();
      const normalized = normalizeTemplateSettingsRows(response?.items || []);
      setRows(normalized);
      setIsDirty(false);
      setSaveError("");
      setSaveSuccess("Настройки шаблонов сохранены");
    } catch (error) {
      setSaveSuccess("");
      setSaveError(error?.data?.message || error?.data?.error || "Не удалось сохранить настройки шаблонов");
    }
  };

  if (isFetching && !data) {
    return <div className={s.skeleton}>Загрузка настроек шаблонов…</div>;
  }

  return (
    <div className={s.wrap}>
      <header className={s.header}>
        <div className={s.headerTop}>
          <div className={s.headerText}>
            <h2 className={s.title}>Шаблоны документов</h2>
            <p className={s.subtitle}>
              Настройте preset, плотность и видимость базовых блоков по типам документов. Эти настройки являются
              foundation для document preview, PDF и печатных шаблонов.
            </p>
          </div>

          <div className={s.actions}>
            <button type="button" className={s.ghostButton} onClick={refetch} disabled={isFetching || isSaving}>
              Обновить
            </button>
            <button
              type="button"
              className={s.primaryButton}
              onClick={onSave}
              disabled={isSaving || !isDirty || !orderedRows.length}
            >
              {isSaving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </div>
      </header>

      {saveError ? <p className={s.error}>{saveError}</p> : null}
      {saveSuccess ? <p className={s.success}>{saveSuccess}</p> : null}

      <div className={s.layout}>
        <section className={s.settingsPane}>
          <div className={s.section}>
            <p className={s.sectionLabel}>Тип документа</p>
            <div className={s.typeGrid}>
              {DOCUMENT_TYPE_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={`${s.typeButton} ${activeType === option.value ? s.typeButtonActive : ""}`}
                  onClick={() => setActiveType(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className={s.section}>
            <p className={s.sectionLabel}>Preset шаблона</p>
            <SelectField
              inputClassName={s.select}
              value={activeRow.templatePreset}
              onValueChange={(value) => onPresetChange(value)}
              options={activePresets.map((preset) => ({ value: preset.key, label: preset.label }))}
            />
            <p className={s.helper}>{activePresetConfig?.category || "preset"}</p>
          </div>

          <div className={s.section}>
            <p className={s.sectionLabel}>Заголовок документа (override)</p>
            <TextField
              type="text"
              inputClassName={s.input}
              value={activeRow.documentTitleOverride}
              maxLength={MAX_TITLE_OVERRIDE_LENGTH}
              onValueChange={(value) => onRowChange({ documentTitleOverride: value })}
              placeholder={`Например: ${TYPE_LABELS[activeType] || activeType}`}
            />
            <p className={s.helper}>
              {String(activeRow.documentTitleOverride || "").length}/{MAX_TITLE_OVERRIDE_LENGTH}
            </p>
          </div>

          <div className={s.section}>
            <p className={s.sectionLabel}>Плотность layout</p>
            <SelectField
              inputClassName={s.select}
              value={activeRow.layoutDensity}
              onValueChange={(value) => onRowChange({ layoutDensity: value })}
              options={TEMPLATE_LAYOUT_DENSITIES.map((density) => ({
                value: density,
                label: DENSITY_LABELS[density],
              }))}
            />
          </div>

          <details className={s.section} open>
            <summary className={s.sectionSummary}>Видимость блоков</summary>
            <div className={s.toggles}>
              {TEMPLATE_BLOCK_TOGGLE_FIELDS.map((fieldName) => (
                <CheckboxField
                  key={`${activeType}-${fieldName}`}
                  className={s.toggleRow}
                  checked={Boolean(activeRow[fieldName])}
                  onValueChange={(checked) => onRowChange({ [fieldName]: checked })}
                  label={TOGGLE_LABELS[fieldName] || fieldName}
                />
              ))}
            </div>
          </details>

          <details className={s.section}>
            <summary className={s.sectionSummary}>Поля продавца</summary>
            <div className={s.toggles}>
              {TEMPLATE_SELLER_FIELD_TOGGLE_FIELDS.map((fieldName) => (
                <CheckboxField
                  key={`${activeType}-${fieldName}`}
                  className={s.toggleRow}
                  checked={Boolean(activeRow[fieldName])}
                  onValueChange={(checked) => onRowChange({ [fieldName]: checked })}
                  label={TOGGLE_LABELS[fieldName] || fieldName}
                />
              ))}
            </div>
          </details>

          <details className={s.section}>
            <summary className={s.sectionSummary}>Поля покупателя</summary>
            <div className={s.toggles}>
              {TEMPLATE_BUYER_FIELD_TOGGLE_FIELDS.map((fieldName) => (
                <CheckboxField
                  key={`${activeType}-${fieldName}`}
                  className={s.toggleRow}
                  checked={Boolean(activeRow[fieldName])}
                  onValueChange={(checked) => onRowChange({ [fieldName]: checked })}
                  label={TOGGLE_LABELS[fieldName] || fieldName}
                />
              ))}
            </div>
          </details>

          <details className={s.section}>
            <summary className={s.sectionSummary}>Порядок секций</summary>
            <div className={s.sectionOrderList}>
              {(Array.isArray(activeRow.sectionOrder) ? activeRow.sectionOrder : []).map((sectionKey, index, list) => (
                <div key={`${activeType}-${sectionKey}`} className={s.sectionOrderRow}>
                  <span className={s.sectionOrderLabel}>{TEMPLATE_SECTION_LABELS[sectionKey] || sectionKey}</span>
                  <div className={s.sectionOrderActions}>
                    <button
                      type="button"
                      className={s.sectionOrderButton}
                      onClick={() =>
                        onRowChange({
                          sectionOrder: moveSection(list, index, index - 1),
                        })
                      }
                      disabled={index === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={s.sectionOrderButton}
                      onClick={() =>
                        onRowChange({
                          sectionOrder: moveSection(list, index, index + 1),
                        })
                      }
                      disabled={index === list.length - 1}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </section>

        <section className={s.previewPane}>
          <div className={s.previewHeader}>
            <h3 className={s.previewTitle}>Live preview</h3>
            <p className={s.previewHint}>
              Демонстрационный документ {TYPE_LABELS[activeType] || activeType} с текущими настройками шаблона.
            </p>
          </div>

          <div className={s.previewFrame}>
            {hasPreviewData ? (
              <DocumentTemplateRenderer model={previewModel} settings={activeRow} />
            ) : (
              <div className={s.previewEmpty}>Недостаточно данных для preview</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
