import React, { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useListWorkspaceViewsQuery } from '../../../store/rtk/workspaceViewsApi';
import { buildViewUrl, resolveActiveView } from '../../../utils/workspaceViews';
import { buildWmsDocumentsFilterFromUrl } from '../../../utils/workspaceViewsWmsDocumentsFilter';
import {
  closeManageDrawer,
  selectManageDrawerModule,
} from '../../../store/slices/workspaceViewsDrawerSlice';
import WorkspaceViewsDrawer from '../../../components/common/WorkspaceViews/WorkspaceViewsDrawer';
import WorkspaceViewEditor from '../../../components/common/WorkspaceViews/WorkspaceViewEditor';
import ComingSoonPage from '../../../components/common/ComingSoonPage/ComingSoonPage';

// Workspace Views Phase 4 — adds the "Save current filters as a personal view" flow.
// The page owns the editor state because we need to snapshot the current URL filters
// at the moment the user clicks "+" (in the picker) or "Create new view" (in the drawer).

const UnifiedDocumentsView = lazy(() => import('./UnifiedDocumentsView'));
const CycleCountsListPage = lazy(() => import('../CycleCountsListPage'));

const Loader = (
  <div style={{ padding: 24, color: 'var(--ui-text-2)' }}>Loading…</div>
);

const MODULE = 'wms.documents';
const ROUTE_BASE = '/main/wms/documents';

export default function WmsDocumentsPage() {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const drawerOpenModule = useSelector(selectManageDrawerModule);
  const drawerOpen = drawerOpenModule === MODULE;
  const viewParam = (searchParams.get('view') || '').toLowerCase();
  const viewIdParam = searchParams.get('viewId') || null;

  const { data: viewsResp } = useListWorkspaceViewsQuery({ module: MODULE });
  const views = useMemo(
    () => (Array.isArray(viewsResp?.data) ? viewsResp.data : []),
    [viewsResp]
  );
  const activeView = useMemo(
    () => resolveActiveView(views, viewIdParam, viewParam || null),
    [views, viewIdParam, viewParam]
  );

  // Editor state — `editorFilter` is the snapshot the editor renders as chips. We
  // snapshot at open time so a quick URL change while the modal is open doesn't
  // mutate the saved filter under the user.
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorFilter, setEditorFilter] = useState({ where: [] });

  const openEditor = useCallback(() => {
    setEditorFilter(buildWmsDocumentsFilterFromUrl(searchParams));
    setEditorOpen(true);
  }, [searchParams]);
  const closeEditor = useCallback(() => setEditorOpen(false), []);

  // After successful create: close the editor and navigate to the new personal view.
  // The picker / sidebar / drawer all refresh via the LIST tag invalidation in the
  // createWorkspaceView mutation.
  const onCreated = useCallback((created) => {
    setEditorOpen(false);
    if (created && created.id) {
      navigate(buildViewUrl(ROUTE_BASE, created));
    }
  }, [navigate]);

  const drawer = (
    <WorkspaceViewsDrawer
      module={MODULE}
      open={drawerOpen}
      onClose={() => dispatch(closeManageDrawer())}
      onCreate={openEditor}
    />
  );

  const editor = (
    <WorkspaceViewEditor
      open={editorOpen}
      module={MODULE}
      initialFilter={editorFilter}
      onClose={closeEditor}
      onCreated={onCreated}
    />
  );

  // Legacy placeholder views are still reachable via ?view=. We don't seed them as
  // system views in MVP, so they won't normally appear in the workspace_views list —
  // but if a stale bookmark hits the page we still serve a reasonable response.
  if (viewParam === 'inventory') {
    return (
      <>
        <Suspense fallback={Loader}><CycleCountsListPage /></Suspense>
        {drawer}
        {editor}
      </>
    );
  }
  if (viewParam === 'returns') {
    const placeholderTitle = t(`wmsViews.${viewParam}`, viewParam.toUpperCase());
    return (
      <>
        <ComingSoonPage
          title={placeholderTitle}
          moduleName={`wms.documents.${viewParam}`}
          descriptionKey="wmsViews.placeholderDescription"
        />
        {drawer}
        {editor}
      </>
    );
  }

  return (
    <>
      <Suspense fallback={Loader}>
        <UnifiedDocumentsView
          module={MODULE}
          routeBase={ROUTE_BASE}
          activeView={activeView}
          onCreateView={openEditor}
        />
      </Suspense>
      {drawer}
      {editor}
    </>
  );
}
