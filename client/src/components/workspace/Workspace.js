import { forwardRef, useCallback, useImperativeHandle, useMemo, useState } from 'react';
import { RefreshCcw } from 'lucide-react';

import ColumnMenu from './WorkspaceColumnMenu';
import FilterBox from './WorkspaceFilterBox';
import Pagination from './WorkspacePagination';
import {
  WorkspaceEmptyState,
  WorkspaceErrorState,
  WorkspaceLoadingState,
} from './WorkspaceState';
import Table from './WorkspaceTable';
import useData from './useWorkspaceData';
import { SearchField, SelectField } from '../ui/fields';
import s from './Workspace.module.css';

const IDENTITY_COLUMN_STATE = (state) => state || {};
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function getStoredColumnState(storageKey, normalizeColumnState) {
  try {
    const raw = storageKey ? window.localStorage.getItem(storageKey) : null;
    return normalizeColumnState(raw ? JSON.parse(raw) : {});
  } catch {
    return normalizeColumnState({});
  }
}

function persistColumnState(storageKey, next) {
  if (!storageKey) return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
}

function getColumnLabelText(column) {
  if (!column) return '';
  const raw = column.fallbackLabel || column.title || column.label || column.key || '';
  if (typeof raw === 'string' || typeof raw === 'number') return String(raw);
  return String(column.key || '');
}

function estimateHeaderMinWidth(column) {
  const label = getColumnLabelText(column).trim();
  if (!label) return 92;
  const compact = label.length <= 4 ? 78 : 104;
  return Math.max(compact, Math.min(260, (label.length * 9.5) + 54));
}

function normalizeWorkspaceColumn(column) {
  const headerMinWidth = estimateHeaderMinWidth(column);
  const width = Math.max(Number(column?.width) || 180, headerMinWidth);
  return {
    ...column,
    width,
    minWidth: Math.max(Number(column?.minWidth) || 0, headerMinWidth),
    maxWidth: Number(column?.maxWidth) || 520,
  };
}

function applyDefaultColumnState(columns, state = {}) {
  const visibility = state.visibility || {};
  const order = Array.isArray(state.order) ? state.order.map(String) : [];
  const widths = state.widths || {};
  const visible = columns
    .filter((column) => (
      Object.prototype.hasOwnProperty.call(visibility, column.key)
        ? visibility[column.key] !== false
        : column.defaultVisible !== false
    ))
    .map((column) => ({
      ...column,
      width: Number(widths[column.key]) || column.width,
    }));
  if (!order.length) return visible;
  const byKey = new Map(visible.map((column) => [column.key, column]));
  const ordered = order.map((key) => byKey.get(key)).filter(Boolean);
  const remaining = visible.filter((column) => !order.includes(column.key));
  return [...ordered, ...remaining];
}

function toColumnState({ columnWidths, columnOrder, columnVisibility }) {
  return {
    widths: columnWidths || {},
    order: Array.isArray(columnOrder) ? columnOrder : [],
    visibility: columnVisibility || {},
  };
}

function renderValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function createColumnStateHandler({
  onColumnResize,
  onColumnOrderChange,
  onColumnVisibilityChange,
}) {
  if (!onColumnResize && !onColumnOrderChange && !onColumnVisibilityChange) return undefined;
  return (next = {}) => {
    onColumnResize?.(next.widths || {});
    onColumnOrderChange?.(Array.isArray(next.order) ? next.order : []);
    onColumnVisibilityChange?.(next.visibility || {});
  };
}

function buildFilterControl(control, query, replaceQuery) {
  if (!control) return null;
  const setValue = (key, value) => {
    replaceQuery((current) => ({
      ...current,
      [key]: value || undefined,
      page: 1,
    }));
  };

  if (control.type === 'custom' && typeof control.render === 'function') {
    return control.render({ query, onChange: replaceQuery });
  }

  if (control.type === 'select') {
    return (
      <SelectField
        value={query?.[control.key] || ''}
        onValueChange={(value) => setValue(control.key, value)}
        options={control.options || []}
        placeholder={control.placeholder || control.label}
        size="sm"
        inputClassName={s.controlSelectTrigger}
        contentClassName={s.controlSelectContent}
        fullWidth={false}
      />
    );
  }

  return (
    <SearchField
      value={query?.[control.key] || ''}
      onValueChange={(value) => setValue(control.key, value)}
      placeholder={control.placeholder || control.label}
      size="sm"
      clearable
      inputClassName={s.controlSearchInput}
      fullWidth={false}
    />
  );
}

function isPaginationModel(value) {
  return Boolean(value && typeof value === 'object' && typeof value.onPageChange === 'function');
}

function formatHeaderMeta(value, labels = {}) {
  if (!value && value !== 0) return '';
  if (typeof value !== 'string' && typeof value !== 'number') return value;
  const text = String(value).trim();
  if (!text) return '';
  if (/^\d+$/.test(text)) return `${text} ${labels.recordsLabel || 'записи'}`;
  return text;
}

const Workspace = forwardRef(function Workspace({
  source,
  externalData,
  externalMeta,
  externalLoading,
  externalError,
  onExternalRefetch,
  query,
  onQueryChange,
  defaultQuery = {},
  transformItems,
  clientPaginate = false,
  title,
  subtitle,
  badge,
  actions,
  controls = [],
  filterControls = [],
  rows,
  columns = [],
  rowActions,
  normalizeColumnState,
  getVisibleColumns,
  storageKey,
  loading = false,
  error = null,
  errorState,
  emptyState,
  loadingState,
  guardState,
  onRetry,
  renderCell,
  getRowId,
  getRowKey,
  selectedRowId,
  selectedRowIdFallback,
  onRowClick,
  onRowKeyDown,
  labels = {},
  sortKey,
  sortDir,
  onSort,
  onRefetch,
  pagination,
  columnState: controlledColumnState,
  onColumnStateChange,
  columnWidths,
  columnOrder,
  columnVisibility,
  onColumnResize,
  onColumnOrderChange,
  onColumnVisibilityChange,
  emptyStateText,
  emptyStateContent,
}, ref) {
  const workspaceData = useData({
    source,
    externalData,
    externalMeta,
    externalLoading,
    externalError,
    onExternalRefetch,
    query,
    onQueryChange,
    defaultQuery,
    transformItems,
    clientPaginate,
  });
  const hasProvidedRows = Array.isArray(rows);
  const effectiveRows = hasProvidedRows ? rows : workspaceData.rows;
  const effectiveLoading = hasProvidedRows ? loading : workspaceData.loading;
  const effectiveError = hasProvidedRows ? error : workspaceData.error;
  const effectiveRefetch = onRefetch || workspaceData.refetch;
  const effectiveSortKey = sortKey || workspaceData.query.sort;
  const effectiveSortDir = sortDir || workspaceData.query.dir;
  const effectiveOnSort = onSort || workspaceData.setSort;
  const dataPagination = !hasProvidedRows && pagination !== false
    ? workspaceData.pagination
    : null;
  const effectivePagination = pagination === undefined ? dataPagination : pagination;
  const effectivePaginationModel = isPaginationModel(effectivePagination) ? effectivePagination : null;
  const effectivePaginationNode = effectivePaginationModel
    ? <Pagination {...effectivePaginationModel} />
    : effectivePagination;
  const normalizeState = useMemo(
    () => normalizeColumnState || IDENTITY_COLUMN_STATE,
    [normalizeColumnState]
  );
  const legacyColumnState = useMemo(
    () => toColumnState({ columnWidths, columnOrder, columnVisibility }),
    [columnOrder, columnVisibility, columnWidths]
  );
  const legacyColumnStateChange = useMemo(
    () => createColumnStateHandler({
      onColumnResize,
      onColumnOrderChange,
      onColumnVisibilityChange,
    }),
    [onColumnOrderChange, onColumnResize, onColumnVisibilityChange]
  );
  const effectiveControlledColumnState = typeof controlledColumnState !== 'undefined'
    ? controlledColumnState
    : (legacyColumnStateChange ? legacyColumnState : undefined);
  const effectiveOnColumnStateChange = onColumnStateChange || legacyColumnStateChange;
  const isColumnStateControlled = typeof effectiveControlledColumnState !== 'undefined';
  const [internalColumnState, setInternalColumnState] = useState(() => getStoredColumnState(storageKey, normalizeState));
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [technicalColumnsOpen, setTechnicalColumnsOpen] = useState(false);

  const columnState = isColumnStateControlled ? effectiveControlledColumnState : internalColumnState;
  const normalizedColumnState = useMemo(
    () => normalizeState(columnState),
    [columnState, normalizeState]
  );
  const workspaceColumns = useMemo(() => {
    const baseColumns = (Array.isArray(columns) ? columns : [])
      .filter((column) => column?.key)
      .map((column) => ({
        ...column,
        fallbackLabel: column.fallbackLabel || column.title || column.label || column.key,
      }));
    if (typeof rowActions !== 'function') return baseColumns;
    return [
      ...baseColumns,
      {
        key: 'actions',
        fallbackLabel: labels.actions || 'Actions',
        width: 170,
        minWidth: 150,
        maxWidth: 240,
        category: 'context',
        required: true,
        render: rowActions,
      },
    ];
  }, [columns, labels.actions, rowActions]);
  const normalizedColumns = useMemo(
    () => workspaceColumns.map(normalizeWorkspaceColumn),
    [workspaceColumns]
  );
  const visibleColumns = useMemo(
    () => (getVisibleColumns
      ? getVisibleColumns(normalizedColumnState).map(normalizeWorkspaceColumn)
      : applyDefaultColumnState(normalizedColumns, normalizedColumnState)),
    [getVisibleColumns, normalizedColumnState, normalizedColumns]
  );
  const tableWidth = useMemo(
    () => visibleColumns.reduce((sum, column) => sum + Number(column.width || 0), 0),
    [visibleColumns]
  );
  const columnGroups = useMemo(() => {
    const preferredOrder = [
      'core',
      'default',
      'business',
      'logistics',
      'operational',
      'custom',
      'context',
      'system',
    ];
    const groups = new Map();
    const technicalColumns = [];
    normalizedColumns.forEach((column) => {
      const key = column.category || 'core';
      if (key === 'technical') {
        technicalColumns.push(column);
        return;
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(column);
    });
    const visibleGroups = [...groups.entries()]
      .sort(([left], [right]) => {
        const leftIndex = preferredOrder.indexOf(left);
        const rightIndex = preferredOrder.indexOf(right);
        if (leftIndex !== -1 || rightIndex !== -1) {
          return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
        }
        return left.localeCompare(right);
      })
      .map(([key, columns]) => ({ key, columns }));
    return { visibleGroups, technicalColumns };
  }, [normalizedColumns]);

  const saveColumnState = useCallback((updater) => {
    const current = isColumnStateControlled ? normalizedColumnState : internalColumnState;
    const next = normalizeState(typeof updater === 'function' ? updater(current) : updater);
    persistColumnState(storageKey, next);
    effectiveOnColumnStateChange?.(next);
    if (!isColumnStateControlled) setInternalColumnState(next);
  }, [
    effectiveOnColumnStateChange,
    internalColumnState,
    isColumnStateControlled,
    normalizeState,
    normalizedColumnState,
    storageKey,
  ]);

  const resetColumns = useCallback(() => {
    const next = normalizeState({});
    persistColumnState(storageKey, next);
    effectiveOnColumnStateChange?.(next);
    if (!isColumnStateControlled) setInternalColumnState(next);
  }, [effectiveOnColumnStateChange, isColumnStateControlled, normalizeState, storageKey]);

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
      visibility: Object.fromEntries(normalizedColumns.map((column) => [column.key, true])),
    }));
  }, [normalizedColumns, saveColumnState]);

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
      const order = Array.isArray(current.order) ? current.order.slice() : visibleColumns.map((column) => column.key);
      const fromIndex = order.indexOf(fromKey);
      const toIndex = order.indexOf(toKey);
      if (fromIndex < 0 || toIndex < 0) return current;
      const [moved] = order.splice(fromIndex, 1);
      order.splice(toIndex, 0, moved);
      return { ...current, order };
    });
  }, [saveColumnState, visibleColumns]);

  const renderState = () => {
    if (effectiveLoading) {
      return (
        <WorkspaceLoadingState
          title={loadingState?.title || labels.loading || 'Loading'}
          rows={loadingState?.rows || 6}
        />
      );
    }
    if (effectiveError) {
      return (
        <WorkspaceErrorState
          title={errorState?.title || labels.errorTitle || 'Failed to load'}
          description={errorState?.description}
          retryLabel={errorState?.retryLabel || labels.retry || 'Retry'}
          onRetry={onRetry}
        />
      );
    }
    if (guardState) {
      return (
        <WorkspaceEmptyState
          title={guardState.title}
          description={guardState.description}
          action={guardState.action}
        />
      );
    }
    if (!effectiveRows.length) {
      if (emptyStateContent) return emptyStateContent;
      return (
        <WorkspaceEmptyState
          title={emptyState?.title || emptyStateText || labels.emptyTitle || 'No data'}
          description={emptyState?.description}
          action={emptyState?.action}
        />
      );
    }
    return null;
  };

  const state = renderState();
  const shouldRenderTable = !effectiveLoading && !effectiveError && !guardState && effectiveRows.length > 0;

  useImperativeHandle(ref, () => ({
    refetch: effectiveRefetch || (() => {}),
  }), [effectiveRefetch]);

  const generatedControls = useMemo(
    () => filterControls
      .map((control) => ({
        key: control.key || control.label || control.type,
        kind: control.type === 'search' ? 'search' : control.kind,
        icon: control.icon,
        label: control.label || (control.type === 'search' ? labels.search || 'Search' : ''),
        control: buildFilterControl(control, workspaceData.query, workspaceData.replaceQuery),
      }))
      .filter((control) => control.control),
    [filterControls, labels.search, workspaceData.query, workspaceData.replaceQuery]
  );
  const effectiveControls = controls.length ? controls : generatedControls;
  const effectiveRenderCell = useCallback((row, column) => {
    if (typeof renderCell === 'function') return renderCell(row, column);
    if (typeof column.render === 'function') return column.render(row);
    return renderValue(row?.[column.key]);
  }, [renderCell]);
  const pageSizeOptions = effectivePaginationModel?.limitOptions || DEFAULT_PAGE_SIZE_OPTIONS;
  const pageSizeValue = Math.max(1, Number(effectivePaginationModel?.limit) || 25);
  const canChangePageSize = Boolean(effectivePaginationModel?.onLimitChange);
  const headerMeta = formatHeaderMeta(badge, labels);

  return (
    <div className={s.workspace}>
      <header className={s.topbar}>
        <div className={s.headerMain}>
          <h1>{title}</h1>
          <div className={s.subtitleRow}>
            {subtitle ? <p>{subtitle}</p> : null}
            {headerMeta ? <span className={s.countText}>{headerMeta}</span> : null}
          </div>
        </div>
        {actions ? <div className={s.actions}>{actions}</div> : null}
      </header>

      <section className={s.controls} aria-label={labels.controlsAria || 'Workspace controls'}>
        {effectiveControls.map((control) => (
          <FilterBox
            key={control.key}
            icon={control.icon}
            label={control.label}
            kind={control.kind}
          >
            {control.control}
          </FilterBox>
        ))}
        <button type="button" className={s.resetColumnsButton} onClick={resetColumns}>
          <RefreshCcw size={14} aria-hidden="true" />
          <span>{labels.resetColumns || 'Reset columns'}</span>
        </button>
        {canChangePageSize ? (
          <div className={s.pageSizeTopControl}>
            <span className={s.pageSizeTopLabel}>{labels.pageSize || 'На странице'}</span>
            <SelectField
              value={pageSizeValue}
              onValueChange={(value) => effectivePaginationModel.onLimitChange?.(Number(value))}
              options={pageSizeOptions.map((value) => ({ value, label: String(value) }))}
              placeholder={String(pageSizeValue)}
              size="sm"
              inputClassName={s.pageSizeTopSelect}
              contentClassName={s.controlSelectContent}
              fullWidth={false}
            />
          </div>
        ) : null}
        <ColumnMenu
          open={columnsOpen}
          onToggle={() => setColumnsOpen((current) => !current)}
          groups={columnGroups.visibleGroups}
          technicalColumns={columnGroups.technicalColumns}
          technicalOpen={technicalColumnsOpen}
          onToggleTechnical={() => setTechnicalColumnsOpen((current) => !current)}
          visibleCount={visibleColumns.length}
          columnState={normalizedColumnState}
          labels={labels}
          onSetColumnVisibility={setColumnVisibility}
          onShowAll={showAllColumns}
          onReset={resetColumns}
        />
      </section>

      <main className={s.content}>
        {state}
        {shouldRenderTable ? (
          <Table
            rows={effectiveRows}
            columns={visibleColumns}
            tableWidth={tableWidth}
            renderCell={effectiveRenderCell}
            getRowId={getRowId}
            getRowKey={getRowKey}
            selectedRowId={selectedRowId}
            selectedRowIdFallback={selectedRowIdFallback}
            onRowClick={onRowClick}
            onRowKeyDown={onRowKeyDown}
            onResizeColumn={resizeColumn}
            onMoveColumn={moveColumn}
            sortKey={effectiveSortKey}
            sortDir={effectiveSortDir}
            onSort={effectiveOnSort}
            labels={labels}
          />
        ) : null}
        {effectivePaginationNode ? effectivePaginationNode : null}
      </main>
    </div>
  );
});

export default Workspace;
