import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AddButton from '../../../components/buttons/AddButton/AddButton';
import FilterToolbar from '../../../components/filters/FilterToolbar';
import ListPage from '../../../components/data/ListPage';
import { WmsEmptyState } from '../../../components/wms/ui';
import { createWmsLocationsColumns } from '../../../components/data/ListPage/columnSchemas/wmsLocationsColumns';
import useAclPermissions from '../../../hooks/useAclPermissions';
import useGridPrefs from '../../../hooks/useGridPrefs';
import {
  useCreateLocationMutation,
  useListLocationsQuery,
  useListWarehousesQuery,
  useUpdateLocationMutation,
} from '../../../store/rtk/wmsDocumentsApi';
import SetupSidePanel from '../SetupSidePanel';
import s from '../WmsMasterDataPage.module.css';

const LOCATION_TYPES = ['inbound', 'pick', 'bulk', 'buffer', 'staging', 'outbound'];

const LOCATION_QUERY_DEFAULTS = { page: 1, limit: 25, sort: 'code', dir: 'ASC', search: '', warehouseId: '' };

function emptyForm(defaultWarehouseId = '') {
  return { id: '', warehouseId: defaultWarehouseId, code: '', type: 'bulk' };
}

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function getErrorText(error, fallback) {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || fallback;
}

function warehouseLabel(row) {
  return [row?.code, row?.name].filter(Boolean).join(' - ') || row?.id || '—';
}

function titleCase(value) {
  const text = asText(value);
  return text ? `${text.slice(0, 1).toUpperCase()}${text.slice(1)}` : '';
}

function normalizeLocationQuery(value = {}) {
  return {
    ...LOCATION_QUERY_DEFAULTS,
    ...value,
    page: Math.max(1, Number(value.page || LOCATION_QUERY_DEFAULTS.page) || 1),
    limit: Math.max(1, Number(value.limit || LOCATION_QUERY_DEFAULTS.limit) || 25),
    search: asText(value.search),
    warehouseId: asText(value.warehouseId),
    sort: asText(value.sort) || LOCATION_QUERY_DEFAULTS.sort,
    dir: value.dir === 'DESC' ? 'DESC' : 'ASC',
  };
}

function getRowWarehouseId(row) {
  return asText(row?.warehouseId || row?.warehouse?.id);
}

function isLocationActive(row) {
  return row?.isActive !== false;
}

export default function LocationsPage() {
  const { t } = useTranslation();
  const { can, isLoading, hasResolvedPermissions } = useAclPermissions();
  const canRead = can('wms:read');
  const canManage = can('wms:location:manage');
  const { data: warehousesData } = useListWarehousesQuery(
    { limit: 200, sort: 'code', dir: 'ASC' },
    { skip: !canRead }
  );
  const {
    data: locationsData,
    isFetching: locationsFetching,
    error: locationsError,
    refetch: refetchLocations,
  } = useListLocationsQuery(
    { limit: 1000, sort: 'code', dir: 'ASC' },
    { skip: !canRead }
  );
  const warehouses = useMemo(
    () => (Array.isArray(warehousesData?.items) ? warehousesData.items : []),
    [warehousesData]
  );
  const allLocations = useMemo(
    () => (Array.isArray(locationsData) ? locationsData : (locationsData?.items || [])),
    [locationsData]
  );
  const warehouseById = useMemo(() => new Map(warehouses.map((row) => [row.id, row])), [warehouses]);
  const [locationsQuery, setLocationsQuery] = useState(LOCATION_QUERY_DEFAULTS);
  const [form, setForm] = useState(emptyForm());
  const [modalOpen, setModalOpen] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [createLocation, { isLoading: creating }] = useCreateLocationMutation();
  const [updateLocation, { isLoading: updating }] = useUpdateLocationMutation();

  const {
    colWidths,
    colOrder,
    colVisibility,
    savedViews,
    activeViewId,
    onColumnResize,
    onColumnOrderChange,
    onColumnVisibilityChange,
    onSavedViewsChange,
    onActiveViewChange,
    resetGridPrefs,
  } = useGridPrefs('wms.locations');

  const getTypeLabel = useMemo(() => (
    (type) => {
      const key = asText(type);
      return key ? t(`wms.locations.types.${key}`, titleCase(key)) : '—';
    }
  ), [t]);
  const getTypeDescription = useMemo(() => (
    (type) => {
      const key = asText(type);
      return key ? t(`wms.locations.typeDescriptions.${key}`, '') : '';
    }
  ), [t]);
  const columns = useMemo(
    () => createWmsLocationsColumns({ t, warehouseById, typeLabel: getTypeLabel }),
    [t, warehouseById, getTypeLabel]
  );
  const saving = creating || updating;
  const selectedWarehouse = warehouseById.get(locationsQuery.warehouseId) || null;
  const defaultWarehouseId = locationsQuery.warehouseId
    || warehouses.find((row) => row?.isActive !== false)?.id
    || warehouses[0]?.id
    || '';

  const updateLocationsQuery = (nextQuery) => {
    setLocationsQuery((prev) => {
      const next = normalizeLocationQuery(nextQuery);
      const filtersChanged = prev.search !== next.search || prev.warehouseId !== next.warehouseId;
      return filtersChanged ? { ...next, page: 1 } : next;
    });
  };

  const openCreate = () => {
    setForm(emptyForm(defaultWarehouseId));
    setErrorText('');
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setForm({
      id: row?.id || '',
      warehouseId: row?.warehouseId || '',
      code: row?.code || '',
      type: row?.type || 'bulk',
    });
    setErrorText('');
    setModalOpen(true);
  };

  const saveLocation = async () => {
    const warehouseId = asText(form.warehouseId);
    const code = asText(form.code);
    const type = asText(form.type);
    if (!warehouseId || !code || !type) {
      setErrorText(t('wms.locations.validation.required', 'Warehouse, code and type are required.'));
      return;
    }
    try {
      const payload = { warehouseId, code, type };
      if (form.id) await updateLocation({ id: form.id, ...payload }).unwrap();
      else await createLocation(payload).unwrap();
      refetchLocations?.();
      setModalOpen(false);
      setForm(emptyForm(defaultWarehouseId));
      setErrorText('');
    } catch (error) {
      setErrorText(getErrorText(error, t('wms.locations.errors.save', 'Failed to save location.')));
    }
  };

  const toggleActive = async (row) => {
    if (!row?.id || !Object.prototype.hasOwnProperty.call(row, 'isActive')) return;
    try {
      await updateLocation({
        id: row.id,
        warehouseId: row.warehouseId,
        code: row.code,
        type: row.type,
        isActive: row.isActive === false,
      }).unwrap();
    } catch (error) {
      setErrorText(getErrorText(error, t('wms.locations.errors.save', 'Failed to save location.')));
      openEdit(row);
    }
  };

  const warehouseOptions = useMemo(() => ([
    { value: '', label: t('common.all', 'All') },
    ...warehouses.map((row) => ({ value: row.id, label: warehouseLabel(row) })),
  ]), [t, warehouses]);

  const filteredLocations = useMemo(() => {
    const search = locationsQuery.search.toLowerCase();
    const selectedWarehouseId = locationsQuery.warehouseId;

    return allLocations.filter((row) => {
      const rowWarehouseId = getRowWarehouseId(row);
      if (selectedWarehouseId && rowWarehouseId !== selectedWarehouseId) return false;
      if (!search) return true;

      const warehouse = row?.warehouse || warehouseById.get(rowWarehouseId);
      const haystack = [
        row?.code,
        row?.type,
        getTypeLabel(row?.type),
        warehouseLabel(warehouse || { id: rowWarehouseId }),
      ].map((value) => asText(value).toLowerCase()).join(' ');

      return haystack.includes(search);
    });
  }, [allLocations, getTypeLabel, locationsQuery.search, locationsQuery.warehouseId, warehouseById]);

  const sortedLocations = useMemo(() => {
    const multiplier = locationsQuery.dir === 'DESC' ? -1 : 1;
    const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
    const getSortValue = (row) => {
      if (locationsQuery.sort === 'warehouseId') {
        return warehouseLabel(row?.warehouse || warehouseById.get(getRowWarehouseId(row)));
      }
      if (locationsQuery.sort === 'type') return getTypeLabel(row?.type);
      if (locationsQuery.sort === 'isActive') return isLocationActive(row) ? 'active' : 'inactive';
      return asText(row?.[locationsQuery.sort] ?? row?.code);
    };
    return [...filteredLocations].sort((a, b) => multiplier * collator.compare(getSortValue(a), getSortValue(b)));
  }, [filteredLocations, getTypeLabel, locationsQuery.dir, locationsQuery.sort, warehouseById]);

  const pagedLocations = useMemo(() => {
    const start = (locationsQuery.page - 1) * locationsQuery.limit;
    return sortedLocations.slice(start, start + locationsQuery.limit);
  }, [locationsQuery.limit, locationsQuery.page, sortedLocations]);

  const contextLocations = useMemo(() => (
    locationsQuery.warehouseId
      ? allLocations.filter((row) => getRowWarehouseId(row) === locationsQuery.warehouseId)
      : allLocations
  ), [allLocations, locationsQuery.warehouseId]);

  const locationSummary = useMemo(() => {
    const total = contextLocations.length;
    const inactive = contextLocations.filter((row) => row?.isActive === false).length;
    return {
      total,
      active: total - inactive,
      inactive,
      filtered: filteredLocations.length,
    };
  }, [contextLocations, filteredLocations.length]);

  const closeEditor = () => {
    if (saving) return;
    setModalOpen(false);
    setErrorText('');
  };

  const editorTitle = form.id
    ? t('wms.locations.actions.edit', 'Edit location')
    : t('wms.locations.actions.create', 'Create location');

  const formContent = (
    <>
      <div className={s.formGrid}>
        <label>
          <span>{t('wms.fields.warehouse', 'Warehouse')}</span>
          <select
            value={form.warehouseId}
            onChange={(event) => setForm((prev) => ({ ...prev, warehouseId: event.target.value }))}
          >
            <option value="">{t('wms.locations.placeholders.selectWarehouse', 'Select warehouse')}</option>
            {warehouses.map((row) => (
              <option key={row.id} value={row.id}>{warehouseLabel(row)}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{t('wms.fields.code', 'Code')}</span>
          <input value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} />
        </label>
        <label className={s.fieldStack}>
          <span>{t('wms.fields.type', 'Type')}</span>
          <select value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}>
            {LOCATION_TYPES.map((type) => (
              <option key={type} value={type}>
                {getTypeLabel(type)}
              </option>
            ))}
          </select>
          <span className={s.fieldHint}>
            {getTypeDescription(form.type)
              || t('wms.locations.typeHelper', 'Used for WMS flows and location-level stock visibility.')}
          </span>
        </label>
      </div>
      {errorText ? <div className={s.feedback}>{errorText}</div> : null}
    </>
  );

  if (isLoading && !hasResolvedPermissions) {
    return <div className={s.forbidden}>{t('common.loading', 'Loading...')}</div>;
  }

  if (!canRead) {
    return (
      <div className={s.forbidden}>
        <h2>{t('common.noPermission', 'No permission')}</h2>
        <p>{t('wms.locations.noReadPermission', 'You do not have permission to view locations.')}</p>
      </div>
    );
  }

  return (
    <>
      <div className={[
        s.setupCrudLayout,
        canManage ? '' : s.setupCrudLayoutNoPanel,
      ].filter(Boolean).join(' ')}
      >
        <div className={s.setupListPane}>
          <section className={s.locationContextBar} aria-label={t('wms.locations.contextLabel', 'Location context')}>
            <div className={s.locationContextMain}>
              <span>{t('wms.locations.currentWarehouse', 'Current warehouse')}</span>
              <strong>{selectedWarehouse ? warehouseLabel(selectedWarehouse) : t('wms.locations.allWarehouses', 'All warehouses')}</strong>
              <p>
                {selectedWarehouse
                  ? t('wms.locations.contextSelected', '{{count}} locations in this warehouse.', { count: locationSummary.total })
                  : t('wms.locations.contextAll', '{{count}} locations across all warehouses.', { count: locationSummary.total })}
              </p>
            </div>
            <div className={s.locationSummaryGrid}>
              <div>
                <span>{t('wms.locations.summary.locations', 'Locations')}</span>
                <strong>{locationSummary.total}</strong>
              </div>
              <div>
                <span>{t('wms.locations.summary.active', 'Active')}</span>
                <strong>{locationSummary.active}</strong>
              </div>
              <div>
                <span>{t('wms.locations.summary.inactive', 'Inactive')}</span>
                <strong>{locationSummary.inactive}</strong>
              </div>
              <div>
                <span>{t('wms.locations.summary.filtered', 'Visible')}</span>
                <strong>{locationSummary.filtered}</strong>
              </div>
            </div>
          </section>
          <ListPage
            source="wmsLocations"
            externalData={pagedLocations}
            externalMeta={{
              total: filteredLocations.length,
              page: locationsQuery.page,
              limit: locationsQuery.limit,
            }}
            externalLoading={locationsFetching}
            externalError={locationsError}
            onExternalRefetch={refetchLocations}
            query={locationsQuery}
            onQueryChange={updateLocationsQuery}
            title={t('wms.locations.title', 'Locations')}
            columns={columns}
            defaultQuery={LOCATION_QUERY_DEFAULTS}
            emptyStateText={t('wms.locations.empty', 'No locations found')}
            emptyStateContent={(
              <WmsEmptyState
                compact
                title={locationsQuery.warehouseId
                  ? t('wms.locations.emptyForWarehouse', 'No locations for selected warehouse')
                  : t('wms.locations.empty', 'No locations found')}
                description={locationsQuery.search
                  ? t('wms.locations.emptySearch', 'No locations match the current search or filters.')
                  : t('wms.locations.emptyDescription', 'Create a location to start using location-level warehouse flows.')}
                action={canManage ? (
                  <button type="button" className={s.primaryButton} onClick={openCreate}>
                    {t('wms.locations.actions.create', 'Create location')}
                  </button>
                ) : null}
              />
            )}
            actions={canManage ? (
              <AddButton onClick={openCreate}>{t('wms.locations.actions.create', 'Create location')}</AddButton>
            ) : null}
            rowActions={canManage ? (row) => (
              <div className={s.rowActions}>
                <button type="button" className={s.actionButton} onClick={() => openEdit(row)}>
                  {t('common.edit', 'Edit')}
                </button>
                {Object.prototype.hasOwnProperty.call(row || {}, 'isActive') ? (
                  <button type="button" className={s.actionButton} onClick={() => toggleActive(row)}>
                    {row?.isActive === false
                      ? t('wms.actions.activate', 'Activate')
                      : t('wms.actions.deactivate', 'Deactivate')}
                  </button>
                ) : null}
              </div>
            ) : null}
            columnWidths={colWidths}
            onColumnResize={onColumnResize}
            columnOrder={colOrder}
            onColumnOrderChange={onColumnOrderChange}
            columnVisibility={colVisibility}
            onColumnVisibilityChange={onColumnVisibilityChange}
            savedViews={savedViews}
            activeViewId={activeViewId}
            onSavedViewsChange={onSavedViewsChange}
            onActiveViewChange={onActiveViewChange}
            onResetColumns={resetGridPrefs}
            ToolbarComponent={(props) => (
              <FilterToolbar
                {...props}
                controls={[
                  {
                    type: 'search',
                    key: 'search',
                    placeholder: t('wms.locations.search', 'Search by code, warehouse or type...'),
                    debounce: 350,
                  },
                  {
                    type: 'select',
                    key: 'warehouseId',
                    label: t('wms.fields.warehouse', 'Warehouse'),
                    options: warehouseOptions,
                  },
                ]}
              />
            )}
          />
        </div>

        {canManage ? (
          <SetupSidePanel
            open={modalOpen}
            title={editorTitle}
            subtitle={form.id
              ? t('wms.locations.drawer.editSubtitle', 'Update the warehouse, code or type for this location.')
              : t('wms.locations.drawer.createSubtitle', 'Create a warehouse location without leaving the setup list.')}
            onCancel={closeEditor}
            onSave={saveLocation}
            saving={saving}
            saveLabel={t('common.save', 'Save')}
            savingLabel={t('common.saving', 'Saving...')}
            cancelLabel={t('common.cancel', 'Cancel')}
            emptyTitle={t('wms.locations.drawer.emptyTitle', 'Location editor')}
            emptyText={t('wms.locations.drawer.emptyText', 'Create a location or edit a row without leaving the setup list.')}
          >
            {formContent}
          </SetupSidePanel>
        ) : null}
      </div>

    </>
  );
}
