import { useCallback, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, Warehouse } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import AddButton from '../../../components/buttons/AddButton/AddButton';
import { SearchField, SelectField } from '../../../components/ui/fields';
import {
  Workspace,
  WorkspaceStatusChip,
} from '../../../components/workspace';
import {
  useListCycleCountsQuery,
  useListLocationsQuery,
  useListWarehousesQuery,
  useListWarehouseDocumentsQuery,
} from '../../../store/rtk/wmsDocumentsApi';
import {
  WMS_DOCUMENT_TYPES,
  getWmsDocumentCreateRoute,
} from '../navigation/wmsUiNavigation';
import {
  getWmsLocationMode,
  getWmsLocationModeDescription,
  getWmsLocationModeLabel,
} from '../locationsMode';
import {
  buildDocumentsWorkspaceRows,
  getCycleCountsQuery,
  getDocumentsTableColumns,
  getDocumentsWorkspaceView,
  getWarehouseDocumentsQuery,
  normalizeDocumentsColumnState,
  shouldFetchCycleCounts,
  shouldFetchWarehouseDocuments,
  WMS_DOCUMENTS_DEFAULT_COLUMNS,
  WMS_DOCUMENTS_COLUMNS_STORAGE_KEY,
} from './wmsDocumentsWorkspaceModel';
import s from './WmsDocumentsWorkspace.module.css';

const STATUS_FILTERS = ['', 'draft', 'packing', 'counting', 'received', 'shipped', 'posted', 'reconciled'];

function rowsFromWarehouseDocumentsResponse(data) {
  return Array.isArray(data?.data) ? data.data : [];
}

function rowsFromListResponse(data) {
  return Array.isArray(data?.items) ? data.items : [];
}

function getWarehouseLabel(row = {}) {
  return [row.code, row.name].filter(Boolean).join(' - ') || row.id || '-';
}

function formatDate(value, locale) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getErrorText(error) {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || 'Failed to load WMS documents.';
}

function setParam(searchParams, navigate, key, value) {
  const next = new URLSearchParams(searchParams);
  if (value) next.set(key, value);
  else next.delete(key);
  navigate({ pathname: '/main/wms/documents', search: next.toString() ? `?${next.toString()}` : '' });
}

function setTypeParam(searchParams, navigate, value) {
  const next = new URLSearchParams(searchParams);
  next.delete('view');
  if (value) next.set('type', value);
  else next.delete('type');
  navigate({ pathname: '/main/wms/documents', search: next.toString() ? `?${next.toString()}` : '' });
}

function getViewTitle(t, view) {
  if (view?.type) {
    return t(`wms.documents.workspace.titles.${view.type}`, view.type);
  }
  const key = view?.key || 'all';
  return t(`wms.documents.workspace.titles.${key}`, t('wms.documents.workspace.titles.all', 'All Documents'));
}

function getActiveChipLabel(t, view, title) {
  if (view?.type) {
    return t('wms.documents.workspace.active.type', 'Type: {{type}}', { type: view.type });
  }
  return t('wms.documents.workspace.active.view', 'View: {{view}}', { view: title });
}

function TypePicker({ open, onCreate, disabledTypes = {} }) {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div className={s.typePicker} role="menu" aria-label={t('wms.documents.workspace.typePicker', 'Document type')}>
      {WMS_DOCUMENT_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          className={`${s.typePickerItem} ${disabledTypes[type] ? s.typePickerItemDisabled : ''}`}
          disabled={!!disabledTypes[type]}
          title={disabledTypes[type] || undefined}
          onClick={() => onCreate(type)}
          role="menuitem"
        >
          <strong>{type}</strong>
          <span>
            {disabledTypes[type] || t(`wms.documents.workspace.typeDescriptions.${type}`, t(`wms.documents.types.${type}`, type))}
          </span>
        </button>
      ))}
    </div>
  );
}

function TypeBadge({ type }) {
  return <span className={s.typeBadge}>{type || '-'}</span>;
}

function isInteractiveTarget(target) {
  return Boolean(target?.closest?.('button, a, input, select, textarea, [role="button"], [role="link"]'));
}

function renderCell(row, column, t, locale) {
  if (column.key === 'type') return <TypeBadge type={row.type} />;
  if (column.key === 'number') {
    return (
      <span className={s.numberCell}>
        <strong>{row.number || '-'}</strong>
        <span>{row.id || ''}</span>
      </span>
    );
  }
  if (column.key === 'status') {
    return (
      <WorkspaceStatusChip status={row.status} size="sm">
        {t(`statuses.${String(row.status || '').toLowerCase()}`, row.status || '-')}
      </WorkspaceStatusChip>
    );
  }
  if (column.key === 'date') return formatDate(row.date, locale);
  if (column.key === 'createdAt') return formatDate(row.createdAt, locale);
  if (column.key === 'warehouse') return row.warehouse || '-';
  if (column.key === 'lines') return row.lines ?? 0;
  if (column.key === 'quantity') return row.quantity || '-';
  if (column.key === 'documentId' || column.key === 'parentDocumentId' || column.key === 'correctedById') {
    return row[column.key] ? <span className={s.codeCell}>{row[column.key]}</span> : '-';
  }
  return row[column.key] || '-';
}

export default function WmsDocumentsWorkspace() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState('');

  const view = useMemo(() => getDocumentsWorkspaceView(searchParams), [searchParams]);
  const search = searchParams.get('search') || searchParams.get('q') || '';
  const selectedStatus = searchParams.get('status') || '';
  const selectedWarehouseId = searchParams.get('warehouseId') || '';
  const selectedIdParam = searchParams.get('selectedId') || searchParams.get('id') || '';
  const selectedType = view.type || '';

  const warehousesQuery = useListWarehousesQuery({ limit: 200, sort: 'code', dir: 'ASC' });
  const locationsQuery = useListLocationsQuery({
    page: 1,
    limit: 200,
    sort: 'code',
    dir: 'ASC',
    warehouseId: selectedWarehouseId || undefined,
  });
  const warehouses = useMemo(() => rowsFromListResponse(warehousesQuery.data), [warehousesQuery.data]);
  const warehousesLoaded = Array.isArray(warehousesQuery.data?.items);
  const isMmUnavailable = warehousesLoaded && warehouses.length < 2;
  const mmUnavailableMessage = t('wms.documents.mmGuard.title', 'Transfer requires at least 2 warehouses');
  const disabledTypes = useMemo(
    () => (isMmUnavailable ? { MM: mmUnavailableMessage } : {}),
    [isMmUnavailable, mmUnavailableMessage]
  );
  const locationMode = useMemo(() => getWmsLocationMode({
    locations: rowsFromListResponse(locationsQuery.data),
    warehouseId: selectedWarehouseId,
  }), [locationsQuery.data, selectedWarehouseId]);

  const documentsQueryArgs = useMemo(
    () => getWarehouseDocumentsQuery(view, searchParams),
    [view, searchParams]
  );
  const fetchDocuments = shouldFetchWarehouseDocuments(view);
  const fetchCycleCounts = shouldFetchCycleCounts(view);

  const documentsQuery = useListWarehouseDocumentsQuery(documentsQueryArgs, {
    skip: !fetchDocuments,
  });
  const cycleCountsQueryArgs = useMemo(
    () => getCycleCountsQuery(view, searchParams),
    [view, searchParams]
  );

  const cycleCountsQuery = useListCycleCountsQuery(cycleCountsQueryArgs, {
    skip: !fetchCycleCounts,
  });

  const rows = useMemo(() => buildDocumentsWorkspaceRows({
    documents: fetchDocuments ? rowsFromWarehouseDocumentsResponse(documentsQuery.data) : [],
    cycleCounts: fetchCycleCounts ? rowsFromListResponse(cycleCountsQuery.data) : [],
    view,
    search,
  }), [cycleCountsQuery.data, documentsQuery.data, fetchCycleCounts, fetchDocuments, search, view]);

  const loading = (fetchDocuments && documentsQuery.isFetching && !documentsQuery.data)
    || (fetchCycleCounts && cycleCountsQuery.isFetching && !cycleCountsQuery.data);
  const error = (fetchDocuments && documentsQuery.error) || (fetchCycleCounts && cycleCountsQuery.error);

  const createRoute = view.createRoute || null;
  const title = getViewTitle(t, view);
  const activeChipLabel = getActiveChipLabel(t, view, title);
  const isCurrentCreateDisabled = view.type === 'MM' && isMmUnavailable;
  const createLabel = view.type
    ? t('wms.documents.workspace.createType', 'Create {{type}}', { type: view.type })
    : t('wms.documents.actions.create', 'Create Document');
  const openDocumentRow = useCallback((row) => {
    if (!row?.route) return;
    setSelectedRowId(row.id || '');
    navigate(row.route);
  }, [navigate]);

  const onRowClick = useCallback((row, event) => {
    if (isInteractiveTarget(event.target)) return;
    openDocumentRow(row);
  }, [openDocumentRow]);

  const onRowKeyDown = useCallback((row, event) => {
    if (isInteractiveTarget(event.target)) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openDocumentRow(row);
  }, [openDocumentRow]);

  const onCreateType = useCallback((type) => {
    if (disabledTypes[type]) return;
    const route = getWmsDocumentCreateRoute(type);
    if (!route) return;
    setPickerOpen(false);
    navigate(route);
  }, [disabledTypes, navigate]);

  const onCreate = useCallback(() => {
    if (isCurrentCreateDisabled) return;
    if (createRoute) {
      navigate(createRoute);
      return;
    }
    setPickerOpen((current) => !current);
  }, [createRoute, isCurrentCreateDisabled, navigate]);

  const retry = useCallback(() => {
    if (fetchDocuments) documentsQuery.refetch();
    if (fetchCycleCounts) cycleCountsQuery.refetch();
  }, [cycleCountsQuery, documentsQuery, fetchCycleCounts, fetchDocuments]);

  const actions = useMemo(() => (
    <>
      <span className={s.modePill} title={getWmsLocationModeDescription(locationMode)}>
        {getWmsLocationModeLabel(locationMode)}
      </span>
      <div className={s.createWrap}>
        <AddButton
          onClick={onCreate}
          disabled={isCurrentCreateDisabled}
          title={isCurrentCreateDisabled ? mmUnavailableMessage : undefined}
        >
          {createLabel}
        </AddButton>
        <TypePicker open={pickerOpen} onCreate={onCreateType} disabledTypes={disabledTypes} />
      </div>
    </>
  ), [
    createLabel,
    disabledTypes,
    isCurrentCreateDisabled,
    locationMode,
    mmUnavailableMessage,
    onCreate,
    onCreateType,
    pickerOpen,
  ]);

  const controls = useMemo(() => [
    {
      key: 'warehouse',
      icon: <Warehouse size={16} aria-hidden="true" />,
      label: t('wms.documents.workspace.filters.warehouse', 'Warehouse'),
      control: (
        <SelectField
          value={selectedWarehouseId}
          onValueChange={(value) => setParam(searchParams, navigate, 'warehouseId', value)}
          options={[
            { value: '', label: t('wms.documents.workspace.filters.allWarehouses', 'All warehouses') },
            ...warehouses.map((warehouse) => ({
              value: warehouse.id,
              label: getWarehouseLabel(warehouse),
            })),
          ]}
        />
      ),
    },
    {
      key: 'search',
      kind: 'search',
      icon: <Search size={16} aria-hidden="true" />,
      control: (
        <SearchField
          value={search}
          placeholder={t('wms.documents.workspace.filters.search', 'Search documents')}
          onValueChange={(value) => setParam(searchParams, navigate, 'search', value)}
        />
      ),
    },
    {
      key: 'type',
      icon: <SlidersHorizontal size={16} aria-hidden="true" />,
      label: t('wms.documents.workspace.filters.type', 'Type'),
      control: (
        <SelectField
          value={selectedType}
          onValueChange={(value) => setTypeParam(searchParams, navigate, value)}
          options={[
            { value: '', label: t('wms.documents.workspace.filters.allTypes', 'All types') },
            ...WMS_DOCUMENT_TYPES.map((type) => ({
              value: type,
              label: t(`wms.documents.types.${type}`, type),
              disabled: Boolean(disabledTypes[type]),
            })),
          ]}
        />
      ),
    },
    {
      key: 'status',
      icon: <SlidersHorizontal size={16} aria-hidden="true" />,
      label: t('wms.documents.workspace.filters.status', 'Status'),
      control: (
        <SelectField
          value={selectedStatus}
          onValueChange={(value) => setParam(searchParams, navigate, 'status', value)}
          options={STATUS_FILTERS.map((status) => ({
            value: status,
            label: status ? t(`statuses.${status}`, status) : t('common.all', 'All'),
          }))}
        />
      ),
    },
  ], [
    disabledTypes,
    navigate,
    search,
    searchParams,
    selectedStatus,
    selectedType,
    selectedWarehouseId,
    t,
    warehouses,
  ]);

  const labels = useMemo(() => ({
    controlsAria: 'Document controls',
    resetColumns: t('wms.documents.workspace.resetColumns', 'Reset columns'),
    columnsMenu: t('wms.documents.workspace.columnsMenu', 'Columns'),
    visibleColumns: (count) => t('wms.documents.workspace.visibleColumns', 'Visible: {{count}}', { count }),
    groupLabel: (key) => t(`wms.documents.workspace.columnGroups.${key}`, key),
    columnLabel: (column) => t(column.labelKey, column.fallbackLabel),
    requiredColumn: t('wms.documents.workspace.requiredColumn', 'Required column'),
    columnContext: (column) => (column.contextLabelKey ? t(column.contextLabelKey, '') : ''),
    columnHelper: (column) => (column.helperKey ? t(column.helperKey, '') : ''),
    hideTechnicalColumns: t('wms.documents.workspace.hideTechnicalColumns', 'Hide technical fields'),
    showTechnicalColumns: t('wms.documents.workspace.showTechnicalColumns', 'Show technical fields'),
    showAllColumns: t('wms.documents.workspace.showAllColumns', 'Show all'),
    dragColumn: t('wms.documents.workspace.dragColumn', 'Drag to reorder column'),
    resizeColumn: t('wms.documents.workspace.resizeColumn', 'Resize column'),
    loading: t('wms.documents.workspace.loading', 'Loading documents'),
    errorTitle: t('wms.documents.workspace.errorTitle', 'Failed to load documents'),
    retry: t('common.retry', 'Retry'),
    emptyTitle: t('wms.documents.workspace.emptyTitle', 'No documents found'),
  }), [t]);

  const emptyState = useMemo(() => {
    const isMmGuard = view.type === 'MM' && isMmUnavailable;
    return {
      title: isMmGuard ? mmUnavailableMessage : t('wms.documents.workspace.emptyTitle', 'No documents found'),
      description: isMmGuard
        ? t('wms.documents.mmGuard.description', 'Create a second warehouse to move goods between warehouses')
        : t('wms.documents.workspace.emptyDescription', 'Adjust search or filters, or create a new WMS document.'),
      action: isMmGuard
        ? <AddButton onClick={() => navigate('/main/wms/setup?tab=warehouses')}>{t('wms.documents.mmGuard.openWarehouses', 'Open warehouses')}</AddButton>
        : <AddButton onClick={onCreate}>{createLabel}</AddButton>,
    };
  }, [createLabel, isMmUnavailable, mmUnavailableMessage, navigate, onCreate, t, view.type]);

  const guardState = rows.length > 0 && view.type === 'MM' && isMmUnavailable
    ? {
      title: mmUnavailableMessage,
      description: t('wms.documents.mmGuard.description', 'Create a second warehouse to move goods between warehouses'),
      action: <AddButton onClick={() => navigate('/main/wms/setup?tab=warehouses')}>{t('wms.documents.mmGuard.openWarehouses', 'Open warehouses')}</AddButton>,
    }
    : null;

  return (
    <Workspace
      title={title}
      subtitle={t('wms.documents.workspace.subtitle', 'Warehouse document workspace')}
      badge={activeChipLabel}
      actions={actions}
      controls={controls}
      rows={rows}
      columns={WMS_DOCUMENTS_DEFAULT_COLUMNS}
      normalizeColumnState={normalizeDocumentsColumnState}
      getVisibleColumns={getDocumentsTableColumns}
      storageKey={WMS_DOCUMENTS_COLUMNS_STORAGE_KEY}
      loading={loading}
      error={error}
      errorState={{
        title: t('wms.documents.workspace.errorTitle', 'Failed to load documents'),
        description: getErrorText(error),
      }}
      emptyState={emptyState}
      guardState={guardState}
      onRetry={retry}
      loadingState={{
        title: t('wms.documents.workspace.loading', 'Loading documents'),
        rows: 6,
      }}
      renderCell={(row, column) => renderCell(row, column, t, i18n.language)}
      getRowId={(row) => row.id}
      getRowKey={(row) => `${row.type}:${row.id}`}
      selectedRowId={selectedRowId}
      selectedRowIdFallback={selectedIdParam}
      onRowClick={onRowClick}
      onRowKeyDown={onRowKeyDown}
      labels={labels}
      pagination={false}
    />
  );
}
