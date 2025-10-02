import React from 'react';
import s from './DataTable.module.css';

export default function DataTable({
  columns = [],
  data = [],
  loading = false,
  rowKey = 'id',
  onSort,
  sortKey,
  sortDir,
  rowActions
}) {
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            {columns.map(col => {
              const isSortable = col.sortable;
              const isActive = isSortable && sortKey === col.key;
              const arrow = isActive ? (sortDir === 'ASC' ? ' ▲' : ' ▼') : '';
              return (
                <th
                  key={String(col.key)}
                  className={`${s.th} ${isSortable ? s.sortable : ''}`}
                  onClick={() => isSortable && onSort?.(col.key, isActive && sortDir === 'ASC' ? 'DESC' : 'ASC')}
                  aria-sort={isActive ? (sortDir === 'ASC' ? 'ascending' : 'descending') : 'none'}
                >
                  {col.title}{arrow}
                </th>
              );
            })}
            {rowActions && <th className={s.th} style={{ width:120 }}></th>}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td className={s.td} colSpan={columns.length + (rowActions ? 1 : 0)}>Загрузка…</td></tr>
          ) : data.length === 0 ? (
            <tr><td className={`${s.td} ${s.muted}`} colSpan={columns.length + (rowActions ? 1 : 0)}>Ничего не найдено</td></tr>
          ) : (
            data.map(row => (
              <tr key={row[rowKey]} className={s.tr}>
                {columns.map(col => (
                  <td key={String(col.key)} className={s.td}>
                    {col.render ? col.render(row) : String(row[col.key] ?? '')}
                  </td>
                ))}
                {rowActions && <td className={s.td}>{rowActions(row)}</td>}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}