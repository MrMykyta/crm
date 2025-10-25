// src/components/ListPage/index.jsx
import React, {
  forwardRef, useImperativeHandle, useMemo, useRef, useState, useCallback, useEffect,
} from 'react';
import { useTranslation } from 'react-i18next';
import { listResource } from '../../../api/resources';
import DataTable from '../DataTable';
import DefaultToolbar from '../../filters/FilterToolbar';
import s from './ListPage.module.css';

/** Локальная кнопка: variant="primary"|"secondary" */
export function Button({ variant = 'primary', children, className = '', ...props }) {
  const cls = variant === 'primary' ? s.primary : s.btn;
  return (
    <button className={`${cls} ${className}`} {...props}>
      {children}
    </button>
  );
}

// --- helpers ---
const shallowEqualObj = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  const ak = Object.keys(a); const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (a[k] !== b[k]) return false;
  return true;
};

const normalizeQuery = (q = {}) => ({
  page: Number(q.page) > 0 ? Number(q.page) : 1,
  limit: Number(q.limit) > 0 ? Number(q.limit) : 25,
  sort: q.sort || 'createdAt',
  dir: q.dir === 'ASC' ? 'ASC' : 'DESC',
  search: q.search ?? undefined,
  type: q.type ?? undefined,
  ...q,
});

// --- component ---
const ListPage = forwardRef(function ListPage(
  {
    title,
    endpoint,
    columns = [],
    defaultQuery = {},
    actions,
    rowActions,

    // сортировка и размеры уже были
    columnWidths,
    onColumnResize,

    // порядок колонок
    columnOrder,                 // string[] | undefined
    onColumnOrderChange,         // (next: string[]) => void

    // доп: проброс кастомного ключа строки (часто удобно)
    rowKey = 'id',

    /** внешний тулбар */
    ToolbarComponent,
    toolbarExtra,
    transformItems,
  },
  ref
) {
  const { t } = useTranslation();

  // стабильные начальные значения
  const initQuery = useMemo(() => normalizeQuery(defaultQuery), [defaultQuery]);

  const [query, setQuery] = useState(initQuery);
  const [data, setData] = useState({
    items: [],
    total: 0,
    page: initQuery.page,
    limit: initQuery.limit
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);

  // отмена гонок запросов
  const abortRef = useRef(null);

  // при смене endpoint — мягкий сброс к дефолту, один раз
  const prevEndpointRef = useRef(endpoint);
  useEffect(() => {
    if (prevEndpointRef.current !== endpoint) {
      prevEndpointRef.current = endpoint;
      setQuery(initQuery);
    }
  }, [endpoint, initQuery]);

  const fetchList = useCallback(async (q = query) => {
    // abort предыдущий
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    try {
      const res = await listResource(endpoint, q);
      if (!ctrl.signal.aborted) {
        const rawItems = res?.items || [];
        const items = typeof transformItems === 'function' ? transformItems(rawItems, q) : rawItems;
        setData({
          items,
          total: Number(res?.total || 0),
          page: Number(res?.page || q.page || 1),
          limit: Number(res?.limit || q.limit || 25),
        });
      }
    } catch (e) {
      if (!ctrl.signal.aborted) setError(String(e?.message || e) || 'Error');
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setLoading(false);
    }
  }, [endpoint, query]);

  // авто-загрузка при маунте и изменениях endpoint/query
  useEffect(() => {
    fetchList();
    return () => abortRef.current?.abort?.();
  }, [fetchList]);

  // публичный API наружу
  const replaceQuery = useCallback((nextOrSetter) => {
    setQuery((prev) => {
      const next = normalizeQuery(typeof nextOrSetter === 'function' ? nextOrSetter(prev) : nextOrSetter);
      return shallowEqualObj(prev, next) ? prev : next;
    });
  }, []);

  const setPage  = useCallback((page)  => replaceQuery(q => ({ ...q, page: Math.max(1, Number(page) || 1) })), [replaceQuery]);
  const setLimit = useCallback((limit) => replaceQuery(q => ({ ...q, limit: Math.max(1, Number(limit) || 25), page: 1 })), [replaceQuery]);
  const setSort  = useCallback((key, dir) => replaceQuery(q => ({ ...q, sort: key, dir: dir === 'ASC' ? 'ASC' : 'DESC', page: 1 })), [replaceQuery]);
  const refetch  = useCallback(() => fetchList(), [fetchList]);

  useImperativeHandle(ref, () => ({
    refetch,
    replaceQuery,
    getQuery: () => query,
  }), [refetch, replaceQuery, query]);

  const total = data.total ?? 0;
  const start = total ? (query.page - 1) * query.limit + 1 : 0;
  const end   = total ? Math.min(query.page * query.limit, total) : 0;
  const pages = Math.max(1, Math.ceil(total / (query.limit || 1)));

  const ToolbarToRender = ToolbarComponent || DefaultToolbar;

  return (
    <div className={s.wrap}>
      <div className={s.card}>
        {title ? (
          <div className={s.header}>
            <h2 className={s.title}>{title}</h2>
            <div className={s.actions}>{actions}</div>
          </div>
        ) : (
          <div className={s.headerNoTitle}>
            <div className={s.actions}>{actions}</div>
          </div>
        )}

        <ToolbarToRender
          query={query}
          onChange={(setter) => {
            const next = typeof setter === 'function' ? setter(query) : setter;
            replaceQuery(next);
          }}
          extra={toolbarExtra}
        />

        {/* верхняя панель пагинации / счётчик */}
        <div className={s.topbar}>
          <div className={s.left}>
            <span className={s.count}>
              {t('list.rangeOfTotal', { start, end, total })}
            </span>

            <label className={s.perPage} aria-label={t('list.perPageAria') || 'На странице'}>
              <select
                className={s.pageSize}
                value={query.limit}
                onChange={(e)=> setLimit(Number(e.target.value))}
              >
                {[10,25,50,100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className={s.muted}>стр.</span>
            </label>

            <button type="button" className={s.btn} onClick={refetch} title={t('list.refresh')}>
              {t('list.refresh')}
            </button>
          </div>

          <div className={s.pager}>
            <button
              type="button"
              className={s.btn}
              onClick={()=> setPage(Math.max(1, query.page - 1))}
              disabled={query.page <= 1}
            >
              {t('list.back')}
            </button>

            <span className={s.pageBadge}>
              {t('list.pageLabel', { page: query.page, pages })}
            </span>

            <button
              type="button"
              className={s.btn}
              onClick={()=> setPage(Math.min(pages, query.page + 1))}
              disabled={query.page >= pages}
            >
              {t('list.forward')}
            </button>
          </div>
        </div>

        {error && <div className={s.error}>{error}</div>}

        <div className={s.scrollX}>
          <DataTable
          /* данные и сортировка */
          columns={columns}
          data={data.items}
          loading={loading}
          rowActions={rowActions}
          sortKey={query.sort}
          sortDir={query.dir}
          onSort={(key, dir) => setSort(key, dir)}

          /* ключ строки (если нужно переопределить) */
          rowKey={rowKey}

          /* ширины колонок (как было) */
          columnWidths={columnWidths}
          onColumnResize={onColumnResize}

          /* 🔹 НОВОЕ: порядок колонок */
          columnOrder={columnOrder}
          onColumnOrderChange={onColumnOrderChange}
        />
        </div>
      </div>
    </div>
  );
});

export default ListPage;