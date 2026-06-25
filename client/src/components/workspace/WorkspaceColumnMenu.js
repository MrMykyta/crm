import { RefreshCcw, SlidersHorizontal } from 'lucide-react';
import s from './Workspace.module.css';

export default function WorkspaceColumnMenu({
  open,
  onToggle,
  groups = [],
  technicalColumns = [],
  technicalOpen = false,
  onToggleTechnical,
  visibleCount = 0,
  columnState,
  labels = {},
  onSetColumnVisibility,
  onShowAll,
  onReset,
}) {
  const renderedGroups = [
    ...groups,
    ...(technicalOpen && technicalColumns.length ? [{ key: 'technical', columns: technicalColumns }] : []),
  ];

  return (
    <div className={s.columnsMenuWrap}>
      <button
        type="button"
        className={`${s.resetColumnsButton} ${s.columnsButton}`}
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <SlidersHorizontal size={14} aria-hidden="true" />
        <span>{labels.columnsMenu || 'Columns'}</span>
      </button>
      {open ? (
        <div
          className={s.columnsMenu}
          role="menu"
          aria-label={labels.columnsMenu || 'Columns'}
          onClick={(event) => event.stopPropagation()}
        >
          <div className={s.columnsMenuHeader}>
            <strong>{labels.columnsMenu || 'Columns'}</strong>
            <span>{labels.visibleColumns ? labels.visibleColumns(visibleCount) : `Visible: ${visibleCount}`}</span>
          </div>
          <div className={s.columnChecks}>
            {renderedGroups.map((group) => (
              <div key={group.key} className={s.columnGroup}>
                <div className={s.columnGroupTitle}>
                  {labels.groupLabel ? labels.groupLabel(group.key) : group.key}
                </div>
                {group.columns.map((column) => {
                  const visibility = columnState.visibility || {};
                  const visible = Object.prototype.hasOwnProperty.call(visibility, column.key)
                    ? visibility[column.key] !== false
                    : column.defaultVisible !== false;
                  const label = labels.columnLabel ? labels.columnLabel(column) : column.fallbackLabel || column.key;
                  const requiredTitle = labels.requiredColumn || 'Required column';
                  const contextLabel = labels.columnContext ? labels.columnContext(column) : '';
                  const helper = column.required
                    ? requiredTitle
                    : labels.columnHelper ? labels.columnHelper(column) : '';
                  return (
                    <label
                      key={column.key}
                      className={`${s.columnCheck} ${column.required ? s.columnCheckDisabled : ''}`}
                      title={column.required ? requiredTitle : helper || undefined}
                    >
                      <input
                        type="checkbox"
                        checked={visible}
                        disabled={column.required}
                        onChange={(event) => onSetColumnVisibility(column, event.target.checked)}
                      />
                      <span>
                        {label}
                        {contextLabel ? <em className={s.columnContextBadge}>{contextLabel}</em> : null}
                      </span>
                      {helper ? <small>{helper}</small> : null}
                    </label>
                  );
                })}
              </div>
            ))}
            {technicalColumns.length ? (
              <button
                type="button"
                className={s.technicalToggle}
                onClick={onToggleTechnical}
                aria-expanded={technicalOpen}
              >
                {technicalOpen
                  ? labels.hideTechnicalColumns || 'Hide technical fields'
                  : labels.showTechnicalColumns || 'Show technical fields'}
              </button>
            ) : null}
          </div>
          <div className={s.columnsMenuActions}>
            <button type="button" onClick={onShowAll}>
              {labels.showAllColumns || 'Show all'}
            </button>
            <button type="button" onClick={onReset}>
              <RefreshCcw size={13} aria-hidden="true" />
              {labels.resetColumns || 'Reset columns'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
