import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AddButton from '../../../components/buttons/AddButton/AddButton';
import { Workspace } from '../../../components/workspace';
import { createWmsWarehousesColumns } from '../../../components/workspace/columnSchemas/wmsWarehousesColumns';
import { CheckboxField, TextField } from '../../../components/ui/fields';
import useAclPermissions from '../../../hooks/useAclPermissions';
import useGridPrefs from '../../../hooks/useGridPrefs';
import {
  useCreateWarehouseMutation,
  useUpdateWarehouseMutation,
} from '../../../store/rtk/wmsDocumentsApi';
import SetupSidePanel from '../SetupSidePanel';
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
      setErrorText('');
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

  const closeEditor = () => {
    if (saving) return;
    setModalOpen(false);
    setErrorText('');
  };

  const editorTitle = form.id
    ? t('wms.warehouses.actions.edit', 'Edit warehouse')
    : t('wms.warehouses.actions.create', 'Create warehouse');

  const formContent = (
    <>
      <div className={s.formGrid}>
        <label>
          <span>{t('wms.fields.code', 'Code')}</span>
          <TextField
            value={form.code || ''}
            onValueChange={(value) => setForm((prev) => ({ ...prev, code: value }))}
          />
        </label>
        <label>
          <span>{t('wms.fields.name', 'Name')}</span>
          <TextField
            value={form.name || ''}
            onValueChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
          />
        </label>
        <CheckboxField
          className={s.checkboxRow}
          label={t('wms.fields.isActive', 'Active')}
          checked={Boolean(form.isActive)}
          onValueChange={(value) => setForm((prev) => ({ ...prev, isActive: value }))}
        />
      </div>
      {errorText ? <div className={s.feedback}>{errorText}</div> : null}
    </>
  );

  return (
    <>
      <div className={[
        s.setupCrudLayout,
        canManage ? '' : s.setupCrudLayoutNoPanel,
      ].filter(Boolean).join(' ')}
      >
        <div className={s.setupListPane}>
          <Workspace
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
            filterControls={[{
                  type: 'search',
                  key: 'search',
                  placeholder: t('wms.warehouses.search', 'Search by code or name...'),
                  debounce: 350,
                }]}
          />
        </div>

        {canManage ? (
          <SetupSidePanel
            open={modalOpen}
            title={editorTitle}
            subtitle={form.id
              ? t('wms.warehouses.drawer.editSubtitle', 'Update the warehouse code, name or active state.')
              : t('wms.warehouses.drawer.createSubtitle', 'Create a warehouse that can be used as the main WMS context.')}
            onCancel={closeEditor}
            onSave={saveWarehouse}
            saving={saving}
            saveLabel={t('common.save', 'Save')}
            savingLabel={t('common.saving', 'Saving...')}
            cancelLabel={t('common.cancel', 'Cancel')}
            emptyTitle={t('wms.warehouses.drawer.emptyTitle', 'Warehouse editor')}
            emptyText={t('wms.warehouses.drawer.emptyText', 'Create a warehouse or edit a row without leaving the setup list.')}
          >
            {formContent}
          </SetupSidePanel>
        ) : null}
      </div>

    </>
  );
}
