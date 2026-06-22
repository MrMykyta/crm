import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  useCreateLocationMutation,
  useCreateWarehouseMutation,
  useListLocationsQuery,
  useListWarehousesQuery,
  useUpdateLocationMutation,
  useUpdateWarehouseMutation,
} from "../../../../../store/rtk/wmsDocumentsApi";
import {
  useGetCompanyWarehouseDocumentSettingsQuery,
  useUpdateCompanyWarehouseDocumentSettingsMutation,
} from "../../../../../store/rtk/companyWarehouseDocumentSettingsApi";
import { CheckboxField, SelectField, TextField } from "../../../../../components/ui/fields";
import WmsSettingsPanel from "../../../../wms/settings/WmsSettingsPanel";
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

export default function WarehouseWmsSettings() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("overview");
  const [warehouseForm, setWarehouseForm] = useState(emptyWarehouseForm());
  const [locationForm, setLocationForm] = useState(emptyLocationForm());
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

  const [createWarehouse, { isLoading: isCreatingWarehouse }] = useCreateWarehouseMutation();
  const [updateWarehouse, { isLoading: isUpdatingWarehouse }] = useUpdateWarehouseMutation();
  const [createLocation, { isLoading: isCreatingLocation }] = useCreateLocationMutation();
  const [updateLocation, { isLoading: isUpdatingLocation }] = useUpdateLocationMutation();
  const [updateSettings] = useUpdateCompanyWarehouseDocumentSettingsMutation();

  const warehouses = useMemo(() => (Array.isArray(warehousesData?.items) ? warehousesData.items : []), [warehousesData]);
  const locations = useMemo(() => (Array.isArray(locationsData?.items) ? locationsData.items : []), [locationsData]);
  const defaultWarehouseId = settings?.defaultWarehouseId || "";
  const activeWarehouses = warehouses.filter((row) => row?.isActive !== false);
  const warehouseById = useMemo(() => new Map(warehouses.map((row) => [row.id, row])), [warehouses]);

  const isBusy = isFetchingWarehouses || isFetchingLocations || isFetchingSettings;
  const warehouseSaving = isCreatingWarehouse || isUpdatingWarehouse;
  const locationSaving = isCreatingLocation || isUpdatingLocation;

  const clearFeedback = () => {
    setMessage("");
    setErrorText("");
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
            <TextField value={warehouseForm.code} onValueChange={(value) => setWarehouseForm((prev) => ({ ...prev, code: value }))} />
          </label>
          <label>
            <span>{t("companySettings.wms.fields.name", "Name")}</span>
            <TextField value={warehouseForm.name} onValueChange={(value) => setWarehouseForm((prev) => ({ ...prev, name: value }))} />
          </label>
          <CheckboxField
            className={s.checkboxRow}
            checked={warehouseForm.isActive}
            onValueChange={(checked) => setWarehouseForm((prev) => ({ ...prev, isActive: checked }))}
            label={t("companySettings.wms.fields.isActive", "Active")}
          />
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
            <SelectField
              value={locationForm.warehouseId}
              onValueChange={(value) => setLocationForm((prev) => ({ ...prev, warehouseId: value }))}
              options={[
                { value: "", label: t("companySettings.wms.placeholders.selectWarehouse", "Select warehouse") },
                ...warehouses.map((row) => ({ value: row.id, label: warehouseLabel(row) })),
              ]}
            />
          </label>
          <label>
            <span>{t("companySettings.wms.fields.code", "Code")}</span>
            <TextField value={locationForm.code} onValueChange={(value) => setLocationForm((prev) => ({ ...prev, code: value }))} />
          </label>
          <label>
            <span>{t("companySettings.wms.fields.type", "Type")}</span>
            <SelectField
              value={locationForm.type}
              onValueChange={(value) => setLocationForm((prev) => ({ ...prev, type: value }))}
              options={LOCATION_TYPES.map((type) => ({ value: type, label: type }))}
            />
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

  const renderSettings = () => <WmsSettingsPanel embedded />;

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
