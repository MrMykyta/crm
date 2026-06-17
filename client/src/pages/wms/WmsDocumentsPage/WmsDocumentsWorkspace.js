import { useCallback, useMemo, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import AddButton from '../../../components/buttons/AddButton/AddButton';
import {
  WmsEmptyState,
  WmsErrorState,
  WmsLoadingState,
  WmsStatusChip,
} from '../../../components/wms/ui';
import {
  useListCycleCountsQuery,
  useListWarehouseDocumentsQuery,
} from '../../../store/rtk/wmsDocumentsApi';
import {
  WMS_DOCUMENT_TYPES,
  getWmsDocumentCreateRoute,
} from '../navigation/wmsUiNavigation';
import {
  buildDocumentsWorkspaceRows,
  getCycleCountsQuery,
  getDocumentsWorkspaceView,
  getWarehouseDocumentsQuery,
  shouldFetchCycleCounts,
  shouldFetchWarehouseDocuments,
} from './wmsDocumentsWorkspaceModel';
import s from './WmsDocumentsWorkspace.module.css';

const WORKFLOW_VIEWS = [
  { key: 'all', label: 'All Documents', to: '/main/wms/documents' },
  { key: 'drafts', label: 'Drafts', to: '/main/wms/documents?status=draft' },
  { key: 'needs-action', label: 'Needs Action', to: '/main/wms/documents?view=needs-action' },
  { key: 'posted-today', label: 'Posted Today', to: '/main/wms/documents?view=posted-today' },
];

const TYPE_VIEWS = WMS_DOCUMENT_TYPES.map((type) => ({
  key: type,
  label: type,
  to: `/main/wms/documents?type=${type}`,
}));

const STATUS_FILTERS = ['', 'draft', 'packing', 'counting', 'received', 'shipped', 'posted', 'reconciled'];

function rowsFromWarehouseDocumentsResponse(data) {
  return Array.isArray(data?.data) ? data.data : [];
}

function rowsFromListResponse(data) {
  return Array.isArray(data?.items) ? data.items : [];
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

function TypePicker({ open, onCreate }) {
  if (!open) return null;
  return (
    <div className={s.typePicker} role="menu" aria-label="Document type">
      {WMS_DOCUMENT_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          className={s.typePickerItem}
          onClick={() => onCreate(type)}
          role="menuitem"
        >
          <strong>{type}</strong>
          <span>{type === 'CC' ? 'Cycle Count' : 'Warehouse document'}</span>
        </button>
      ))}
    </div>
  );
}

function TypeBadge({ type }) {
  return <span className={s.typeBadge}>{type || '-'}</span>;
}

export default function WmsDocumentsWorkspace() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);

  const view = useMemo(() => getDocumentsWorkspaceView(searchParams), [searchParams]);
  const search = searchParams.get('search') || searchParams.get('q') || '';
  const selectedStatus = searchParams.get('status') || '';

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
  const createLabel = view.type ? `Create ${view.type}` : t('wms.documents.actions.create', 'Create Document');

  const onCreateType = useCallback((type) => {
    const route = getWmsDocumentCreateRoute(type);
    if (!route) return;
    setPickerOpen(false);
    navigate(route);
  }, [navigate]);

  const onCreate = useCallback(() => {
    if (createRoute) {
      navigate(createRoute);
      return;
    }
    setPickerOpen((current) => !current);
  }, [createRoute, navigate]);

  const retry = useCallback(() => {
    if (fetchDocuments) documentsQuery.refetch();
    if (fetchCycleCounts) cycleCountsQuery.refetch();
  }, [cycleCountsQuery, documentsQuery, fetchCycleCounts, fetchDocuments]);

  return (
    <div className={s.workspace}>
      <header className={s.topbar}>
        <div>
          <h1>Documents</h1>
          <p>Warehouse document workspace</p>
        </div>
        <div className={s.actions}>
          <div className={s.createWrap}>
            <AddButton onClick={onCreate}>{createLabel}</AddButton>
            <TypePicker open={pickerOpen} onCreate={onCreateType} />
          </div>
        </div>
      </header>

      <section className={s.controls} aria-label="Document controls">
        <label className={s.searchBox}>
          <Search size={16} aria-hidden="true" />
          <input
            value={search}
            placeholder="Search documents"
            onChange={(event) => setParam(searchParams, navigate, 'search', event.target.value)}
          />
        </label>
        <label className={s.filterBox}>
          <SlidersHorizontal size={16} aria-hidden="true" />
          <span>Status</span>
          <select
            value={selectedStatus}
            onChange={(event) => setParam(searchParams, navigate, 'status', event.target.value)}
          >
            {STATUS_FILTERS.map((status) => (
              <option key={status || 'all'} value={status}>
                {status ? t(`statuses.${status}`, status) : 'All'}
              </option>
            ))}
          </select>
        </label>
      </section>

      <nav className={s.viewSwitcher} aria-label="Document views">
        <div className={s.viewGroup}>
          <span>Views</span>
          {WORKFLOW_VIEWS.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              className={`${s.viewButton} ${view.key === item.key ? s.active : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className={s.viewGroup}>
          <span>Types</span>
          {TYPE_VIEWS.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              className={`${s.viewButton} ${view.key === item.key ? s.active : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <main className={s.content}>
        {loading ? (
          <WmsLoadingState title="Loading documents" rows={6} />
        ) : null}

        {!loading && error ? (
          <WmsErrorState
            title="Failed to load documents"
            description={getErrorText(error)}
            onRetry={retry}
          />
        ) : null}

        {!loading && !error && rows.length === 0 ? (
          <WmsEmptyState
            title="No documents found"
            description="Adjust search or filters, or create a new WMS document."
            action={<AddButton onClick={onCreate}>{createLabel}</AddButton>}
          />
        ) : null}

        {!loading && !error && rows.length > 0 ? (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Number</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Warehouse</th>
                  <th>Lines</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.type}:${row.id}`}>
                    <td><TypeBadge type={row.type} /></td>
                    <td>
                      <button
                        type="button"
                        className={s.linkCell}
                        onClick={() => row.route && navigate(row.route)}
                      >
                        <strong>{row.number || '-'}</strong>
                        <span>{row.id || ''}</span>
                      </button>
                    </td>
                    <td>
                      <WmsStatusChip status={row.status} size="sm">
                        {t(`statuses.${String(row.status || '').toLowerCase()}`, row.status || '-')}
                      </WmsStatusChip>
                    </td>
                    <td>{formatDate(row.date, i18n.language)}</td>
                    <td>{row.warehouse || '-'}</td>
                    <td className={s.numeric}>{row.lines ?? 0}</td>
                    <td className={s.numeric}>{row.quantity || '-'}</td>
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
