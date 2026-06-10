import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import ListPage from '../../../components/data/ListPage';
import FilterToolbar from '../../../components/filters/FilterToolbar';
import AddButton from '../../../components/buttons/AddButton/AddButton';
import WorkspaceViewsDrawer from '../../../components/common/WorkspaceViews/WorkspaceViewsDrawer';
import WorkspaceViewEditor from '../../../components/common/WorkspaceViews/WorkspaceViewEditor';
import WorkspaceViewPicker from '../../../components/common/WorkspaceViews/WorkspaceViewPicker';
import useGridPrefs from '../../../hooks/useGridPrefs';
import { useListWarehouseDocumentsQuery } from '../../../store/rtk/wmsDocumentsApi';
import { useListWorkspaceViewsQuery } from '../../../store/rtk/workspaceViewsApi';
import {
  closeManageDrawer,
  selectManageDrawerModule,
} from '../../../store/slices/workspaceViewsDrawerSlice';
import { buildViewUrl, resolveActiveView } from '../../../utils/workspaceViews';
import {
  buildWmsDocumentsFilterFromState,
  mapWmsDocumentsFilter,
} from '../../../utils/workspaceViewsWmsDocumentsFilter';
import { createWmsDocumentsColumns } from '../../../components/data/ListPage/columnSchemas/wmsDocumentsColumns';
import s from './WmsDocumentsPage.module.css';

const MODULE = 'wms.documents';
const ROUTE_BASE = '/main/wms/documents';
const DOCUMENT_TYPES = ['', 'PZ', 'WZ', 'MM', 'RW', 'PW', 'PZK', 'WZK'];
const STATUS_OPTIONS = ['', 'draft', 'received', 'putaway', 'packing', 'shipped', 'cancelled', 'in_transit', 'posted'];
const CREATE_OPTIONS = [
  { type: 'PZ', to: '/main/wms/receipts/new' },
  { type: 'MM', to: '/main/wms/transfers/new' },
  { type: 'RW', to: '/main/wms/adjustments/new' },
  { type: 'PW', to: '/main/wms/adjustments/new' },
];

function normalizePageQuery(query = {}) {
  return {
    page: Number(query.page) > 0 ? Number(query.page) : 1,
    limit: Number(query.limit) > 0 ? Number(query.limit) : 25,
    sort: query.sort || 'date',
    dir: query.dir === 'ASC' ? 'ASC' : 'DESC',
    search: query.search || undefined,
    type: query.type || undefined,
    status: query.status || undefined,
    warehouseId: query.warehouseId || undefined,
    dateFrom: query.dateFrom || undefined,
    dateTo: query.dateTo || undefined,
  };
}

function queryFromSearchParams(searchParams) {
  return normalizePageQuery({
    page: searchParams.get('page') || 1,
    limit: searchParams.get('limit') || 25,
    search: searchParams.get('search') || searchParams.get('q') || undefined,
    type: searchParams.get('type') || undefined,
    status: searchParams.get('status') || undefined,
    warehouseId: searchParams.get('warehouseId') || undefined,
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
  });
}

function adaptWarehouseDocumentsResponse(data, fallbackQuery) {
  const items = Array.isArray(data?.data) ? data.data : [];
  const pagination = data?.pagination || {};
  return {
    items,
    total: Number(pagination.total ?? items.length ?? 0),
    page: Number(pagination.page ?? fallbackQuery.page ?? 1),
    limit: Number(pagination.limit ?? fallbackQuery.limit ?? 25),
  };
}

function CreateDocumentMenu({ t, onCreate }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onMouseDown = (event) => {
      if (wrapRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className={s.createMenuWrap} ref={wrapRef}>
      <AddButton onClick={() => setOpen((current) => !current)}>
        {t('wms.documents.actions.create')}
      </AddButton>
      {open ? (
        <div className={s.createMenu} role="menu">
          {CREATE_OPTIONS.map((option) => (
            <button
              key={option.type}
              type="button"
              className={s.createMenuItem}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onCreate(option.to);
              }}
            >
              {t(`wms.documents.createTypes.${option.type}`, option.type)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function WmsDocumentsPage() {
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const drawerOpenModule = useSelector(selectManageDrawerModule);
  const drawerOpen = drawerOpenModule === MODULE;
  const viewParam = (searchParams.get('view') || '').toLowerCase();
  const viewIdParam = searchParams.get('viewId') || null;

  const [query, setQuery] = useState(() => queryFromSearchParams(searchParams));
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorFilter, setEditorFilter] = useState({ where: [] });
  const appliedViewRef = useRef('');

  const {
    colWidths,
    colOrder,
    colVisibility,
    onColumnResize,
    onColumnOrderChange,
    onColumnVisibilityChange,
    resetGridPrefs,
  } = useGridPrefs(MODULE);

  const { data: viewsResp } = useListWorkspaceViewsQuery({ module: MODULE });
  const views = useMemo(
    () => (Array.isArray(viewsResp?.data) ? viewsResp.data : []),
    [viewsResp]
  );
  const activeView = useMemo(
    () => resolveActiveView(views, viewIdParam, viewParam || null),
    [views, viewIdParam, viewParam]
  );

  const activeViewFilterParams = useMemo(
    () => mapWmsDocumentsFilter(activeView?.filter),
    [activeView]
  );

  useEffect(() => {
    if (!activeView) return;
    const activeKey = `${activeView.id || activeView.key || ''}:${JSON.stringify(activeViewFilterParams)}`;
    if (appliedViewRef.current === activeKey) return;
    appliedViewRef.current = activeKey;
    setQuery((current) => normalizePageQuery({
      ...current,
      page: 1,
      search: undefined,
      type: undefined,
      status: undefined,
      warehouseId: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      ...activeViewFilterParams,
    }));
  }, [activeView, activeViewFilterParams]);

  const listQuery = useMemo(() => normalizePageQuery(query), [query]);
  const { data, isFetching, error, refetch } = useListWarehouseDocumentsQuery(listQuery);
  const adapted = useMemo(
    () => adaptWarehouseDocumentsResponse(data, listQuery),
    [data, listQuery]
  );

  const openDetail = useCallback(
    (row) => {
      const route = row?.route;
      if (!route) return;
      navigate(route);
    },
    [navigate]
  );

  const columns = useMemo(
    () => createWmsDocumentsColumns({ onOpenDetail: openDetail, t, locale: i18n.language }),
    [openDetail, t, i18n.language]
  );

  const typeOptions = useMemo(
    () => DOCUMENT_TYPES.map((value) => ({
      value,
      label: value ? t(`wms.documents.types.${value}`, value) : t('common.all'),
    })),
    [t]
  );

  const statusOptions = useMemo(
    () => STATUS_OPTIONS.map((value) => ({
      value,
      label: value ? t(`statuses.${value}`, value) : t('common.all'),
    })),
    [t]
  );

  const openEditor = useCallback(() => {
    setEditorFilter(buildWmsDocumentsFilterFromState(listQuery));
    setEditorOpen(true);
  }, [listQuery]);

  const closeEditor = useCallback(() => setEditorOpen(false), []);

  const onCreated = useCallback((created) => {
    setEditorOpen(false);
    if (created && created.id) {
      navigate(buildViewUrl(ROUTE_BASE, created));
    }
  }, [navigate]);

  const activeViewId = activeView?.id || null;
  const activeViewKey = activeView?.scope === 'system' ? activeView?.key || null : null;

  return (
    <>
      <ListPage
        source="wmsDocuments"
        externalData={adapted.items}
        externalMeta={{ total: adapted.total, page: adapted.page, limit: adapted.limit }}
        externalLoading={isFetching}
        externalError={error}
        onExternalRefetch={refetch}
        query={listQuery}
        onQueryChange={(next) => setQuery(normalizePageQuery(next))}
        columns={columns}
        defaultQuery={{ sort: 'date', dir: 'DESC', limit: 25 }}
        emptyStateText={t('wms.documents.empty')}
        actions={<CreateDocumentMenu t={t} onCreate={navigate} />}
        columnWidths={colWidths}
        onColumnResize={onColumnResize}
        columnOrder={colOrder}
        onColumnOrderChange={onColumnOrderChange}
        columnVisibility={colVisibility}
        onColumnVisibilityChange={onColumnVisibilityChange}
        onResetColumns={resetGridPrefs}
        enableSavedViews={false}
        dynamicColumnsMode="none"
        ToolbarComponent={(props) => (
          <FilterToolbar
            {...props}
            controls={[
              {
                type: 'search',
                key: 'search',
                placeholder: t('wms.documents.search'),
                debounce: 350,
              },
              {
                type: 'select',
                key: 'type',
                label: t('wms.documents.filters.type'),
                options: typeOptions,
              },
              {
                type: 'select',
                key: 'status',
                label: t('common.status'),
                options: statusOptions,
              },
            ]}
            extra={(
              <WorkspaceViewPicker
                module={MODULE}
                routeBase={ROUTE_BASE}
                activeViewId={activeViewId}
                activeViewKey={activeViewKey}
                onCreateView={openEditor}
              />
            )}
          />
        )}
      />

      <WorkspaceViewsDrawer
        module={MODULE}
        open={drawerOpen}
        onClose={() => dispatch(closeManageDrawer())}
        onCreate={openEditor}
      />
      <WorkspaceViewEditor
        open={editorOpen}
        module={MODULE}
        initialFilter={editorFilter}
        onClose={closeEditor}
        onCreated={onCreated}
      />
    </>
  );
}
