// src/components/DataTable/index.jsx
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
  rowActions,

  columnWidths = {},            // { key: px }
  onColumnResize = () => {},    // (nextMap) => void   ← ВАЖНО: отдаём всю карту, не один ключ
}) {
  const [resizing, setResizing] = React.useState(null); // { key, startX, startWidth, startScrollLeft }
  const [hoverKey, setHoverKey] = React.useState(null);
  const wrapRef = React.useRef(null);

  // текущая ширина берётся из columnWidths либо дефолт 160
  const getWidth = (key) => Math.max(80, Math.min(640, Number(columnWidths[key] || 160)));

  const startResize = (key, e) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = getWidth(key);
    const startScrollLeft = wrapRef.current?.scrollLeft || 0;
    setResizing({ key, startX: e.clientX, startWidth, startScrollLeft });
    document.body.classList.add('noselect');
  };

  React.useEffect(() => {
    if (!resizing) return;

    const onMove = (e) => {
      e.preventDefault(); // снижаем шанс автоскролла
      const dx = e.clientX - resizing.startX;
      const nextWidth = Math.max(80, Math.min(640, Math.round(resizing.startWidth + dx)));

      // формируем НОВУЮ карту ширин и отдаём наверх (не перезаписывая другие колонки)
      const nextMap = { ...columnWidths, [resizing.key]: nextWidth };
      onColumnResize(nextMap);

      // держим scrollLeft фиксированным
      if (wrapRef.current) wrapRef.current.scrollLeft = resizing.startScrollLeft;
    };

    const onUp = () => {
      setResizing(null);
      document.body.classList.remove('noselect');
    };

    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [resizing, columnWidths, onColumnResize]);

  const activeHoverKey = resizing?.key ?? hoverKey;

  return (
    <div className={s.tableWrap} ref={wrapRef} style={{ scrollBehavior: 'auto' }}>
      <table className={s.table}>
        {/* СТАБИЛЬНЫЕ ШИРИНЫ через <colgroup> */}
        <colgroup>
          {columns.map(col => (
            <col key={col.key} style={{ width: getWidth(col.key) }} />
          ))}
          {rowActions && <col style={{ width: 120 }} />}
        </colgroup>

        <thead>
          <tr>
            {columns.map(col => {
              const isSortable = col.sortable;
              const isActive = isSortable && sortKey === col.key;
              const arrow = isActive ? (sortDir === 'ASC' ? ' ▲' : ' ▼') : '';
              const thCls = `${s.th} ${activeHoverKey === col.key ? s.colHover : ''}`;

              return (
                <th
                  key={String(col.key)}
                  data-key={col.key}
                  className={thCls}
                  aria-sort={isActive ? (sortDir === 'ASC' ? 'ascending' : 'descending') : 'none'}
                  onMouseEnter={() => setHoverKey(col.key)}
                  onMouseLeave={() => setHoverKey(null)}
                >
                  <div className={s.thInner}>
                    <button
                      type="button"
                      onClick={() => isSortable && onSort?.(col.key, isActive && sortDir === 'ASC' ? 'DESC' : 'ASC')}
                      title={isSortable ? (isActive ? sortDir : '') : ''}
                      style={{ all: 'unset', cursor: isSortable ? 'pointer' : 'default', fontWeight: 600 }}
                    >
                      {col.title}{arrow}
                    </button>

                    {/* ручка на рамке */}
                    <span
                      className={s.resizer}
                      role="separator"
                      aria-orientation="vertical"
                      aria-label="Resize column"
                      onMouseDown={(e) => startResize(col.key, e)}
                    />
                  </div>
                </th>
              );
            })}
            {rowActions && <th className={s.th}></th>}
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
                  <td
                    key={String(col.key)}
                    data-key={col.key}
                    className={`${s.td} ${activeHoverKey === col.key ? s.colHover : ''}`}
                    onMouseEnter={() => setHoverKey(col.key)}
                    onMouseLeave={() => setHoverKey(null)}
                  >
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