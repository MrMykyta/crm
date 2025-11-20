import React, {
  forwardRef, useImperativeHandle, useMemo, useState, useCallback,
} from 'react';
import { useTranslation } from 'react-i18next';
import DataTable from '../DataTable';
import DefaultToolbar from '../../filters/FilterToolbar';
import s from './ListPage.module.css';
import ThemedSelect from '../../inputs/RadixSelect'; // 👈 добавили

/* === Регистр RTK-источников === */
import { useListCounterpartiesQuery } from '../../../store/rtk/counterpartyApi';
import { useListTasksQuery } from '../../../store/rtk/tasksApi';
import { useListCompanyUsersQuery, useListInvitationsQuery } from '../../../store/rtk/companyUsersApi';

const REGISTRY = {
  counterparties: {
    useQuery: useListCounterpartiesQuery,
    adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      const total = Number(data?.total ?? items.length ?? 0);
      const page  = Number(data?.page ?? 1);
      const limit = Number(data?.limit ?? 25);
      return { items, total, page, limit };
    },
  },
  tasks: {
    useQuery: useListTasksQuery,
    adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page:  Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
  companyUsers: {
    useQuery: useListCompanyUsersQuery,
    adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page:  Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
  companyInvites: {
    useQuery: useListInvitationsQuery,
    adapt: (data) => {
      const items = Array.isArray(data) ? data : (data?.items || []);
      return {
        items,
        total: Number(data?.total ?? items.length ?? 0),
        page:  Number(data?.page ?? 1),
        limit: Number(data?.limit ?? 25),
      };
    },
  },
};

export function Button({ variant = 'primary', children, className = '', ...props }) {
  const cls = variant === 'primary' ? s.primary : s.btn;
  return (
    <button className={`${cls} ${className}`} {...props}>
      {children}
    </button>
  );
}

const normalizeQuery = (q = {}) => ({
  page: Number(q.page) > 0 ? Number(q.page) : 1,
  limit: Number(q.limit) > 0 ? Number(q.limit) : 25,
  sort: q.sort || 'createdAt',
  dir: q.dir === 'ASC' ? 'ASC' : 'DESC',
  search: q.search ?? undefined,
  type: q.type ?? undefined,
  status: q.status ?? undefined,
  from: q.from ?? undefined,
  to: q.to ?? undefined,
  ...q,
});

const ListPage = forwardRef(function ListPage(
  {
    source,
    externalData,
    externalMeta,
    externalLoading,
    onExternalRefetch,
    query: controlledQuery,
    onQueryChange,
    title,
    columns = [],
    defaultQuery = {},
    actions,
    rowActions,
    columnWidths,
    onColumnResize,
    columnOrder,
    onColumnOrderChange,
    rowKey = 'id',
    ToolbarComponent,
    toolbarExtra,
    transformItems,
  },
  ref
) {
  const { t } = useTranslation();

  const isExternal = typeof externalData !== 'undefined';

  const initQuery = useMemo(() => normalizeQuery(defaultQuery), [defaultQuery]);
  const [internalQuery, setInternalQuery] = useState(initQuery);
  const query = useMemo(
    () => normalizeQuery(isExternal ? (controlledQuery || initQuery) : internalQuery),
    [isExternal, controlledQuery, initQuery, internalQuery]
  );

  const reg = useMemo(() => {
    if (!isExternal) {
      const r = REGISTRY[source];
      if (!r) throw new Error(`ListPage: неизвестный source="${source}"`);
      return r;
    }
    return {
      useQuery: () => ({
        data: { items: externalData, total: externalMeta?.total, page: externalMeta?.page, limit: externalMeta?.limit },
        isFetching: !!externalLoading,
        refetch: onExternalRefetch || (() => {}),
        error: null,
      }),
      adapt: (_data, q) => {
        const items = Array.isArray(externalData) ? externalData : (externalData?.items || []);
        const total = Number(externalMeta?.total ?? items.length ?? 0);
        const page  = Number(externalMeta?.page ?? q.page ?? 1);
        const limit = Number(externalMeta?.limit ?? q.limit ?? 25);
        return { items, total, page, limit };
      },
    };
  }, [isExternal, source, externalData, externalMeta, externalLoading, onExternalRefetch]);

  const r = reg.useQuery(query);

  const adapted = useMemo(() => {
    const base = reg.adapt(r.data || {}, query);
    const items = typeof transformItems === 'function' ? transformItems(base.items, query) : base.items;
    return { ...base, items };
  }, [r.data, reg, transformItems, query]);

  const replaceQuery = useCallback((nextOrSetter) => {
    const next = normalizeQuery(typeof nextOrSetter === 'function' ? nextOrSetter(query) : nextOrSetter);
    if (isExternal) onQueryChange?.(next);
    else setInternalQuery(next);
  }, [isExternal, onQueryChange, query]);

  const setPage  = useCallback((p)   => replaceQuery(q => ({ ...q, page: Math.max(1, Number(p) || 1) })), [replaceQuery]);
  const setLimit = useCallback((lim) => replaceQuery(q => ({ ...q, limit: Math.max(1, Number(lim) || 25), page: 1 })), [replaceQuery]);
  const setSort  = useCallback((k,d)=> replaceQuery(q => ({ ...q, sort: k, dir: d === 'ASC' ? 'ASC' : 'DESC', page: 1 })), [replaceQuery]);
  const refetch  = useCallback(() => r.refetch?.(), [r]);

  useImperativeHandle(ref, () => ({
    refetch,
    replaceQuery,
    getQuery: () => query,
  }), [refetch, replaceQuery, query]);

  const total = adapted.total ?? 0;
  const start = total ? (query.page - 1) * query.limit + 1 : 0;
  const end   = total ? Math.min(query.page * query.limit, total) : 0;
  const pages = Math.max(1, Math.ceil(total / (query.limit || 1)));

  const ToolbarToRender = ToolbarComponent || DefaultToolbar;

  const limitOptions = [10, 25, 50, 100].map((n) => ({ value: n, label: String(n) }));

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

            {/* заменённый select */}
            <label className={s.perPage} aria-label={t('list.perPageAria') || 'На странице'}>
              <ThemedSelect
                className={s.pageSize}
                value={query.limit}
                onChange={(val) => setLimit(Number(val))}
                options={limitOptions}
                placeholder="стр."
                size="sm"
              />
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

        {r.error && <div className={s.error}>{String(r.error?.data?.error || r.error?.message || 'Error')}</div>}

        <div className={s.scrollX}>
          <DataTable
            columns={columns}
            data={adapted.items}
            loading={!!r.isFetching}
            rowActions={rowActions}
            sortKey={query.sort}
            sortDir={query.dir}
            onSort={(key, dir) => setSort(key, dir)}
            rowKey={rowKey}
            columnWidths={columnWidths}
            onColumnResize={onColumnResize}
            columnOrder={columnOrder}
            onColumnOrderChange={onColumnOrderChange}
          />
        </div>
      </div>
    </div>
  );
});

export default ListPage;