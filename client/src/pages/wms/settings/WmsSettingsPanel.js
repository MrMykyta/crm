import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { WmsErrorState, WmsLoadingState, WmsSurface } from "../../../components/wms/ui";
import {
  useDryRunCostingOpeningBalanceMutation,
  useGetCostingOpeningBalanceStatusQuery,
  useInitializeCostingOpeningBalanceMutation,
  useListWarehousesQuery,
} from "../../../store/rtk/wmsDocumentsApi";
import {
  useGetCompanyWarehouseDocumentSettingsQuery,
  useUpdateCompanyWarehouseDocumentSettingsMutation,
} from "../../../store/rtk/companyWarehouseDocumentSettingsApi";
import { CheckboxField, SelectField } from "../../../components/ui/fields";
import s from "./WmsSettingsPanel.module.css";

function asText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function getErrorText(error, fallback) {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || fallback;
}

function warehouseLabel(row) {
  return [row?.code, row?.name].filter(Boolean).join(" - ") || row?.id || "-";
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function formatNumber(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(num);
}

function getMissingCostsFromError(error) {
  return Array.isArray(error?.data?.details?.missingCosts)
    ? error.data.details.missingCosts
    : [];
}

function getWarehouseTypeLabel(typeKey, t) {
  const normalizedType = String(typeKey || "").trim().toLowerCase();
  return t(`companySettings.documents.types.${normalizedType}`, String(typeKey || "").trim().toUpperCase());
}

function buildInitialForm(settings) {
  return {
    defaultWarehouseId: settings?.defaultWarehouseId || "",
    warehouseDefaultDocumentType: settings?.warehouseDefaultDocumentType || "wz",
  };
}

export default function WmsSettingsPanel({ embedded = false }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(buildInitialForm());
  const [costingForm, setCostingForm] = useState({ unitCostFallback: "", force: false, showAdvanced: false });
  const [dryRunResult, setDryRunResult] = useState(null);
  const [missingCosts, setMissingCosts] = useState([]);
  const [message, setMessage] = useState("");
  const [errorText, setErrorText] = useState("");

  const {
    data: warehousesData,
    isFetching: isFetchingWarehouses,
    error: warehousesError,
    refetch: refetchWarehouses,
  } = useListWarehousesQuery({
    limit: 200,
    sort: "code",
    dir: "ASC",
  });
  const {
    data: settings,
    isFetching: isFetchingSettings,
    error: settingsError,
    refetch: refetchSettings,
  } = useGetCompanyWarehouseDocumentSettingsQuery();
  const {
    data: costingStatus,
    isFetching: isFetchingCostingStatus,
    error: costingError,
    refetch: refetchCostingStatus,
  } = useGetCostingOpeningBalanceStatusQuery();

  const [updateSettings, { isLoading: isSavingSettings }] = useUpdateCompanyWarehouseDocumentSettingsMutation();
  const [dryRunCostingOpeningBalance, { isLoading: isDryRunningCosting }] = useDryRunCostingOpeningBalanceMutation();
  const [initializeCostingOpeningBalance, { isLoading: isInitializingCosting }] = useInitializeCostingOpeningBalanceMutation();

  const warehouses = useMemo(
    () => (Array.isArray(warehousesData?.items) ? warehousesData.items : []),
    [warehousesData]
  );
  const activeWarehouses = useMemo(
    () => warehouses.filter((row) => row?.isActive !== false),
    [warehouses]
  );
  const enabledTypes = useMemo(
    () => (Array.isArray(settings?.warehouseDocumentTypes) ? settings.warehouseDocumentTypes : []).filter((row) => row.enabled),
    [settings]
  );
  const behaviorInitialForm = useMemo(() => buildInitialForm(settings), [settings]);
  const behaviorDirty =
    form.defaultWarehouseId !== behaviorInitialForm.defaultWarehouseId ||
    form.warehouseDefaultDocumentType !== behaviorInitialForm.warehouseDefaultDocumentType;
  const isInitialLoading =
    (isFetchingWarehouses && !warehousesData) ||
    (isFetchingSettings && !settings) ||
    (isFetchingCostingStatus && !costingStatus);
  const loadError = warehousesError || settingsError || costingError;
  const initialized = Boolean(costingStatus?.initialized);
  const canInitialize = !initialized && !(missingCosts.length > 0 && !asText(costingForm.unitCostFallback));

  useEffect(() => {
    if (settings) {
      setForm(buildInitialForm(settings));
    }
  }, [settings]);

  const clearFeedback = () => {
    setMessage("");
    setErrorText("");
  };

  const buildCostingPayload = () => {
    const fallbackText = asText(costingForm.unitCostFallback);
    const payload = {
      unitCostFallback: fallbackText ? Number(fallbackText) : null,
    };
    if (costingForm.force) payload.force = true;
    return payload;
  };

  const refreshAll = async () => {
    await Promise.all([refetchWarehouses(), refetchSettings(), refetchCostingStatus()]);
  };

  const saveBehaviorSettings = async () => {
    clearFeedback();
    try {
      await updateSettings({
        defaultWarehouseId: form.defaultWarehouseId || null,
        warehouseDefaultDocumentType: form.warehouseDefaultDocumentType,
      }).unwrap();
      setMessage(t("companySettings.wms.messages.saved", "Saved."));
      await refetchSettings();
    } catch (error) {
      setErrorText(getErrorText(error, t("companySettings.wms.errors.defaultWarehouse", "Failed to update default warehouse.")));
    }
  };

  const runCostingDryRun = async () => {
    clearFeedback();
    setDryRunResult(null);
    setMissingCosts([]);
    try {
      const result = await dryRunCostingOpeningBalance(buildCostingPayload()).unwrap();
      setDryRunResult(result);
      setMessage(t("companySettings.wms.costing.messages.dryRunOk", "Dry run completed."));
    } catch (error) {
      const rows = getMissingCostsFromError(error);
      if (error?.data?.code === "OPENING_COST_MISSING" && rows.length) {
        setMissingCosts(rows);
        setErrorText(t("companySettings.wms.costing.errors.missingCosts", "Some stock rows do not have a unit cost. Provide a fallback cost or update product costs."));
        return;
      }
      setErrorText(getErrorText(error, t("companySettings.wms.costing.errors.dryRun", "Failed to run opening balance check.")));
    }
  };

  const initializeCosting = async () => {
    clearFeedback();
    const hasMissingWithoutFallback = missingCosts.length > 0 && !asText(costingForm.unitCostFallback);
    if (hasMissingWithoutFallback) {
      setErrorText(t("companySettings.wms.costing.errors.fallbackRequired", "Provide a fallback unit cost before initialization."));
      return;
    }
    try {
      const result = await initializeCostingOpeningBalance(buildCostingPayload()).unwrap();
      setDryRunResult(result);
      setMissingCosts([]);
      setMessage(t("companySettings.wms.costing.messages.initialized", "FIFO opening balance initialized."));
      await Promise.all([refetchCostingStatus(), refetchSettings()]);
    } catch (error) {
      const rows = getMissingCostsFromError(error);
      if (error?.data?.code === "OPENING_COST_MISSING" && rows.length) {
        setMissingCosts(rows);
        setErrorText(t("companySettings.wms.costing.errors.missingCosts", "Some stock rows do not have a unit cost. Provide a fallback cost or update product costs."));
        return;
      }
      setErrorText(getErrorText(error, t("companySettings.wms.costing.errors.initialize", "Failed to initialize FIFO opening balance.")));
    }
  };

  if (isInitialLoading) {
    return (
      <div className={embedded ? s.embedded : s.wrap}>
        <WmsLoadingState title={t("common.loading", "Loading...")} />
      </div>
    );
  }

  if (loadError && !settings) {
    return (
      <div className={embedded ? s.embedded : s.wrap}>
        <WmsErrorState
          title={t("companySettings.documents.warehouse.errors.loadTitle", "Failed to load warehouse document settings")}
          description={getErrorText(loadError, t("companySettings.documents.common.loadErrorBody", "Could not load settings."))}
          retryLabel={t("companySettings.documents.common.retry", "Retry")}
          onRetry={refreshAll}
        />
      </div>
    );
  }

  return (
    <div className={embedded ? s.embedded : s.wrap} data-testid="wms-settings-panel">
      <header className={s.header}>
        <span className={s.eyebrow}>{t("wms.setupSettings.eyebrow", "Company-wide policy")}</span>
        <div>
          <h2>{t("wms.setupSettings.title", "Warehouse Settings")}</h2>
          <p>{t("wms.setupSettings.nativeDescription", "Configure the warehouse behavior used by WMS documents and stock costing.")}</p>
        </div>
      </header>

      {message ? <div className={s.success}>{message}</div> : null}
      {errorText ? <div className={s.error}>{errorText}</div> : null}

      <WmsSurface as="section" variant="panel" padding="md" className={s.section}>
        <div className={s.sectionHeader}>
          <div>
            <h3>{t("wms.setupSettings.groups.behavior", "Warehouse behavior")}</h3>
            <p>{t("wms.setupSettings.groupDescriptions.behavior", "Defaults used by WMS document creation flows.")}</p>
          </div>
        </div>
        <div className={s.formGrid}>
          <label>
            <span>{t("companySettings.wms.defaultWarehouse", "Default warehouse")}</span>
            <SelectField
              value={form.defaultWarehouseId}
              onValueChange={(value) => setForm((prev) => ({ ...prev, defaultWarehouseId: value }))}
              disabled={isSavingSettings}
              options={[
                { value: "", label: t("common.none", "-") },
                ...activeWarehouses.map((row) => ({
                  value: row.id,
                  label: warehouseLabel(row),
                })),
              ]}
            />
          </label>
          <label>
            <span>{t("companySettings.documents.warehouse.fields.defaultType", "Default warehouse document type")}</span>
            <SelectField
              value={form.warehouseDefaultDocumentType}
              onValueChange={(value) => setForm((prev) => ({ ...prev, warehouseDefaultDocumentType: value }))}
              disabled={isSavingSettings || !enabledTypes.length}
              options={enabledTypes.map((row) => ({
                value: row.typeKey,
                label: getWarehouseTypeLabel(row.typeKey, t),
              }))}
            />
          </label>
          <div className={s.readonlyField}>
            <span>{t("companySettings.wms.settings.costMethod", "Cost method")}</span>
            <strong>{costingStatus?.inventoryCostMethod || "FIFO"}</strong>
            <small>{t("wms.setupSettings.costMethodReadonly", "Configured by the current costing engine.")}</small>
          </div>
        </div>
        <div className={s.actions}>
          <button type="button" className={s.button} onClick={refreshAll} disabled={isSavingSettings}>
            {t("companySettings.documents.common.refresh", "Refresh")}
          </button>
          <button type="button" className={s.primaryButton} onClick={saveBehaviorSettings} disabled={isSavingSettings || !behaviorDirty}>
            {isSavingSettings ? t("common.saving", "Saving...") : t("companySettings.documents.common.saveSettings", "Save settings")}
          </button>
        </div>
      </WmsSurface>

      <WmsSurface as="section" variant="panel" padding="md" className={s.section}>
        <div className={s.sectionHeader}>
          <div>
            <h3>{t("companySettings.wms.costing.title", "Wycena / FIFO")}</h3>
            <p>{t("companySettings.wms.costing.description", "Initialize FIFO cost layers for existing stock before WZ/RW/MM outgoing operations.")}</p>
          </div>
          <span className={`${s.statusPill} ${initialized ? s.statusOk : s.statusWarn}`}>
            {initialized
              ? t("companySettings.wms.costing.initialized", "Initialized")
              : t("companySettings.wms.costing.notInitialized", "Not initialized")}
          </span>
        </div>

        {!initialized ? (
          <div className={s.warningBox}>
            {t("companySettings.wms.costing.warning", "FIFO costing is not initialized. Existing stock without cost layers will block WZ/RW/MM outgoing operations.")}
          </div>
        ) : null}

        <div className={s.counters}>
          <div>
            <span>{t("companySettings.wms.costing.totalItems", "Total stock rows")}</span>
            <strong>{formatNumber(costingStatus?.totalItems, 0)}</strong>
          </div>
          <div>
            <span>{t("companySettings.wms.costing.coveredItems", "Covered")}</span>
            <strong>{formatNumber(costingStatus?.coveredItems, 0)}</strong>
          </div>
          <div>
            <span>{t("companySettings.wms.costing.gapItems", "Gaps")}</span>
            <strong>{formatNumber(costingStatus?.gapItems, 0)}</strong>
          </div>
        </div>

        <div className={s.formGrid}>
          <div className={s.readonlyField}>
            <span>{t("companySettings.wms.costing.initializedAt", "Initialized at")}</span>
            <strong>{formatDateTime(costingStatus?.initializedAt)}</strong>
          </div>
          <label>
            <span>{t("companySettings.wms.costing.unitCostFallback", "Fallback unit cost")}</span>
            <input
              type="number"
              min="0"
              step="0.0001"
              value={costingForm.unitCostFallback}
              onChange={(event) => setCostingForm((prev) => ({ ...prev, unitCostFallback: event.target.value }))}
              placeholder={t("companySettings.wms.costing.unitCostFallbackPlaceholder", "Optional, e.g. 10.50")}
              disabled={initialized}
            />
          </label>
          <CheckboxField
            checked={costingForm.showAdvanced}
            onValueChange={(checked) => setCostingForm((prev) => ({ ...prev, showAdvanced: checked, force: checked ? prev.force : false }))}
            disabled={initialized}
            label={t("companySettings.wms.costing.showAdvanced", "Show advanced options")}
          />
          {costingForm.showAdvanced ? (
            <CheckboxField
              checked={costingForm.force}
              onValueChange={(checked) => setCostingForm((prev) => ({ ...prev, force: checked }))}
              disabled={initialized}
              label={t("companySettings.wms.costing.force", "Force re-initialize if safe")}
            />
          ) : null}
        </div>

        <div className={s.actions}>
          <button
            type="button"
            className={s.button}
            onClick={runCostingDryRun}
            disabled={initialized || isDryRunningCosting || isInitializingCosting}
          >
            {isDryRunningCosting
              ? t("common.loading", "Loading...")
              : t("companySettings.wms.costing.actions.dryRun", "Dry run")}
          </button>
          <button
            type="button"
            className={s.primaryButton}
            onClick={initializeCosting}
            disabled={!canInitialize || isDryRunningCosting || isInitializingCosting}
          >
            {isInitializingCosting
              ? t("common.saving", "Saving...")
              : t("companySettings.wms.costing.actions.initialize", "Initialize")}
          </button>
        </div>

        {dryRunResult ? (
          <div className={s.resultBox}>
            <strong>{dryRunResult.dryRun ? t("companySettings.wms.costing.dryRunResult", "Dry-run result") : t("companySettings.wms.costing.initializeResult", "Initialization result")}</strong>
            <span>{t("companySettings.wms.costing.layers", "Layers")}: {formatNumber(dryRunResult.itemsCount, 0)}</span>
            <span>{t("companySettings.wms.costing.totalQty", "Total qty")}: {formatNumber(dryRunResult.totalQty, 4)}</span>
            <span>{t("companySettings.wms.costing.totalValue", "Total value")}: {formatNumber(dryRunResult.totalValue, 2)}</span>
          </div>
        ) : null}

        {missingCosts.length ? (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t("companySettings.wms.costing.columns.product", "Product")}</th>
                  <th>{t("companySettings.wms.costing.columns.variant", "Variant")}</th>
                  <th>{t("companySettings.wms.costing.columns.warehouse", "Warehouse")}</th>
                  <th>{t("companySettings.wms.costing.columns.location", "Location")}</th>
                  <th>{t("companySettings.wms.costing.columns.qty", "Qty")}</th>
                </tr>
              </thead>
              <tbody>
                {missingCosts.map((row) => (
                  <tr key={`${row.warehouseId || "warehouse"}-${row.locationId || "location"}-${row.productId || "product"}-${row.variantId || "variant"}`}>
                    <td>{row.productId || "-"}</td>
                    <td>{row.variantId || "-"}</td>
                    <td>{row.warehouseId || "-"}</td>
                    <td>{row.locationId || "-"}</td>
                    <td>{formatNumber(row.qtyOnHand, 4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </WmsSurface>

      <WmsSurface as="section" variant="soft" padding="md" className={s.numbering}>
        <div>
          <h3>{t("wms.setupSettings.categories.documentNumbering", "Document numbering")}</h3>
          <p>{t("wms.setupSettings.categoryDescriptions.documentNumbering", "Numbering patterns for warehouse documents.")}</p>
        </div>
        <Link className={s.inlineLink} to="/main/company-settings/warehouse-docs">
          {t("companySettings.wms.settings.numberingLink", "PZ/WZ/MM/RW/PW numbering settings")}
        </Link>
      </WmsSurface>
    </div>
  );
}
