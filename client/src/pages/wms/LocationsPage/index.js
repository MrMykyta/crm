import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AddButton from '../../../components/buttons/AddButton/AddButton';
import FilterToolbar from '../../../components/filters/FilterToolbar';
import ListPage from '../../../components/data/ListPage';
import Modal from '../../../components/Modal';
import { createWmsLocationsColumns } from '../../../components/data/ListPage/columnSchemas/wmsLocationsColumns';
import useAclPermissions from '../../../hooks/useAclPermissions';
import useGridPrefs from '../../../hooks/useGridPrefs';
import {
  useCreateLocationMutation,
  useListWarehousesQuery,
  useUpdateLocationMutation,
} from '../../../store/rtk/wmsDocumentsApi';
import s from '../WmsMasterDataPage.module.css';

const LOCATION_TYPES = ['inbound', 'pick', 'bulk', 'buffer', 'staging', 'outbound'];

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

export default function LocationsPage() {
  const { t } = useTranslation();
  const { can, isLoading, hasResolvedPermissions } = useAclPermissions();
  const canRead = can('wms:read');
  const canManage = can('wms:location:manage');
  const { data: warehousesData } = useListWarehousesQuery(
    { limit: 200, sort: 'code', dir: 'ASC' },
    { skip: !canRead }
  );
  const warehouses = useMemo(
    () => (Array.isArray(warehousesData?.items) ? warehousesData.items : []),
    [warehousesData]
  );
  const warehouseById = useMemo(() => new Map(warehouses.map((row) => [row.id, row])), [warehouses]);
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

  const columns = useMemo(
    () => createWmsLocationsColumns({ t, warehouseById }),
    [t, warehouseById]
  );
  const saving = creating || updating;
  const defaultWarehouseId = warehouses.find((row) => row?.isActive !== false)?.id || warehouses[0]?.id || '';

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
      setModalOpen(false);
      setForm(emptyForm(defaultWarehouseId));
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
      <ListPage
        source="wmsLocations"
        title={t('wms.locations.title', 'Locations')}
        columns={columns}
        defaultQuery={{ limit: 25, sort: 'code', dir: 'ASC' }}
        emptyStateText={t('wms.locations.empty', 'No locations found')}
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
                placeholder: t('wms.locations.search', 'Search by code...'),
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id
          ? t('wms.locations.actions.edit', 'Edit location')
          : t('wms.locations.actions.create', 'Create location')}
        footer={(
          <div className={s.modalFooter}>
            <Modal.Button onClick={() => setModalOpen(false)}>{t('common.cancel', 'Cancel')}</Modal.Button>
            <Modal.Button variant="primary" onClick={saveLocation} disabled={saving}>
              {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
            </Modal.Button>
          </div>
        )}
      >
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
          <label>
            <span>{t('wms.fields.type', 'Type')}</span>
            <select value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}>
              {LOCATION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
        </div>
        {errorText ? <div className={s.feedback}>{errorText}</div> : null}
      </Modal>
    </>
  );
}
