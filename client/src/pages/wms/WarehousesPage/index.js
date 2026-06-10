import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AddButton from '../../../components/buttons/AddButton/AddButton';
import FilterToolbar from '../../../components/filters/FilterToolbar';
import ListPage from '../../../components/data/ListPage';
import Modal from '../../../components/Modal';
import { createWmsWarehousesColumns } from '../../../components/data/ListPage/columnSchemas/wmsWarehousesColumns';
import useAclPermissions from '../../../hooks/useAclPermissions';
import useGridPrefs from '../../../hooks/useGridPrefs';
import {
  useCreateWarehouseMutation,
  useUpdateWarehouseMutation,
} from '../../../store/rtk/wmsDocumentsApi';
import s from '../WmsMasterDataPage.module.css';

function emptyForm() {
  return { id: '', code: '', name: '', isActive: true };
}

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function getErrorText(error, fallback) {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || fallback;
}

export default function WarehousesPage() {
  const { t } = useTranslation();
  const { can, isLoading, hasResolvedPermissions } = useAclPermissions();
  const canRead = can('wms:read');
  const canManage = can('wms:warehouse:manage');
  const [form, setForm] = useState(emptyForm());
  const [modalOpen, setModalOpen] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [createWarehouse, { isLoading: creating }] = useCreateWarehouseMutation();
  const [updateWarehouse, { isLoading: updating }] = useUpdateWarehouseMutation();

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
  } = useGridPrefs('wms.warehouses');

  const columns = useMemo(() => createWmsWarehousesColumns({ t }), [t]);
  const saving = creating || updating;

  const openCreate = () => {
    setForm(emptyForm());
    setErrorText('');
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setForm({
      id: row?.id || '',
      code: row?.code || '',
      name: row?.name || '',
      isActive: row?.isActive !== false,
    });
    setErrorText('');
    setModalOpen(true);
  };

  const saveWarehouse = async () => {
    const code = asText(form.code);
    const name = asText(form.name);
    if (!code || !name) {
      setErrorText(t('wms.warehouses.validation.required', 'Code and name are required.'));
      return;
    }
    try {
      const payload = { code, name, isActive: Boolean(form.isActive) };
      if (form.id) await updateWarehouse({ id: form.id, ...payload }).unwrap();
      else await createWarehouse(payload).unwrap();
      setModalOpen(false);
      setForm(emptyForm());
    } catch (error) {
      setErrorText(getErrorText(error, t('wms.warehouses.errors.save', 'Failed to save warehouse.')));
    }
  };

  const toggleActive = async (row) => {
    if (!row?.id) return;
    try {
      await updateWarehouse({
        id: row.id,
        code: row.code,
        name: row.name,
        isActive: row.isActive === false,
      }).unwrap();
    } catch (error) {
      setErrorText(getErrorText(error, t('wms.warehouses.errors.save', 'Failed to save warehouse.')));
      setForm({
        id: row?.id || '',
        code: row?.code || '',
        name: row?.name || '',
        isActive: row?.isActive !== false,
      });
      setModalOpen(true);
    }
  };

  if (isLoading && !hasResolvedPermissions) {
    return <div className={s.forbidden}>{t('common.loading', 'Loading...')}</div>;
  }

  if (!canRead) {
    return (
      <div className={s.forbidden}>
        <h2>{t('common.noPermission', 'No permission')}</h2>
        <p>{t('wms.warehouses.noReadPermission', 'You do not have permission to view warehouses.')}</p>
      </div>
    );
  }

  return (
    <>
      <ListPage
        source="wmsWarehouses"
        title={t('wms.warehouses.title', 'Warehouses')}
        columns={columns}
        defaultQuery={{ limit: 25, sort: 'code', dir: 'ASC' }}
        emptyStateText={t('wms.warehouses.empty', 'No warehouses found')}
        actions={canManage ? (
          <AddButton onClick={openCreate}>{t('wms.warehouses.actions.create', 'Create warehouse')}</AddButton>
        ) : null}
        rowActions={canManage ? (row) => (
          <div className={s.rowActions}>
            <button type="button" className={s.actionButton} onClick={() => openEdit(row)}>
              {t('common.edit', 'Edit')}
            </button>
            <button type="button" className={s.actionButton} onClick={() => toggleActive(row)}>
              {row?.isActive === false
                ? t('wms.actions.activate', 'Activate')
                : t('wms.actions.deactivate', 'Deactivate')}
            </button>
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
            controls={[{
              type: 'search',
              key: 'search',
              placeholder: t('wms.warehouses.search', 'Search by code or name...'),
              debounce: 350,
            }]}
          />
        )}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id
          ? t('wms.warehouses.actions.edit', 'Edit warehouse')
          : t('wms.warehouses.actions.create', 'Create warehouse')}
        footer={(
          <div className={s.modalFooter}>
            <Modal.Button onClick={() => setModalOpen(false)}>{t('common.cancel', 'Cancel')}</Modal.Button>
            <Modal.Button variant="primary" onClick={saveWarehouse} disabled={saving}>
              {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
            </Modal.Button>
          </div>
        )}
      >
        <div className={s.formGrid}>
          <label>
            <span>{t('wms.fields.code', 'Code')}</span>
            <input value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} />
          </label>
          <label>
            <span>{t('wms.fields.name', 'Name')}</span>
            <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
          </label>
          <label className={s.checkboxRow}>
            <input
              type="checkbox"
              checked={Boolean(form.isActive)}
              onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
            <span>{t('wms.fields.isActive', 'Active')}</span>
          </label>
        </div>
        {errorText ? <div className={s.feedback}>{errorText}</div> : null}
      </Modal>
    </>
  );
}
