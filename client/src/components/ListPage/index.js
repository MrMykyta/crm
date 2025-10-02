import React, { forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import useListResource from '../../hooks/useListResource';
import DataTable from '../DataTable';
import Toolbar from '../Toolbar';
import s from './ListPage.module.css';

/** Локальная кнопка: variant="primary"|"secondary" */
export function Button({ variant = 'secondary', children, className = '', ...props }) {
  const cls = variant === 'primary' ? s.primary : s.btn;
  return (
    <button className={`${cls} ${className}`} {...props}>
      {children}
    </button>
  );
}

const ListPage = forwardRef(function ListPage(
  { title, endpoint, columns = [], defaultQuery = {}, actions, rowActions },
  ref
) {
  const { t } = useTranslation();
  const {
    query, data, loading, error,
    setPage, setLimit, setSort, refetch, replaceQuery,
  } = useListResource({ endpoint, defaultQuery });

  useImperativeHandle(ref, () => ({
    refetch,
    replaceQuery,
    getQuery: () => query,
  }), [refetch, replaceQuery, query]);

  const total = data.total ?? 0;
  const start = total ? (query.page - 1) * query.limit + 1 : 0;
  const end   = total ? Math.min(query.page * query.limit, total) : 0;
  const pages = Math.max(1, Math.ceil(total / (query.limit || 1)));

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

        <Toolbar
          query={query}
          onChange={(setter) => {
            const next = typeof setter === 'function' ? setter(query) : setter;
            replaceQuery(next);
          }}
        />

        {/* верхняя панель пагинации / счётчик */}
        <div className={s.topbar}>
          <div className={s.left}>
            <span className={s.count}>
              {t('list.rangeOfTotal', { start, end, total })}
            </span>

            <label className={s.perPage}>
              <span className={s.muted}>{t('list.perPageShort')}</span>
              <select
                className={s.pageSize}
                value={query.limit}
                onChange={(e)=> setLimit(Number(e.target.value))}
              >
                {[10,25,50,100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
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

        <DataTable
          columns={columns}
          data={data.items}
          loading={loading}
          rowActions={rowActions}
          sortKey={query.sort}
          sortDir={query.dir}
          onSort={(key, dir) => setSort(key, dir)}
        />
      </div>
    </div>
  );
});

export default ListPage;