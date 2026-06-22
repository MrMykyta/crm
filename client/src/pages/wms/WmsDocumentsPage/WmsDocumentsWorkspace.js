import { useCallback, useMemo, useState } from 'react';
import { RefreshCcw, Search, SlidersHorizontal, Warehouse } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import AddButton from '../../../components/buttons/AddButton/AddButton';
import { SearchField, SelectField } from '../../../components/ui/fields';
import {
  WmsEmptyState,
  WmsErrorState,
  WmsLoadingState,
  WmsStatusChip,
} from '../../../components/wms/ui';
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

function getStoredColumnState() {
  try {
    const raw = window.localStorage.getItem(WMS_DOCUMENTS_COLUMNS_STORAGE_KEY);
    return normalizeDocumentsColumnState(raw ? JSON.parse(raw) : {});
  } catch {
    return normalizeDocumentsColumnState({});
  }
}

function persistColumnState(next) {
  try {
    window.localStorage.setItem(WMS_DOCUMENTS_COLUMNS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
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
      <WmsStatusChip status={row.status} size="sm">
        {t(`statuses.${String(row.status || '').toLowerCase()}`, row.status || '-')}
      </WmsStatusChip>
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
  const [columnState, setColumnState] = useState(getStoredColumnState);
  const [draggedColumnKey, setDraggedColumnKey] = useState('');
  const [dragOverColumnKey, setDragOverColumnKey] = useState('');
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [technicalColumnsOpen, setTechnicalColumnsOpen] = useState(false);
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
  const normalizedColumnState = useMemo(() => normalizeDocumentsColumnState(columnState), [columnState]);
  const columns = useMemo(() => getDocumentsTableColumns(normalizedColumnState), [normalizedColumnState]);
  const tableWidth = useMemo(
    () => columns.reduce((sum, column) => sum + Number(column.width || 0), 0),
    [columns]
  );
  const visibleColumnCount = columns.length;
  const columnGroups = useMemo(() => {
    const visibleGroups = [
      { key: 'core', columns: WMS_DOCUMENTS_DEFAULT_COLUMNS.filter((column) => (column.category || 'core') === 'core') },
      { key: 'operational', columns: WMS_DOCUMENTS_DEFAULT_COLUMNS.filter((column) => column.category === 'operational') },
      { key: 'context', columns: WMS_DOCUMENTS_DEFAULT_COLUMNS.filter((column) => column.category === 'context') },
    ].filter((group) => group.columns.length > 0);
    const technicalColumns = WMS_DOCUMENTS_DEFAULT_COLUMNS.filter((column) => column.category === 'technical');
    return { visibleGroups, technicalColumns };
  }, []);

  const saveColumnState = useCallback((updater) => {
    setColumnState((current) => {
      const next = normalizeDocumentsColumnState(
        typeof updater === 'function' ? updater(current) : updater
      );
      persistColumnState(next);
      return next;
    });
  }, []);

  const resetColumns = useCallback(() => {
    const next = normalizeDocumentsColumnState({});
    persistColumnState(next);
    setColumnState(next);
  }, []);

  const setColumnVisibility = useCallback((column, visible) => {
    if (column.required) return;
    saveColumnState((current) => ({
      ...current,
      visibility: { ...(current.visibility || {}), [column.key]: visible },
    }));
  }, [saveColumnState]);

  const showAllColumns = useCallback(() => {
    saveColumnState((current) => ({
      ...current,
      visibility: Object.fromEntries(WMS_DOCUMENTS_DEFAULT_COLUMNS.map((column) => [column.key, true])),
    }));
  }, [saveColumnState]);

  const resizeColumn = useCallback((column, startX, startWidth) => {
    const onMove = (event) => {
      const nextWidth = Math.min(
        Math.max(startWidth + event.clientX - startX, column.minWidth),
        column.maxWidth
      );
      saveColumnState((current) => ({
        ...current,
        widths: { ...(current.widths || {}), [column.key]: nextWidth },
      }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.classList.remove(s.columnResizingBody);
    };
    document.body.classList.add(s.columnResizingBody);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [saveColumnState]);

  const moveColumn = useCallback((fromKey, toKey) => {
    if (!fromKey || !toKey || fromKey === toKey) return;
    saveColumnState((current) => {
      const order = Array.isArray(current.order) ? current.order.slice() : columns.map((column) => column.key);
      const fromIndex = order.indexOf(fromKey);
      const toIndex = order.indexOf(toKey);
      if (fromIndex < 0 || toIndex < 0) return current;
      const [moved] = order.splice(fromIndex, 1);
      order.splice(toIndex, 0, moved);
      return { ...current, order };
    });
  }, [columns, saveColumnState]);

  const startColumnMouseDrag = useCallback((column, event) => {
    if (event.button !== 0) return;
    const startX = event.clientX;
    const startY = event.clientY;
    let didDrag = false;

    const getTargetKey = (clientX, clientY) => {
      const target = document.elementFromPoint(clientX, clientY)?.closest('[data-column-key]');
      return target?.getAttribute('data-column-key') || '';
    };

    const onMove = (moveEvent) => {
      const distance = Math.abs(moveEvent.clientX - startX) + Math.abs(moveEvent.clientY - startY);
      if (distance < 8) return;
      didDrag = true;
      setDraggedColumnKey(column.key);
      setDragOverColumnKey(getTargetKey(moveEvent.clientX, moveEvent.clientY));
    };

    const onUp = (upEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (didDrag) {
        moveColumn(column.key, getTargetKey(upEvent.clientX, upEvent.clientY));
      }
      setDraggedColumnKey('');
      setDragOverColumnKey('');
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [moveColumn]);

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

  return (
    <div className={s.workspace}>
      <header className={s.topbar}>
        <div>
          <h1>{title}</h1>
          <div className={s.subtitleRow}>
            <p>{t('wms.documents.workspace.subtitle', 'Warehouse document workspace')}</p>
            <span className={s.activeChip}>{activeChipLabel}</span>
          </div>
        </div>
        <div className={s.actions}>
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
        </div>
      </header>

      <section className={s.controls} aria-label="Document controls">
        <label className={s.filterBox}>
          <Warehouse size={16} aria-hidden="true" />
          <span>{t('wms.documents.workspace.filters.warehouse', 'Warehouse')}</span>
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
        </label>
        <label className={s.searchBox}>
          <Search size={16} aria-hidden="true" />
          <SearchField
            value={search}
            placeholder={t('wms.documents.workspace.filters.search', 'Search documents')}
            onValueChange={(value) => setParam(searchParams, navigate, 'search', value)}
          />
        </label>
        <label className={s.filterBox}>
          <SlidersHorizontal size={16} aria-hidden="true" />
          <span>{t('wms.documents.workspace.filters.type', 'Type')}</span>
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
        </label>
        <label className={s.filterBox}>
          <SlidersHorizontal size={16} aria-hidden="true" />
          <span>{t('wms.documents.workspace.filters.status', 'Status')}</span>
          <SelectField
            value={selectedStatus}
            onValueChange={(value) => setParam(searchParams, navigate, 'status', value)}
            options={STATUS_FILTERS.map((status) => ({
              value: status,
              label: status ? t(`statuses.${status}`, status) : t('common.all', 'All'),
            }))}
          />
        </label>
        <button type="button" className={s.resetColumnsButton} onClick={resetColumns}>
          <RefreshCcw size={14} aria-hidden="true" />
          <span>{t('wms.documents.workspace.resetColumns', 'Reset columns')}</span>
        </button>
        <div className={s.columnsMenuWrap}>
          <button
            type="button"
            className={s.resetColumnsButton}
            onClick={() => setColumnsOpen((current) => !current)}
            aria-expanded={columnsOpen}
            aria-haspopup="menu"
          >
            <SlidersHorizontal size={14} aria-hidden="true" />
            <span>{t('wms.documents.workspace.columnsMenu', 'Columns')}</span>
          </button>
          {columnsOpen ? (
            <div
              className={s.columnsMenu}
              role="menu"
              aria-label={t('wms.documents.workspace.columnsMenu', 'Columns')}
              onClick={(event) => event.stopPropagation()}
            >
              <div className={s.columnsMenuHeader}>
                <strong>{t('wms.documents.workspace.columnsMenu', 'Columns')}</strong>
                <span>{t('wms.documents.workspace.visibleColumns', 'Visible: {{count}}', { count: visibleColumnCount })}</span>
              </div>
              <div className={s.columnChecks}>
                {[...columnGroups.visibleGroups, ...(technicalColumnsOpen ? [{ key: 'technical', columns: columnGroups.technicalColumns }] : [])].map((group) => (
                  <div key={group.key} className={s.columnGroup}>
                    <div className={s.columnGroupTitle}>
                      {t(`wms.documents.workspace.columnGroups.${group.key}`, group.key)}
                    </div>
                    {group.columns.map((column) => {
                      const visible = normalizedColumnState.visibility[column.key] !== false;
                      const label = t(column.labelKey, column.fallbackLabel);
                      const requiredTitle = t('wms.documents.workspace.requiredColumn', 'Required column');
                      const contextLabel = column.contextLabelKey ? t(column.contextLabelKey, '') : '';
                      const helper = column.required
                        ? requiredTitle
                        : column.helperKey ? t(column.helperKey, '') : '';
                      return (
                        <label
                          key={column.key}
                          className={`${s.columnCheck} ${column.required ? s.columnCheckDisabled : ''}`}
                          title={column.required ? requiredTitle : helper || undefined}
                        >
                          <input
                            type="checkbox"
                            checked={visible}
                            disabled={column.required}
                            onChange={(event) => setColumnVisibility(column, event.target.checked)}
                          />
                          <span>
                            {label}
                            {contextLabel ? <em className={s.columnContextBadge}>{contextLabel}</em> : null}
                          </span>
                          {helper ? <small>{helper}</small> : null}
                        </label>
                      );
                    })}
                  </div>
                ))}
                {columnGroups.technicalColumns.length ? (
                  <button
                    type="button"
                    className={s.technicalToggle}
                    onClick={() => setTechnicalColumnsOpen((current) => !current)}
                    aria-expanded={technicalColumnsOpen}
                  >
                    {technicalColumnsOpen
                      ? t('wms.documents.workspace.hideTechnicalColumns', 'Hide technical fields')
                      : t('wms.documents.workspace.showTechnicalColumns', 'Show technical fields')}
                  </button>
                ) : null}
              </div>
              <div className={s.columnsMenuActions}>
                <button type="button" onClick={showAllColumns}>
                  {t('wms.documents.workspace.showAllColumns', 'Show all')}
                </button>
                <button type="button" onClick={resetColumns}>
                  {t('wms.documents.workspace.resetColumns', 'Reset columns')}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <main className={s.content}>
        {loading ? (
          <WmsLoadingState title={t('wms.documents.workspace.loading', 'Loading documents')} rows={6} />
        ) : null}

        {!loading && error ? (
          <WmsErrorState
            title={t('wms.documents.workspace.errorTitle', 'Failed to load documents')}
            description={getErrorText(error)}
            onRetry={retry}
          />
        ) : null}

        {!loading && !error && rows.length === 0 ? (
          <WmsEmptyState
            title={view.type === 'MM' && isMmUnavailable ? mmUnavailableMessage : t('wms.documents.workspace.emptyTitle', 'No documents found')}
            description={view.type === 'MM' && isMmUnavailable
              ? t('wms.documents.mmGuard.description', 'Create a second warehouse to move goods between warehouses')
              : t('wms.documents.workspace.emptyDescription', 'Adjust search or filters, or create a new WMS document.')}
            action={view.type === 'MM' && isMmUnavailable
              ? <AddButton onClick={() => navigate('/main/wms/setup?tab=warehouses')}>{t('wms.documents.mmGuard.openWarehouses', 'Open warehouses')}</AddButton>
              : <AddButton onClick={onCreate}>{createLabel}</AddButton>}
          />
        ) : null}

        {!loading && !error && rows.length > 0 && view.type === 'MM' && isMmUnavailable ? (
          <WmsEmptyState
            title={mmUnavailableMessage}
            description={t('wms.documents.mmGuard.description', 'Create a second warehouse to move goods between warehouses')}
            action={<AddButton onClick={() => navigate('/main/wms/setup?tab=warehouses')}>{t('wms.documents.mmGuard.openWarehouses', 'Open warehouses')}</AddButton>}
          />
        ) : null}

        {!loading && !error && rows.length > 0 && !(view.type === 'MM' && isMmUnavailable) ? (
          <div className={s.tableWrap}>
            <table className={s.table} style={{ width: `${tableWidth}px` }}>
              <colgroup>
                {columns.map((column) => (
                  <col key={column.key} style={{ width: `${column.width}px` }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      data-column-key={column.key}
                      className={`${column.numeric ? s.numeric : ''} ${dragOverColumnKey === column.key ? s.dragOverColumn : ''}`}
                      draggable
                      onMouseDown={(event) => startColumnMouseDrag(column, event)}
                      onDragStart={(event) => {
                        setDraggedColumnKey(column.key);
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', column.key);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragOverColumnKey(column.key);
                      }}
                      onDragLeave={() => setDragOverColumnKey('')}
                      onDrop={(event) => {
                        event.preventDefault();
                        const fromKey = event.dataTransfer.getData('text/plain') || draggedColumnKey;
                        moveColumn(fromKey, column.key);
                        setDraggedColumnKey('');
                        setDragOverColumnKey('');
                      }}
                      onDragEnd={() => {
                        setDraggedColumnKey('');
                        setDragOverColumnKey('');
                      }}
                      title={t('wms.documents.workspace.dragColumn', 'Drag to reorder column')}
                    >
                      <span className={s.columnHeaderLabel}>
                        {t(column.labelKey, column.fallbackLabel)}
                      </span>
                      <span
                        className={s.resizeHandle}
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={t('wms.documents.workspace.resizeColumn', 'Resize column')}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          resizeColumn(column, event.clientX, column.width);
                        }}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={`${row.type}:${row.id}`}
                    className={`${s.documentRow} ${(selectedRowId || selectedIdParam) === row.id ? s.documentRowSelected : ''}`}
                    tabIndex={row.route ? 0 : undefined}
                    aria-label={`${row.type || ''} ${row.number || row.id || ''}`.trim()}
                    aria-selected={(selectedRowId || selectedIdParam) === row.id}
                    onClick={(event) => onRowClick(row, event)}
                    onKeyDown={(event) => onRowKeyDown(row, event)}
                  >
                    {columns.map((column) => (
                      <td key={column.key} className={column.numeric ? s.numeric : ''}>
                        {renderCell(row, column, t, i18n.language)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </main>
    </div>
  );
}
