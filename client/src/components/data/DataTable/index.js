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

  columnWidths = {},
  onColumnResize = () => {},
  columnOrder,
  onColumnOrderChange,

  minColWidth = 200,
  maxColWidth = 620,
}) {
  const wrapRef = React.useRef(null);

  /** ---------------- ORDER ---------------- */
  const allKeys = React.useMemo(() => columns.map(c => String(c.key)), [columns]);
  const [internalOrder, setInternalOrder] = React.useState(allKeys);
  React.useEffect(() => { setInternalOrder(allKeys); }, [allKeys.join('|')]);

  const normalizeOrder = React.useCallback((desired) => {
    const set = new Set((desired || []).filter(k => allKeys.includes(k)));
    const rest = allKeys.filter(k => !set.has(k));
    return [...set, ...rest];
  }, [allKeys]);

  const order = React.useMemo(() => {
    const desired = (Array.isArray(columnOrder) && columnOrder.length) ? columnOrder : internalOrder;
    return normalizeOrder(desired);
  }, [columnOrder, internalOrder, normalizeOrder]);

  const setOrder = (next) => {
    const full = normalizeOrder(next);
    if (onColumnOrderChange) onColumnOrderChange(full);
    else setInternalOrder(full);
  };

  /** ---------------- helpers ---------------- */
  const colMap = React.useMemo(() => {
    const m = new Map();
    columns.forEach(c => m.set(String(c.key), c));
    return m;
  }, [columns]);

  const clamp   = (w) => Math.max(minColWidth, Math.min(maxColWidth, Math.round(Number(w) || 0)));
  const getWidth = (key) => clamp(columnWidths[key] ?? (colMap.get(key)?.width ?? 160));

  /** ---------------- RESIZE ---------------- */
  // { key, index, startX, startW, ghostW }
  const [resizing, setResizing] = React.useState(null);
  const [hoverKey, setHoverKey] = React.useState(null);
  const activeHoverKey = resizing?.key ?? hoverKey;

  const startResize = (key, index, e) => {
    e.preventDefault();
    e.stopPropagation();
    const startW = getWidth(key);
    setResizing({ key, index, startX: e.clientX, startW, ghostW: startW });
    document.body.classList.add('noselect');
  };

  // «живые» ширины (меняем только активную колонку)
  const liveWidths = React.useMemo(() => {
    const map = new Map(order.map(k => [k, getWidth(k)]));
    if (resizing && typeof resizing.ghostW === 'number') {
      map.set(resizing.key, clamp(resizing.ghostW));
    }
    return map;
  }, [order, columnWidths, resizing]);

  const liveTableWidth = React.useMemo(() => {
    let sum = 0;
    order.forEach(k => { sum += liveWidths.get(k) || 0; });
    if (rowActions) sum += 120;
    return sum;
  }, [order, rowActions, liveWidths]);

  const commitResize = React.useCallback((key, _index, nextW) => {
    onColumnResize({ ...columnWidths, [key]: clamp(nextW) });
  }, [columnWidths, onColumnResize]);

  React.useEffect(() => {
    if (!resizing) return;

    const onMove = (e) => {
      e.preventDefault();
      const dx = e.clientX - resizing.startX;
      const w = clamp(resizing.startW + dx);
      setResizing(r => r ? ({ ...r, ghostW: w }) : r);
    };

    const onUp = () => {
      if (resizing) commitResize(resizing.key, resizing.index, resizing.ghostW ?? resizing.startW);
      setResizing(null);
      document.body.classList.remove('noselect');
    };

    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [resizing, commitResize, clamp]);

  const widthAt = (k) => liveWidths.get(k);

  /** ---------------- Drag&Drop порядка ---------------- */
  const [dragKey, setDragKey] = React.useState(null);
  const [overKey, setOverKey] = React.useState(null);
  const onDragStart = (key) => (e) => {
    setDragKey(key);
    try { e.dataTransfer.setData('text/plain', key); } catch {}
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver  = (key) => (e) => { e.preventDefault(); setOverKey(key); };
  const onDragLeave = () => setOverKey(null);
  const onDrop = (key) => (e) => {
    e.preventDefault();
    const from = dragKey, to = key;
    setDragKey(null); setOverKey(null);
    if (!from || !to || from === to) return;
    const curr = [...order];
    const fromIdx = curr.indexOf(from);
    const toIdx   = curr.indexOf(to);
    if (fromIdx < 0 || toIdx < 0) return;
    curr.splice(fromIdx, 1);
    curr.splice(toIdx, 0, from);
    setOrder(curr);
  };

  /** ---------------- Row key ---------------- */
  const getRowKey = (row, idx) =>
    row?.[rowKey] ?? row?.id ?? row?.userId ?? row?.email ?? `row-${idx}`;

  /** ---------------- Render ---------------- */
  return (
    <div className={s.tableWrap} ref={wrapRef} style={{ scrollBehavior: 'auto' }}>
      <table className={s.table} style={{ width: liveTableWidth }}>
        <colgroup>
          {order.map((k) => (
            <col key={k} style={{ width: widthAt(k) }} />
          ))}
          {rowActions && <col style={{ width: 120 }} />}
        </colgroup>

        <thead>
          <tr>
            {order.map((k, idx) => {
              const col = colMap.get(k);
              if (!col) return null;
              const isSortable = !!col.sortable;
              const isActive   = isSortable && sortKey === k;
              const arrow      = isActive ? (sortDir === 'ASC' ? ' ▲' : ' ▼') : '';
              const thCls = `${s.th} ${activeHoverKey === k ? s.colHover : ''} ${s.draggable} ${overKey === k ? s.dropOver : ''}`;

              const showGhost = resizing?.key === k; // ← пунктир рисуем ВНУТРИ этого th

              return (
                <th
                  key={k}
                  className={thCls}
                  draggable
                  onDragStart={onDragStart(k)}
                  onDragOver={onDragOver(k)}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop(k)}
                  onMouseEnter={() => setHoverKey(k)}
                  onMouseLeave={() => setHoverKey(null)}
                  aria-sort={isActive ? (sortDir === 'ASC' ? 'ascending' : 'descending') : 'none'}
                >
                  {/* локальный пунктир в правой кромке заголовка */}
                  {showGhost && <span className={s.ghostLocal} />}

                  <div className={s.thInner}>
                    <button
                      type="button"
                      onClick={() => isSortable && onSort?.(k, isActive && sortDir === 'ASC' ? 'DESC' : 'ASC')}
                      title={isSortable ? (isActive ? sortDir : '') : ''}
                      className={s.sortBtn}
                    >
                      {col.title}{arrow}
                    </button>

                    <span
                      className={s.resizer}
                      role="separator"
                      aria-orientation="vertical"
                      aria-label="Resize column"
                      onMouseDown={(e) => startResize(k, idx, e)}
                    />
                  </div>
                </th>
              );
            })}
            {rowActions && <th className={s.th} />}
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td className={s.td} colSpan={order.length + (rowActions ? 1 : 0)}>Загрузка…</td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td className={`${s.td} ${s.muted}`} colSpan={order.length + (rowActions ? 1 : 0)}>Ничего не найдено</td>
            </tr>
          ) : (
            data.map((row, ri) => {
              const rk = String(getRowKey(row, ri));
              return (
                <tr key={rk} className={s.tr}>
                  {order.map(k => {
                    const col = colMap.get(k);
                    return (
                      <td
                        key={`${k}-${rk}`}
                        data-key={k}
                        className={`${s.td} ${activeHoverKey === k ? s.colHover : ''}`}
                        onMouseEnter={() => setHoverKey(k)}
                        onMouseLeave={() => setHoverKey(null)}
                      >
                        {col?.render ? col.render(row, ri) : String(row[k] ?? '')}
                      </td>
                    );
                  })}
                  {rowActions && <td className={s.td}>{rowActions(row)}</td>}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}