import React from 'react';
import s from './PipelinePath.module.css';

function getVisibleStages(stages = []) {
  return (Array.isArray(stages) ? stages : []).filter((stage) => !stage?.hidden && !stage?.archived);
}

function formatTotal(totals = {}) {
  const entries = Object.entries(totals)
    .filter(([, value]) => Number(value) > 0)
    .map(([currency, value]) => `${Number(value).toLocaleString()} ${currency || 'PLN'}`);
  if (!entries.length) return '';
  return entries.slice(0, 2).join(' + ');
}

export default function PipelinePath({
  stages = [],
  currentStageId,
  aggregates = {},
  className = '',
  showAll = false,
  allSelected = false,
  allLabel = 'All stages',
  allMeta,
  onClear,
  disabled = false,
  onSelect,
  emptyLabel = 'Pipeline stages are not configured.',
  wonLabel = 'Won',
  lostLabel = 'Lost',
  ariaLabel = 'Pipeline stages',
}) {
  const visibleStages = getVisibleStages(stages);

  if (!visibleStages.length) {
    return <div className={s.empty}>{emptyLabel}</div>;
  }

  return (
    <div className={`${s.path} ${className}`.trim()} role="list" aria-label={ariaLabel}>
      {showAll ? (
        <button
          type="button"
          className={`${s.segment} ${s.allSegment} ${allSelected ? s.current : ''}`}
          disabled={disabled}
          aria-pressed={allSelected}
          onClick={() => {
            if (disabled) return;
            onClear?.();
          }}
        >
          <span className={s.colorRail} aria-hidden="true" />
          <span className={s.copy}>
            <span className={s.name}>{allLabel}</span>
            {allMeta ? <span className={s.meta}><span>{allMeta}</span></span> : null}
          </span>
        </button>
      ) : null}

      {visibleStages.map((stage) => {
        const isCurrent = String(stage.id) === String(currentStageId || '');
        const terminalLabel = stage.isWon ? wonLabel : stage.isLost ? lostLabel : '';
          const aggregate = aggregates[String(stage.id)] || aggregates[stage.id] || {};
          const totalLabel = formatTotal(aggregate.totals);
          const weightedLabel = formatTotal(aggregate.weighted);
        const classes = [
          s.segment,
          isCurrent ? s.current : '',
          stage.isWon ? s.terminalWon : '',
          stage.isLost ? s.terminalLost : '',
        ].filter(Boolean).join(' ');

        return (
          <button
            key={stage.id}
            type="button"
            className={classes}
            style={stage.color ? { '--stage-color': stage.color } : undefined}
            disabled={disabled}
            aria-pressed={isCurrent}
            onClick={() => {
              if (isCurrent || disabled) return;
              onSelect?.(stage.id, stage);
            }}
          >
            <span className={s.colorRail} aria-hidden="true" />
            <span className={s.copy}>
              <span className={s.name}>{stage.name}</span>
              <span className={s.meta}>
                {aggregate.count != null ? (
                  <span>{Number(aggregate.count).toLocaleString()}</span>
                ) : null}
                {totalLabel ? <span>{totalLabel}</span> : null}
                {weightedLabel ? <span>{weightedLabel}</span> : null}
                <span>{Number(stage.probability ?? 0)}%</span>
              </span>
            </span>
            {terminalLabel ? <span className={s.terminalLabel}>{terminalLabel}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
