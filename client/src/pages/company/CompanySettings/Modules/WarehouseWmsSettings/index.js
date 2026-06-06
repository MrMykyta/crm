import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import {
  useCreateLocationMutation,
  useCreateWarehouseMutation,
  useDryRunCostingOpeningBalanceMutation,
  useGetCostingOpeningBalanceStatusQuery,
  useInitializeCostingOpeningBalanceMutation,
  useListLocationsQuery,
  useListWarehousesQuery,
  useUpdateLocationMutation,
  useUpdateWarehouseMutation,
} from "../../../../../store/rtk/wmsDocumentsApi";
import {
  useGetCompanyWarehouseDocumentSettingsQuery,
  useUpdateCompanyWarehouseDocumentSettingsMutation,
} from "../../../../../store/rtk/companyWarehouseDocumentSettingsApi";
import s from "./WarehouseWmsSettings.module.css";

const LOCATION_TYPES = ["inbound", "pick", "bulk", "buffer", "staging", "outbound"];

function asText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function getErrorText(error, fallback) {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || fallback;
}

function emptyWarehouseForm() {
  return { id: "", code: "", name: "", isActive: true };
}

function emptyLocationForm(defaultWarehouseId = "") {
  return { id: "", warehouseId: defaultWarehouseId, code: "", type: "bulk" };
}

function warehouseLabel(row) {
  return [row?.code, row?.name].filter(Boolean).join(" - ") || row?.id || "—";
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function formatNumber(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
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

export default function WarehouseWmsSettings() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("overview");
  const [warehouseForm, setWarehouseForm] = useState(emptyWarehouseForm());
  const [locationForm, setLocationForm] = useState(emptyLocationForm());
  const [costingForm, setCostingForm] = useState({ unitCostFallback: "", force: false, showAdvanced: false });
  const [dryRunResult, setDryRunResult] = useState(null);
  const [missingCosts, setMissingCosts] = useState([]);
  const [message, setMessage] = useState("");
  const [errorText, setErrorText] = useState("");

  const { data: warehousesData, isFetching: isFetchingWarehouses, refetch: refetchWarehouses } = useListWarehousesQuery({
    limit: 200,
    sort: "code",
    dir: "ASC",
  });
  const { data: locationsData, isFetching: isFetchingLocations, refetch: refetchLocations } = useListLocationsQuery({
    limit: 200,
    sort: "code",
    dir: "ASC",
  });
  const { data: settings, isFetching: isFetchingSettings, refetch: refetchSettings } = useGetCompanyWarehouseDocumentSettingsQuery();
  const {
    data: costingStatus,
    isFetching: isFetchingCostingStatus,
    refetch: refetchCostingStatus,
  } = useGetCostingOpeningBalanceStatusQuery();

  const [createWarehouse, { isLoading: isCreatingWarehouse }] = useCreateWarehouseMutation();
  const [updateWarehouse, { isLoading: isUpdatingWarehouse }] = useUpdateWarehouseMutation();
  const [createLocation, { isLoading: isCreatingLocation }] = useCreateLocationMutation();
  const [updateLocation, { isLoading: isUpdatingLocation }] = useUpdateLocationMutation();
  const [updateSettings, { isLoading: isSavingSettings }] = useUpdateCompanyWarehouseDocumentSettingsMutation();
  const [dryRunCostingOpeningBalance, { isLoading: isDryRunningCosting }] = useDryRunCostingOpeningBalanceMutation();
  const [initializeCostingOpeningBalance, { isLoading: isInitializingCosting }] = useInitializeCostingOpeningBalanceMutation();

  const warehouses = useMemo(() => (Array.isArray(warehousesData?.items) ? warehousesData.items : []), [warehousesData]);
  const locations = useMemo(() => (Array.isArray(locationsData?.items) ? locationsData.items : []), [locationsData]);
  const defaultWarehouseId = settings?.defaultWarehouseId || "";
  const activeWarehouses = warehouses.filter((row) => row?.isActive !== false);
  const warehouseById = useMemo(() => new Map(warehouses.map((row) => [row.id, row])), [warehouses]);

  const isBusy = isFetchingWarehouses || isFetchingLocations || isFetchingSettings || isFetchingCostingStatus;
  const warehouseSaving = isCreatingWarehouse || isUpdatingWarehouse;
  const locationSaving = isCreatingLocation || isUpdatingLocation;

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

  const saveWarehouse = async () => {
    clearFeedback();
    const code = asText(warehouseForm.code);
    const name = asText(warehouseForm.name);
    if (!code || !name) {
      setErrorText(t("companySettings.wms.validation.warehouseRequired", "Code and name are required."));
      return;
    }
    try {
      const payload = { code, name, isActive: Boolean(warehouseForm.isActive) };
      if (warehouseForm.id) {
        await updateWarehouse({ id: warehouseForm.id, ...payload }).unwrap();
      } else {
        await createWarehouse(payload).unwrap();
      }
      setWarehouseForm(emptyWarehouseForm());
      setMessage(t("companySettings.wms.messages.saved", "Saved."));
      await Promise.all([refetchWarehouses(), refetchSettings()]);
    } catch (error) {
      setErrorText(getErrorText(error, t("companySettings.wms.errors.saveWarehouse", "Failed to save warehouse.")));
    }
  };

  const editWarehouse = (row) => {
    clearFeedback();
    setWarehouseForm({
      id: row.id,
      code: row.code || "",
      name: row.name || "",
      isActive: row.isActive !== false,
    });
    setTab("warehouses");
  };

  const toggleWarehouseActive = async (row) => {
    clearFeedback();
    try {
      await updateWarehouse({
        id: row.id,
        code: row.code,
        name: row.name,
        isActive: row.isActive === false,
      }).unwrap();
      await Promise.all([refetchWarehouses(), refetchSettings()]);
    } catch (error) {
      setErrorText(getErrorText(error, t("companySettings.wms.errors.saveWarehouse", "Failed to save warehouse.")));
    }
  };

  const setDefaultWarehouse = async (id) => {
    clearFeedback();
    try {
      await updateSettings({ defaultWarehouseId: id || null }).unwrap();
      setMessage(t("companySettings.wms.messages.defaultSaved", "Default warehouse updated."));
      await refetchSettings();
    } catch (error) {
      setErrorText(getErrorText(error, t("companySettings.wms.errors.defaultWarehouse", "Failed to update default warehouse.")));
    }
  };

  const saveLocation = async () => {
    clearFeedback();
    const warehouseId = asText(locationForm.warehouseId);
    const code = asText(locationForm.code);
    const type = asText(locationForm.type);
    if (!warehouseId || !code || !type) {
      setErrorText(t("companySettings.wms.validation.locationRequired", "Warehouse, code and type are required."));
      return;
    }
    try {
      const payload = { warehouseId, code, type };
      if (locationForm.id) {
        await updateLocation({ id: locationForm.id, ...payload }).unwrap();
      } else {
        await createLocation(payload).unwrap();
      }
      setLocationForm(emptyLocationForm(defaultWarehouseId || activeWarehouses[0]?.id || ""));
      setMessage(t("companySettings.wms.messages.saved", "Saved."));
      await refetchLocations();
    } catch (error) {
      setErrorText(getErrorText(error, t("companySettings.wms.errors.saveLocation", "Failed to save location.")));
    }
  };

  const editLocation = (row) => {
    clearFeedback();
    setLocationForm({
      id: row.id,
      warehouseId: row.warehouseId || "",
      code: row.code || "",
      type: row.type || "bulk",
    });
    setTab("locations");
  };

  const renderOverview = () => {
    const defaultWarehouse = defaultWarehouseId ? warehouseById.get(defaultWarehouseId) : null;
    return (
      <div className={s.stack}>
        <section className={s.panel}>
          <h3>{t("companySettings.wms.overview.title", "Warehouse / WMS")}</h3>
          <p>{t("companySettings.wms.overview.description", "Warehouse setup for operational WMS documents, stock balances and inventory counts.")}</p>
          <div className={s.defaultBox}>
            <span>{t("companySettings.wms.defaultWarehouse", "Default warehouse")}</span>
            <strong>{defaultWarehouse ? warehouseLabel(defaultWarehouse) : t("common.none", "—")}</strong>
          </div>
        </section>
        <section className={s.counters}>
          <div><span>{t("companySettings.wms.counters.warehouses", "Warehouses")}</span><strong>{warehouses.length}</strong></div>
          <div><span>{t("companySettings.wms.counters.locations", "Locations")}</span><strong>{locations.length}</strong></div>
          <div><span>{t("companySettings.wms.counters.activeWarehouses", "Active warehouses")}</span><strong>{activeWarehouses.length}</strong></div>
        </section>
      </div>
    );
  };

  const renderWarehouses = () => (
    <div className={s.gridTwo}>
      <section className={s.panel}>
        <h3>{warehouseForm.id ? t("companySettings.wms.actions.editWarehouse", "Edit warehouse") : t("companySettings.wms.actions.addWarehouse", "Add warehouse")}</h3>
        <div className={s.formGrid}>
          <label>
            <span>{t("companySettings.wms.fields.code", "Code")}</span>
            <input value={warehouseForm.code} onChange={(event) => setWarehouseForm((prev) => ({ ...prev, code: event.target.value }))} />
          </label>
          <label>
            <span>{t("companySettings.wms.fields.name", "Name")}</span>
            <input value={warehouseForm.name} onChange={(event) => setWarehouseForm((prev) => ({ ...prev, name: event.target.value }))} />
          </label>
          <label className={s.checkboxRow}>
            <input type="checkbox" checked={warehouseForm.isActive} onChange={(event) => setWarehouseForm((prev) => ({ ...prev, isActive: event.target.checked }))} />
            <span>{t("companySettings.wms.fields.isActive", "Active")}</span>
          </label>
        </div>
        <div className={s.actions}>
          <button type="button" className={s.primaryButton} onClick={saveWarehouse} disabled={warehouseSaving}>
            {warehouseSaving ? t("common.saving", "Saving...") : t("common.save", "Save")}
          </button>
          <button type="button" className={s.button} onClick={() => setWarehouseForm(emptyWarehouseForm())}>
            {t("common.cancel", "Cancel")}
          </button>
        </div>
      </section>
      <section className={s.panel}>
        <h3>{t("companySettings.wms.tabs.warehouses", "Warehouses")}</h3>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>{t("companySettings.wms.fields.code", "Code")}</th>
                <th>{t("companySettings.wms.fields.name", "Name")}</th>
                <th>{t("companySettings.wms.fields.isActive", "Active")}</th>
                <th>{t("companySettings.wms.fields.isDefault", "Default")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {warehouses.map((row) => (
                <tr key={row.id}>
                  <td>{row.code}</td>
                  <td>{row.name}</td>
                  <td>{row.isActive === false ? t("common.no", "No") : t("common.yes", "Yes")}</td>
                  <td>{row.id === defaultWarehouseId ? t("common.yes", "Yes") : "—"}</td>
                  <td className={s.rowActions}>
                    <button type="button" onClick={() => editWarehouse(row)}>{t("common.edit", "Edit")}</button>
                    <button type="button" onClick={() => setDefaultWarehouse(row.id)} disabled={row.isActive === false || row.id === defaultWarehouseId}>
                      {t("companySettings.wms.actions.setDefault", "Set default")}
                    </button>
                    <button type="button" onClick={() => toggleWarehouseActive(row)}>
                      {row.isActive === false ? t("companySettings.wms.actions.activate", "Activate") : t("companySettings.wms.actions.deactivate", "Deactivate")}
                    </button>
                  </td>
                </tr>
              ))}
              {!warehouses.length ? <tr><td colSpan={5} className={s.empty}>{t("companySettings.wms.empty.warehouses", "No warehouses.")}</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );

  const renderLocations = () => (
    <div className={s.gridTwo}>
      <section className={s.panel}>
        <h3>{locationForm.id ? t("companySettings.wms.actions.editLocation", "Edit location") : t("companySettings.wms.actions.addLocation", "Add location")}</h3>
        <div className={s.formGrid}>
          <label>
            <span>{t("companySettings.wms.fields.warehouse", "Warehouse")}</span>
            <select value={locationForm.warehouseId} onChange={(event) => setLocationForm((prev) => ({ ...prev, warehouseId: event.target.value }))}>
              <option value="">{t("companySettings.wms.placeholders.selectWarehouse", "Select warehouse")}</option>
              {warehouses.map((row) => <option key={row.id} value={row.id}>{warehouseLabel(row)}</option>)}
            </select>
          </label>
          <label>
            <span>{t("companySettings.wms.fields.code", "Code")}</span>
            <input value={locationForm.code} onChange={(event) => setLocationForm((prev) => ({ ...prev, code: event.target.value }))} />
          </label>
          <label>
            <span>{t("companySettings.wms.fields.type", "Type")}</span>
            <select value={locationForm.type} onChange={(event) => setLocationForm((prev) => ({ ...prev, type: event.target.value }))}>
              {LOCATION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
        </div>
        <div className={s.actions}>
          <button type="button" className={s.primaryButton} onClick={saveLocation} disabled={locationSaving}>
            {locationSaving ? t("common.saving", "Saving...") : t("common.save", "Save")}
          </button>
          <button type="button" className={s.button} onClick={() => setLocationForm(emptyLocationForm(defaultWarehouseId || activeWarehouses[0]?.id || ""))}>
            {t("common.cancel", "Cancel")}
          </button>
        </div>
      </section>
      <section className={s.panel}>
        <h3>{t("companySettings.wms.tabs.locations", "Locations")}</h3>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>{t("companySettings.wms.fields.warehouse", "Warehouse")}</th>
                <th>{t("companySettings.wms.fields.code", "Code")}</th>
                <th>{t("companySettings.wms.fields.name", "Name")}</th>
                <th>{t("companySettings.wms.fields.type", "Type")}</th>
                <th>{t("companySettings.wms.fields.isActive", "Active")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {locations.map((row) => (
                <tr key={row.id}>
                  <td>{warehouseLabel(row.warehouse || warehouseById.get(row.warehouseId))}</td>
                  <td>{row.code}</td>
                  <td>{row.name || "—"}</td>
                  <td>{row.type}</td>
                  <td>{row.isActive === undefined ? "—" : row.isActive ? t("common.yes", "Yes") : t("common.no", "No")}</td>
                  <td className={s.rowActions}>
                    <button type="button" onClick={() => editLocation(row)}>{t("common.edit", "Edit")}</button>
                  </td>
                </tr>
              ))}
              {!locations.length ? <tr><td colSpan={6} className={s.empty}>{t("companySettings.wms.empty.locations", "No locations.")}</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );

  const renderSettings = () => {
    const initialized = Boolean(costingStatus?.initialized);
    const canInitialize = !initialized && !(missingCosts.length > 0 && !asText(costingForm.unitCostFallback));
    return (
      <div className={s.stack}>
        <section className={s.panel}>
          <h3>{t("companySettings.wms.tabs.settings", "Settings")}</h3>
          <div className={s.formGrid}>
            <label>
              <span>{t("companySettings.wms.defaultWarehouse", "Default warehouse")}</span>
              <select value={defaultWarehouseId} onChange={(event) => setDefaultWarehouse(event.target.value)} disabled={isSavingSettings}>
                <option value="">{t("common.none", "—")}</option>
                {activeWarehouses.map((row) => <option key={row.id} value={row.id}>{warehouseLabel(row)}</option>)}
              </select>
            </label>
            <div className={s.readonlyField}>
              <span>{t("companySettings.wms.settings.negativeStock", "Negative stock policy")}</span>
              <strong>{t("companySettings.wms.settings.hardMode", "Hard mode")}</strong>
            </div>
            <div className={s.readonlyField}>
              <span>{t("companySettings.wms.settings.costMethod", "Cost method")}</span>
              <strong>{costingStatus?.inventoryCostMethod || "FIFO"}</strong>
            </div>
          </div>
          <Link className={s.inlineLink} to="/main/company-settings/warehouse-docs">
            {t("companySettings.wms.settings.numberingLink", "PZ/WZ/MM/RW/PW numbering settings")}
          </Link>
        </section>

        <section className={s.panel}>
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
            <label className={s.checkboxRow}>
              <input
                type="checkbox"
                checked={costingForm.showAdvanced}
                onChange={(event) => setCostingForm((prev) => ({ ...prev, showAdvanced: event.target.checked, force: event.target.checked ? prev.force : false }))}
                disabled={initialized}
              />
              <span>{t("companySettings.wms.costing.showAdvanced", "Show advanced options")}</span>
            </label>
            {costingForm.showAdvanced ? (
              <label className={s.checkboxRow}>
                <input
                  type="checkbox"
                  checked={costingForm.force}
                  onChange={(event) => setCostingForm((prev) => ({ ...prev, force: event.target.checked }))}
                  disabled={initialized}
                />
                <span>{t("companySettings.wms.costing.force", "Force re-initialize if safe")}</span>
              </label>
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
                      <td>{row.productId || "—"}</td>
                      <td>{row.variantId || "—"}</td>
                      <td>{row.warehouseId || "—"}</td>
                      <td>{row.locationId || "—"}</td>
                      <td>{formatNumber(row.qtyOnHand, 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    );
  };

  const tabs = [
    { key: "overview", label: t("companySettings.wms.tabs.overview", "Overview") },
    { key: "warehouses", label: t("companySettings.wms.tabs.warehouses", "Warehouses") },
    { key: "locations", label: t("companySettings.wms.tabs.locations", "Locations") },
    { key: "settings", label: t("companySettings.wms.tabs.settings", "Settings") },
  ];

  return (
    <div className={s.wrap}>
      <header className={s.header}>
        <h2>{t("companySettings.wms.title", "Warehouse / WMS")}</h2>
        <p>{t("companySettings.wms.subtitle", "Configure warehouses, locations and default WMS behavior.")}</p>
      </header>

      <div className={s.tabs}>
        {tabs.map((item) => (
          <button key={item.key} type="button" className={tab === item.key ? s.activeTab : ""} onClick={() => setTab(item.key)}>
            {item.label}
          </button>
        ))}
      </div>

      {message ? <div className={s.success}>{message}</div> : null}
      {errorText ? <div className={s.error}>{errorText}</div> : null}
      {isBusy ? <div className={s.state}>{t("common.loading", "Loading...")}</div> : null}

      {tab === "overview" ? renderOverview() : null}
      {tab === "warehouses" ? renderWarehouses() : null}
      {tab === "locations" ? renderLocations() : null}
      {tab === "settings" ? renderSettings() : null}
    </div>
  );
}
