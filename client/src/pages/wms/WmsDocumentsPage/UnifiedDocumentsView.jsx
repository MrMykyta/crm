import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useListWarehouseDocumentsQuery } from '../../../store/rtk/wmsDocumentsApi';
import WorkspaceViewPicker from '../../../components/common/WorkspaceViews/WorkspaceViewPicker';
import { mapWmsDocumentsFilter } from '../../../utils/workspaceViewsWmsDocumentsFilter';
import s from './UnifiedDocumentsView.module.css';

// Unified PZ/WZ/MM/RW/PW table behind `/main/wms/documents`. The workspace view
// resolved by the parent controls which subset is shown via filter→params mapping.

const TYPE_BADGE_CLASS = {
  PZ: 'badgePz',
  WZ: 'badgeWz',
  MM: 'badgeMm',
  RW: 'badgeRw',
  PW: 'badgePw',
  PZK: 'badgePzk',
  WZK: 'badgeWzk',
};

function formatDate(value, locale) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(locale || undefined, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date(value).toISOString().slice(0, 16).replace('T', ' ');
  }
}

function formatNumber(value) {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 3 }).format(n);
}

function renderWarehouseCell(row) {
  if (row.type === 'MM') {
    const src = row.sourceWarehouseCode || row.sourceWarehouseId || '—';
    const tgt = row.targetWarehouseCode || row.targetWarehouseId || '—';
    return (
      <span className={s.warehouseFlow}>
        <span>{src}</span>
        <span className={s.warehouseArrow}>→</span>
        <span>{tgt}</span>
      </span>
    );
  }
  return <span>{row.warehouseCode || '—'}</span>;
}

export default function UnifiedDocumentsView({ module, routeBase, activeView, onCreateView }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingSearch, setPendingSearch] = useState(searchParams.get('q') || '');

  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
  const limit = Math.max(
    10,
    Math.min(200, Number.parseInt(searchParams.get('limit') || '50', 10) || 50)
  );
  const q = searchParams.get('q') || undefined;

  // Translate the active workspace view's filter into list query params.
  // Page-level `q` (free-text search) overrides any `search` baked into the view.
  const viewFilterParams = useMemo(
    () => mapWmsDocumentsFilter(activeView?.filter),
    [activeView]
  );

  const queryArgs = useMemo(
    () => ({
      page,
      limit,
      ...viewFilterParams,
      ...(q ? { search: q } : {}),
    }),
    [page, limit, viewFilterParams, q]
  );

  const { data, isFetching, isError, error } = useListWarehouseDocumentsQuery(queryArgs);

  const rows = Array.isArray(data?.data) ? data.data : [];
  const total = data?.pagination?.total ?? 0;
  const pageCount = data?.pagination?.pageCount ?? 1;

  const onSearchSubmit = (e) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (pendingSearch.trim()) next.set('q', pendingSearch.trim());
    else next.delete('q');
    next.set('page', '1');
    setSearchParams(next, { replace: false });
  };

  const goToPage = (nextPage) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextPage));
    setSearchParams(next, { replace: false });
  };

  const headers = useMemo(
    () => [
      { key: 'type', label: t('wmsDocsList.cols.type', 'Type') },
      { key: 'number', label: t('wmsDocsList.cols.number', 'Number') },
      { key: 'date', label: t('wmsDocsList.cols.date', 'Date') },
      { key: 'status', label: t('wmsDocsList.cols.status', 'Status') },
      { key: 'warehouse', label: t('wmsDocsList.cols.warehouse', 'Warehouse') },
      { key: 'itemsCount', label: t('wmsDocsList.cols.itemsCount', 'Lines') },
      { key: 'totalQty', label: t('wmsDocsList.cols.totalQty', 'Qty') },
    ],
    [t]
  );

  const activeViewId = activeView?.id || null;
  const activeViewKey = activeView?.scope === 'system' ? activeView?.key || null : null;

  return (
    <div className={s.wrap}>
      <header className={s.header}>
        <div className={s.headerLeft}>
          <h1 className={s.title}>{t('wmsViews.popoverTitle', 'Warehouse documents')}</h1>
          <p className={s.subtitle}>
            {t(
              'wmsDocsList.subtitle',
              'Unified view across PZ / WZ / MM / RW / PW. Use the Workspace Views picker to filter by document type.'
            )}
          </p>
          <WorkspaceViewPicker
            module={module}
            routeBase={routeBase}
            activeViewId={activeViewId}
            activeViewKey={activeViewKey}
            onCreateView={onCreateView}
          />
        </div>
        <form className={s.searchForm} onSubmit={onSearchSubmit}>
          <input
            className={s.searchInput}
            type="search"
            placeholder={t('wmsDocsList.searchPlaceholder', 'Search by number…')}
            value={pendingSearch}
            onChange={(e) => setPendingSearch(e.target.value)}
            aria-label="Search documents"
          />
          <button type="submit" className={s.searchBtn}>
            {t('common.search', 'Search')}
          </button>
        </form>
      </header>

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h.key} className={s.th}>{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isFetching && rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className={s.muted}>
                  {t('common.loading', 'Loading…')}
                </td>
              </tr>
            ) : null}
            {isError ? (
              <tr>
                <td colSpan={headers.length} className={s.error}>
                  {error?.data?.message
                    || error?.error
                    || t('common.errorGeneric', 'Failed to load documents')}
                </td>
              </tr>
            ) : null}
            {!isFetching && !isError && rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className={s.muted}>
                  {t('wmsDocsList.empty', 'No documents in this view')}
                </td>
              </tr>
            ) : null}
            {rows.map((row) => {
              const badgeClass = TYPE_BADGE_CLASS[row.type] || 'badgeDefault';
              const dest = row.route || '#';
              return (
                <tr
                  key={`${row.type}:${row.id}`}
                  className={s.row}
                  onClick={() => dest && dest !== '#' && navigate(dest)}
                >
                  <td className={s.td}>
                    <span className={s.typeCell}>
                      <span className={`${s.badge} ${s[badgeClass]}`}>{row.type}</span>
                      {row.documentRelation === 'correction' ? (
                        <span className={s.relationBadge}>
                          {t('wmsDocsList.relation.correction', 'Correction')}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className={s.td}>
                    {dest && dest !== '#' ? (
                      <Link
                        to={dest}
                        className={s.numberLink}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {row.number || '—'}
                      </Link>
                    ) : (
                      <span>{row.number || '—'}</span>
                    )}
                  </td>
                  <td className={s.td}>{formatDate(row.date, i18n.language)}</td>
                  <td className={s.td}>
                    <span className={s.status}>{row.status || '—'}</span>
                  </td>
                  <td className={s.td}>{renderWarehouseCell(row)}</td>
                  <td className={`${s.td} ${s.tdNum}`}>{row.itemsCount ?? 0}</td>
                  <td className={`${s.td} ${s.tdNum}`}>{formatNumber(row.totalQty)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {total > 0 ? (
        <footer className={s.footer}>
          <span className={s.footerInfo}>
            {t('wmsDocsList.paginationCount', {
              defaultValue: '{{from}}–{{to}} of {{total}}',
              from: (page - 1) * limit + 1,
              to: Math.min(page * limit, total),
              total,
            })}
          </span>
          <div className={s.pager}>
            <button
              type="button"
              className={s.pagerBtn}
              disabled={page <= 1 || isFetching}
              onClick={() => goToPage(page - 1)}
            >
              {t('common.previous', 'Previous')}
            </button>
            <span className={s.pageInfo}>
              {page} / {pageCount}
            </span>
            <button
              type="button"
              className={s.pagerBtn}
              disabled={page >= pageCount || isFetching}
              onClick={() => goToPage(page + 1)}
            >
              {t('common.next', 'Next')}
            </button>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
