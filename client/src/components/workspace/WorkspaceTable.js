import { useCallback, useState } from 'react';
import s from './Workspace.module.css';

function isInteractiveTarget(target) {
  return Boolean(target?.closest?.('button, a, input, select, textarea, [role="button"], [role="link"]'));
}

export default function WorkspaceTable({
  rows = [],
  columns = [],
  tableWidth = 860,
  renderCell,
  getRowId = (row) => row?.id,
  getRowKey = (row) => `${row?.type || ''}:${row?.id || ''}`,
  selectedRowId = '',
  selectedRowIdFallback = '',
  onRowClick,
  onRowKeyDown,
  onResizeColumn,
  onMoveColumn,
  sortKey,
  sortDir,
  onSort,
  labels = {},
}) {
  const [draggedColumnKey, setDraggedColumnKey] = useState('');
  const [dragOverColumnKey, setDragOverColumnKey] = useState('');

  const startColumnMouseDrag = useCallback((column, event) => {
    if (event.button !== 0) return;
    const startX = event.clientX;
    const startY = event.clientY;
    let didDrag = false;

    const getTargetKey = (clientX, clientY) => {
      const target = document.elementFromPoint(clientX, clientY)?.closest('[data-column-key]');
      return target?.getAttribute('data-column-key') || '';
    };

    const onMove = (moveEvent) => {
      const distance = Math.abs(moveEvent.clientX - startX) + Math.abs(moveEvent.clientY - startY);
      if (distance < 8) return;
      didDrag = true;
      setDraggedColumnKey(column.key);
      setDragOverColumnKey(getTargetKey(moveEvent.clientX, moveEvent.clientY));
    };

    const onUp = (upEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (didDrag) {
        onMoveColumn(column.key, getTargetKey(upEvent.clientX, upEvent.clientY));
      }
      setDraggedColumnKey('');
      setDragOverColumnKey('');
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [onMoveColumn]);

  return (
    <div className={s.tableWrap}>
      <table className={s.table} style={{ width: `${tableWidth}px` }}>
        <colgroup>
          {columns.map((column) => (
            <col key={column.key} style={{ width: `${column.width}px` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                data-column-key={column.key}
                className={`${column.numeric ? s.numeric : ''} ${dragOverColumnKey === column.key ? s.dragOverColumn : ''} ${column.sortable ? s.sortableColumn : ''}`}
                aria-sort={column.sortable && String(sortKey || '') === String(column.key)
                  ? (sortDir === 'ASC' ? 'ascending' : 'descending')
                  : undefined}
                draggable
                onMouseDown={(event) => startColumnMouseDrag(column, event)}
                onDragStart={(event) => {
                  setDraggedColumnKey(column.key);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', column.key);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverColumnKey(column.key);
                }}
                onDragLeave={() => setDragOverColumnKey('')}
                onDrop={(event) => {
                  event.preventDefault();
                  const fromKey = event.dataTransfer.getData('text/plain') || draggedColumnKey;
                  onMoveColumn(fromKey, column.key);
                  setDraggedColumnKey('');
                  setDragOverColumnKey('');
                }}
                onDragEnd={() => {
                  setDraggedColumnKey('');
                  setDragOverColumnKey('');
                }}
                title={labels.dragColumn || 'Drag to reorder column'}
              >
                {column.sortable && onSort ? (
                  <button
                    type="button"
                    className={s.columnSortButton}
                    onClick={(event) => {
                      event.stopPropagation();
                      const active = String(sortKey || '') === String(column.key);
                      const nextDir = active && sortDir === 'ASC' ? 'DESC' : 'ASC';
                      onSort(column.key, nextDir);
                    }}
                  >
                    <span className={s.columnHeaderInner}>
                      <span className={s.columnHeaderLabel}>
                        {labels.columnLabel ? labels.columnLabel(column) : column.fallbackLabel || column.key}
                      </span>
                      <span className={s.sortIndicator} aria-hidden="true">
                        {String(sortKey || '') === String(column.key) ? (sortDir === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </span>
                  </button>
                ) : (
                  <span className={s.columnHeaderInner}>
                    <span className={s.columnHeaderLabel}>
                      {labels.columnLabel ? labels.columnLabel(column) : column.fallbackLabel || column.key}
                    </span>
                  </span>
                )}
                <span
                  className={s.resizeHandle}
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={labels.resizeColumn || 'Resize column'}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onResizeColumn(column, event.clientX, column.width);
                  }}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rowId = getRowId(row);
            const selected = String(selectedRowId || selectedRowIdFallback || '') === String(rowId || '');
            return (
              <tr
                key={getRowKey(row)}
                className={`${s.documentRow} ${selected ? s.documentRowSelected : ''}`}
                tabIndex={(row.route || onRowClick) ? 0 : undefined}
                aria-label={`${row.type || ''} ${row.number || row.id || ''}`.trim()}
                aria-selected={selected}
                onClick={(event) => {
                  if (isInteractiveTarget(event.target)) return;
                  onRowClick?.(row, event);
                }}
                onKeyDown={(event) => {
                  if (isInteractiveTarget(event.target)) return;
                  if (onRowKeyDown) onRowKeyDown(row, event);
                }}
              >
                {columns.map((column) => (
                  <td key={column.key} className={column.numeric ? s.numeric : ''}>
                    {renderCell ? renderCell(row, column) : row[column.key] || '-'}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
