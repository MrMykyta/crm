// src/components/DataTable/index.jsx
import React from 'react';
import s from './DataTable.module.css';

// getByPath: возвращает вычисленное значение для UI.
function getByPath(row, key) {
  if (!key) return undefined;
  if (!String(key).includes('.')) return row?.[key];
  return String(key).split('.').reduce((acc, part) => (acc == null ? undefined : acc?.[part]), row);
}

// normalizeCellValue: нормализует данные для отображения и ввода.
function normalizeCellValue(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((item) => normalizeCellValue(item)).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    return String(value?.name || value?.title || value?.label || value?.fullName || value?.shortName || value?.id || '');
  }
  return String(value);
}

// getSemanticWidthHint: возвращает вычисленное значение для UI.
function getSemanticWidthHint(key = '', title = '') {
  const source = `${String(key || '').toLowerCase()} ${String(title || '').toLowerCase()}`;
  if (/(description|note|comment|details|address)/.test(source)) return { min: 220, pref: 320 };
  if (/(name|title|subject|contact|company|counterparty|category|brand|manufacturer|supplier)/.test(source)) {
    return { min: 180, pref: 260 };
  }
  if (/(email|phone|website|url|linkedin|messenger)/.test(source)) return { min: 170, pref: 230 };
  if (/(date|time|created|updated|start|end|deadline|due)/.test(source)) return { min: 150, pref: 190 };
  if (/(status|state|stage|type|priority)/.test(source)) return { min: 130, pref: 170 };
  if (/(price|amount|total|cost|sum|qty|quantity|count|rate|vat)/.test(source)) return { min: 120, pref: 160 };
  if (/(^|[_.])id$|id\b/.test(source)) return { min: 116, pref: 150 };
  return { min: 96, pref: 160 };
}

// Компонент DataTable: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function DataTable({
  columns = [],
  data = [],
  loading = false,
  loadingRows = 8,
  emptyStateText = 'Ничего не найдено',
  emptyStateContent = null,
  rowKey = 'id',
  onSort,
  sortKey,
  sortDir,
  rowActions,
  onRowClick,
  rowClassName,

  columnWidths = {},
  onColumnResize = () => {},
  columnOrder,
  onColumnOrderChange,
  columnVisibility = {},

  minColWidth = 88,
  maxColWidth = 620,
}) {
  const wrapRef = React.useRef(null);

  /** ---------------- ORDER ---------------- */
  const allKeys = React.useMemo(() => columns.map(c => String(c.key)), [columns]);
  const [internalOrder, setInternalOrder] = React.useState(allKeys);
  React.useEffect(() => { setInternalOrder(allKeys); }, [allKeys]);

  const normalizeOrder = React.useCallback((desired) => {
    const set = new Set((desired || []).filter(k => allKeys.includes(k)));
    const rest = allKeys.filter(k => !set.has(k));
    return [...set, ...rest];
  }, [allKeys]);

  const order = React.useMemo(() => {
    const desired = (Array.isArray(columnOrder) && columnOrder.length) ? columnOrder : internalOrder;
    return normalizeOrder(desired);
  }, [columnOrder, internalOrder, normalizeOrder]);

    // setOrder: обновляет состояние компонента.
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

  const autoSizing = React.useMemo(() => {
    const pref = {};
    const min = {};
    const sampleRows = Array.isArray(data) ? data.slice(0, 120) : [];

    allKeys.forEach((key) => {
      const col = colMap.get(key);
      const titleText = String(col?.title || key || '').trim();
      const titleLen = titleText.length || 1;
      let longest = Math.min(44, Math.max(6, titleLen));
      const semanticHint = getSemanticWidthHint(key, titleText);

      for (let i = 0; i < sampleRows.length; i += 1) {
        const row = sampleRows[i];
        const raw = typeof col?.autoSizeValue === 'function'
          ? col.autoSizeValue(row, i)
          : getByPath(row, key);
        const txt = normalizeCellValue(raw);
        const len = txt.length;
        if (len > longest) longest = Math.min(56, len);
      }

      const padded = 46 + Math.round(longest * 7.2);
      const base = Math.max(Number(col?.width || 0), padded, semanticHint.pref);
      pref[key] = base || semanticHint.pref || 160;
      min[key] = Math.max(
        semanticHint.min,
        Math.max(88, Math.min(280, 30 + Math.round(Math.max(4, Math.min(34, titleLen)) * 7.15)))
      );
    });

    return { pref, min };
  }, [allKeys, colMap, data]);

  const clamp = React.useCallback((key, width) => {
    const col = colMap.get(key);
    const dynamicMin = autoSizing.min?.[key];
    const min = Math.max(80, Number(col?.minWidth ?? dynamicMin ?? minColWidth) || minColWidth);
    const max = Math.max(min, Number(col?.maxWidth ?? maxColWidth) || maxColWidth);
    return Math.max(min, Math.min(max, Math.round(Number(width) || 0)));
  }, [autoSizing.min, colMap, maxColWidth, minColWidth]);

  const getWidth = React.useCallback((key) => {
    const col = colMap.get(key);
    const hasManual = Object.prototype.hasOwnProperty.call(columnWidths || {}, key);
    const auto = autoSizing.pref?.[key] ?? 160;
    const base = hasManual
      ? columnWidths[key]
      : Math.max(Number(col?.width || 0), auto);
    return clamp(key, base);
  }, [autoSizing.pref, clamp, colMap, columnWidths]);

  const visibleOrder = React.useMemo(() => (
    order.filter((key) => {
      const col = colMap.get(key);
      const fallback = col?.defaultVisible !== false;
      const explicit = columnVisibility?.[key];
      return typeof explicit === 'boolean' ? explicit : fallback;
    })
  ), [colMap, columnVisibility, order]);

  /** ---------------- RESIZE ---------------- */
  const getGuideX = React.useCallback((clientX) => {
    const wrap = wrapRef.current;
    if (!wrap) return 0;
    const rect = wrap.getBoundingClientRect();
    return Math.max(0, Math.min(rect.width, clientX - rect.left));
  }, []);

  // { key, index, startX, startW, ghostW, guideX }
  const [resizing, setResizing] = React.useState(null);
  const [hoverKey, setHoverKey] = React.useState(null);
  const activeHoverKey = resizing?.key ?? hoverKey;

    // startResize: вспомогательная логика компонента.
const startResize = (key, index, e) => {
    e.preventDefault();
    e.stopPropagation();
    const startW = getWidth(key);
    setResizing({
      key,
      index,
      startX: e.clientX,
      startW,
      ghostW: startW,
      guideX: getGuideX(e.clientX),
    });
    document.body.classList.add('noselect');
  };

  // «живые» ширины (меняем только активную колонку)
  const liveWidths = React.useMemo(() => {
    const map = new Map(visibleOrder.map(k => [k, getWidth(k)]));
    if (resizing && typeof resizing.ghostW === 'number') {
      map.set(resizing.key, clamp(resizing.key, resizing.ghostW));
    }
    return map;
  }, [clamp, getWidth, resizing, visibleOrder]);

  const liveTableWidth = React.useMemo(() => {
    let sum = 0;
    visibleOrder.forEach(k => { sum += liveWidths.get(k) || 0; });
    if (rowActions) sum += 120;
    return sum;
  }, [rowActions, visibleOrder, liveWidths]);

  const commitResize = React.useCallback((key, _index, nextW) => {
    onColumnResize({ ...columnWidths, [key]: clamp(key, nextW) });
  }, [clamp, columnWidths, onColumnResize]);

  React.useEffect(() => {
    if (!resizing) return;

        // onMove: вспомогательная логика компонента.
const onMove = (e) => {
      e.preventDefault();
      const dx = e.clientX - resizing.startX;
      const w = clamp(resizing.key, resizing.startW + dx);
      setResizing((r) => (r ? ({ ...r, ghostW: w, guideX: getGuideX(e.clientX) }) : r));
    };

        // onUp: вспомогательная логика компонента.
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
  }, [resizing, commitResize, clamp, getGuideX]);

    // widthAt: вспомогательная логика компонента.
const widthAt = (k) => liveWidths.get(k);

  /** ---------------- Drag&Drop порядка ---------------- */
  const [dragKey, setDragKey] = React.useState(null);
  const [overKey, setOverKey] = React.useState(null);
    // onDragStart: вспомогательная логика компонента.
const onDragStart = (key) => (e) => {
    if (resizing) return;
    setDragKey(key);
    try { e.dataTransfer.setData('text/plain', key); } catch {}
    e.dataTransfer.effectAllowed = 'move';
  };
    // onDragOver: вспомогательная логика компонента.
const onDragOver  = (key) => (e) => {
    if (resizing) return;
    e.preventDefault();
    setOverKey(key);
  };
    // onDragLeave: вспомогательная логика компонента.
const onDragLeave = () => setOverKey(null);
    // onDrop: вспомогательная логика компонента.
const onDrop = (key) => (e) => {
    if (resizing) return;
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
  const loadingSkeletonRows = React.useMemo(
    () => Array.from({ length: Math.max(3, Math.min(loadingRows, 16)) }),
    [loadingRows]
  );

  const visibleCount = visibleOrder.length + (rowActions ? 1 : 0);
  const hasVisibleColumns = visibleOrder.length > 0;

  return (
    <div className={s.tableWrap} ref={wrapRef} style={{ scrollBehavior: 'auto' }}>
      {resizing ? (
        <div className={s.resizeGuide} style={{ left: `${resizing.guideX || 0}px` }} aria-hidden="true" />
      ) : null}
      <table className={s.table} style={{ width: liveTableWidth }}>
        <colgroup>
          {visibleOrder.map((k) => (
            <col key={k} style={{ width: widthAt(k) }} />
          ))}
          {rowActions && <col style={{ width: 120 }} />}
        </colgroup>

        <thead>
          <tr>
            {visibleOrder.map((k, idx) => {
              const col = colMap.get(k);
              if (!col) return null;
              const isSortable = !!col.sortable;
              const isActive   = isSortable && sortKey === k;
              const arrow      = isActive ? (sortDir === 'ASC' ? ' ▲' : ' ▼') : '';
              const thCls = `${s.th} ${activeHoverKey === k ? s.colHover : ''} ${overKey === k ? s.dropOver : ''}`;

              const showGhost = resizing?.key === k; // ← пунктир рисуем ВНУТРИ этого th

              return (
                <th
                  key={k}
                  className={thCls}
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
                    <span
                      className={`${s.dragHandle} ${s.draggable}`}
                      draggable={!resizing}
                      onDragStart={onDragStart(k)}
                      aria-label="Drag column"
                      title="Перетащить колонку"
                    >
                      ⋮⋮
                    </span>
                    <button
                      type="button"
                      onClick={() => isSortable && onSort?.(k, isActive && sortDir === 'ASC' ? 'DESC' : 'ASC')}
                      title={isSortable ? (isActive ? sortDir : '') : ''}
                      className={s.sortBtn}
                    >
                      {col.title}{arrow}
                    </button>
                  </div>
                  <span
                    className={s.resizer}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize column"
                    onMouseDown={(e) => startResize(k, idx, e)}
                  />
                </th>
              );
            })}
            {rowActions && <th className={s.th} />}
          </tr>
        </thead>

        <tbody>
          {!hasVisibleColumns ? (
            <tr>
              <td className={`${s.td} ${s.muted}`} colSpan={Math.max(1, visibleCount)}>
                Нет отображаемых колонок. Откройте «Настроить колонки».
              </td>
            </tr>
          ) : loading ? (
            loadingSkeletonRows.map((_, rowIndex) => (
              <tr key={`skeleton-${rowIndex}`} className={s.tr}>
                {visibleOrder.map((k, colIndex) => (
                  <td key={`${k}-skeleton-${rowIndex}`} className={s.td}>
                    <span
                      className={s.skeletonLine}
                      style={{
                        width: `${Math.max(36, 78 - (colIndex * 8 + rowIndex * 3) % 36)}%`,
                      }}
                    />
                  </td>
                ))}
                {rowActions ? <td className={`${s.td} ${s.actionsCell}`}><span className={s.skeletonChip} /></td> : null}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td className={`${s.td} ${s.muted}`} colSpan={visibleCount}>
                {emptyStateContent || emptyStateText}
              </td>
            </tr>
          ) : (
            data.map((row, ri) => {
              const rk = String(getRowKey(row, ri));
              const computedRowClassName = typeof rowClassName === 'function' ? rowClassName(row, ri) : rowClassName;
              return (
                <tr
                  key={rk}
                  className={`${s.tr} ${onRowClick ? s.clickableRow : ''} ${computedRowClassName || ''}`}
                  onClick={onRowClick ? () => onRowClick(row, ri) : undefined}
                >
                  {visibleOrder.map(k => {
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
                  {rowActions && <td className={`${s.td} ${s.actionsCell}`}>{rowActions(row)}</td>}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
