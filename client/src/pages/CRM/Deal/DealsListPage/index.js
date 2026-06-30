import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronRight,
  Circle,
  GripVertical,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from 'lucide-react';

import Modal from '../../../../components/Modal';
import ConfirmDialog from '../../../../components/dialogs/ConfirmDialog';
import { SearchField, SelectField } from '../../../../components/ui/fields';
import PipelinePath from '../../../../components/deals/PipelinePath';
import useCompanyMembersOptions from '../../../../hooks/useCompanyMembersOptions';
import useAclPermissions from '../../../../hooks/useAclPermissions';

import {
  useDeleteDealMutation,
  useGetDealsBoardQuery,
  useGetLostReasonsQuery,
  useGetPipelinesQuery,
  useMarkLostMutation,
  useMarkWonMutation,
  useMoveDealStageMutation,
} from '../../../../store/rtk/dealsApi';

import s from './DealsListPage.module.css';

const SALES_PIPELINE_STORAGE_KEY = 'crm.deals.pipeline.workspace.pipelineId';

function readStorage(key, fallback = '') {
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // localStorage may be unavailable in restricted contexts.
  }
}

function compact(obj = {}) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

function getOrder(item = {}, fallback = 0) {
  const raw = item.order ?? item.position ?? fallback;
  const num = Number(raw);
  return Number.isFinite(num) ? num : fallback;
}

function normalizePipelines(pipelines = []) {
  return (Array.isArray(pipelines) ? pipelines : [])
    .map((pipeline, pipelineIndex) => ({
      ...pipeline,
      order: getOrder(pipeline, pipelineIndex),
      stages: (Array.isArray(pipeline.stages) ? pipeline.stages : [])
        .slice()
        .sort((left, right) => getOrder(left) - getOrder(right)),
    }))
    .sort((left, right) => getOrder(left) - getOrder(right));
}

function getVisibleStages(stages = []) {
  return stages.filter((stage) => !stage.hidden && !stage.archived);
}

function pickDefaultPipeline(pipelines = []) {
  return pipelines.find((pipeline) => pipeline.isDefault && !pipeline.archived)
    || pipelines.find((pipeline) => !pipeline.archived)
    || pipelines[0]
    || null;
}

function formatMoneyMap(map = {}, none = '—') {
  const entries = Object.entries(map || {}).filter(([, value]) => Number(value) > 0);
  if (!entries.length) return none;
  return entries
    .map(([currency, value]) => `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`)
    .join(' + ');
}

function formatMoney(value, currency = 'PLN', none = '—') {
  if (value === null || value === undefined || value === '') return none;
  const num = Number(value);
  if (!Number.isFinite(num)) return `${value} ${currency || ''}`.trim();
  return `${num.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency || 'PLN'}`;
}

function formatDateTime(value, none = '—') {
  if (!value) return none;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return none;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getHealthTone(healthStatus) {
  const value = String(healthStatus || '').toLowerCase();
  if (value.includes('healthy')) return 'healthy';
  if (value.includes('waiting')) return 'waiting';
  if (value.includes('risk')) return 'risk';
  if (value.includes('stale')) return 'stale';
  if (value.includes('won')) return 'won';
  if (value.includes('lost')) return 'lost';
  return 'unknown';
}

function isClosedDeal(deal = {}, stage = {}) {
  return stage.isWon || stage.isLost || deal.status === 'won' || deal.status === 'lost';
}

function getOwnerLabel(deal = {}, t) {
  return deal.ownerName || deal.responsible?.email || t('deals.workspace.unassigned', '—');
}

function getStageAge(deal = {}, t) {
  const days = Number(deal.daysInStage);
  if (!Number.isFinite(days)) return t('deals.workspace.newInStage', 'New in stage');
  return t('deals.workspace.daysInStage', '{{count}}d in stage', { count: days });
}

function getNextActionMeta(deal = {}, stage = {}, t) {
  const closed = isClosedDeal(deal, stage);
  if (!deal.nextActionAt) {
    return {
      missing: !closed,
      label: closed ? '' : t('deals.workspace.noNextAction', 'No next action'),
    };
  }
  const type = deal.nextActionType ? t(`deals.workspace.nextActionTypes.${deal.nextActionType}`, deal.nextActionType) : '';
  const due = formatDateTime(deal.nextActionAt);
  return {
    missing: false,
    overdue: new Date(deal.nextActionAt).getTime() < Date.now() && !closed,
    label: type ? `${type} · ${due}` : due,
  };
}

function flattenBoardStages(stages = []) {
  return stages.flatMap((stage) => (stage.deals || []).map((deal) => ({ ...deal, stage })));
}

function buildAttention(stages = [], t) {
  const items = [];
  const now = Date.now();
  stages.forEach((stage) => {
    (stage.deals || []).forEach((deal) => {
      if (isClosedDeal(deal, stage)) return;
      const title = deal.title || t('deals.details.untitled', 'Untitled deal');
      if (!deal.nextActionAt) {
        items.push({ key: `${deal.id}-missing`, deal, stage, tone: 'danger', label: t('deals.workspace.noNextAction', 'No next action'), title });
        return;
      }
      const due = new Date(deal.nextActionAt).getTime();
      if (Number.isFinite(due) && due < now) {
        items.push({ key: `${deal.id}-overdue`, deal, stage, tone: 'warning', label: t('deals.workspace.overdueNextAction', 'Overdue next action'), title });
      }
      const health = String(deal.healthStatus || '').toLowerCase();
      if (health.includes('risk') || health.includes('stale') || deal.staleByRotDays) {
        items.push({ key: `${deal.id}-health`, deal, stage, tone: 'warning', label: t('deals.workspace.needsAttention', 'Needs attention'), title });
      }
    });
  });
  return items.slice(0, 8);
}

function WorkspaceShell({
  title,
  subtitle,
  badge,
  actions,
  controls,
  controlsAria,
  children,
}) {
  return (
    <div className={s.workspace}>
      <header className={s.workspaceTopbar}>
        <div className={s.headerMain}>
          <h1>{title}</h1>
          <div className={s.subtitleRow}>
            {subtitle ? <p>{subtitle}</p> : null}
            {badge ? <span className={s.countText}>{badge}</span> : null}
          </div>
        </div>
        {actions ? <div className={s.actions}>{actions}</div> : null}
      </header>
      <section className={s.controls} aria-label={controlsAria}>
        {controls}
      </section>
      <main className={s.content}>
        {children}
      </main>
    </div>
  );
}

function FilterBox({ icon, label, kind, children }) {
  const className = kind === 'search' ? s.searchBox : kind === 'quick' ? s.quickBox : s.filterBox;
  return (
    <div className={className}>
      {icon}
      <div>
        {label ? <span className={s.controlLabel}>{label}</span> : null}
        {children}
      </div>
    </div>
  );
}

function HealthChip({ status, t }) {
  if (!status) return null;
  const tone = getHealthTone(status);
  return (
    <span className={`${s.healthDot} ${s[`health_${tone}`] || ''}`} title={status}>
      <Circle size={9} aria-hidden="true" fill="currentColor" />
      <span>{t(`deals.workspace.health.${tone}`, status)}</span>
    </span>
  );
}

function NextActionChip({ deal, stage, t }) {
  const meta = getNextActionMeta(deal, stage, t);
  if (!meta.label) return null;
  return (
    <span className={`${s.nextActionChip} ${meta.missing ? s.nextActionMissing : ''} ${meta.overdue ? s.nextActionOverdue : ''}`}>
      <CalendarClock size={13} aria-hidden="true" />
      <span>{meta.label}</span>
    </span>
  );
}

function DealSignals({ deal, stage, t }) {
  return (
    <div className={s.signals}>
      <HealthChip status={deal.healthStatus} t={t} />
      <NextActionChip deal={deal} stage={stage} t={t} />
      {deal.staleByRotDays ? (
        <span className={s.rotWarning}>
          <AlertTriangle size={13} aria-hidden="true" />
          <span>{t('deals.workspace.rotWarning', 'Rotting')}</span>
        </span>
      ) : null}
    </div>
  );
}

function SalesPipelineLine({ stages, activeStageId, onStageClick, t }) {
  const aggregates = useMemo(() => Object.fromEntries(stages.map((stage) => [
    String(stage.id),
    {
      count: Number(stage.count || 0),
      totals: stage.sum || {},
      weighted: stage.weighted || {},
    },
  ])), [stages]);

  return (
    <PipelinePath
      stages={stages}
      currentStageId={activeStageId}
      aggregates={aggregates}
      onSelect={onStageClick}
      ariaLabel={t('deals.workspace.pipelineLine', 'Pipeline line')}
      wonLabel={t('deals.actions.won', 'Won')}
      lostLabel={t('deals.actions.lost', 'Lost')}
    />
  );
}

function StageMoveSelect({ deal, stages, currentStage, onMove, t }) {
  return (
    <select
      className={s.stageMoveSelect}
      value={currentStage?.id || deal.stageId || ''}
      aria-label={t('deals.workspace.moveStage', 'Move stage')}
      onChange={(event) => {
        const target = stages.find((stage) => String(stage.id) === String(event.target.value));
        if (target && String(target.id) !== String(currentStage?.id || deal.stageId || '')) onMove(deal, target);
      }}
    >
      {stages.map((stage) => (
        <option key={stage.id} value={stage.id}>{stage.name}</option>
      ))}
    </select>
  );
}

function PipelineDealCard({ deal, stage, onOpen, onWon, onLost, onDelete, canDelete, t }) {
  const priority = Number.isFinite(Number(deal.priority)) ? Number(deal.priority) : null;
  const title = deal.title || t('deals.details.untitled', 'Untitled deal');
  const wonLabel = t('deals.actions.won', 'Won');
  const lostLabel = t('deals.actions.lost', 'Lost');
  const deleteLabel = t('deals.workspace.deleteAction', 'Delete');

  const handleCardClick = useCallback((event) => {
    if (event.target.closest('button')) return;
    onOpen(deal.id);
  }, [deal.id, onOpen]);

  const handleCardKeyDown = useCallback((event) => {
    if (event.target.closest('button')) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(deal.id);
    }
  }, [deal.id, onOpen]);

  return (
    <article
      className={s.pipelineDealCard}
      style={{ '--stage-color': stage.color || '#64748b' }}
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      aria-label={title}
    >
      <div className={s.pipelineDealIdentity}>
        <button type="button" className={s.pipelineDealMain} onClick={() => onOpen(deal.id)}>
          <strong>{title}</strong>
        </button>

        <div className={s.pipelineDealAccount}>
          <span>{deal.counterpartyName || t('deals.workspace.noCompany', '—')}</span>
          {deal.contactName ? <small>{deal.contactName}</small> : null}
        </div>
      </div>

      <span className={s.pipelineDealAmount}>{formatMoney(deal.value, deal.currency)}</span>

      <DealSignals deal={deal} stage={stage} t={t} />

      <div className={s.pipelineDealFooter}>
        <span>{getOwnerLabel(deal, t)}</span>
        <span>{getStageAge(deal, t)}</span>
        {priority !== null ? <span className={s.priorityChip}>{t('deals.workspace.priorityShort', 'P{{value}}', { value: priority })}</span> : null}
      </div>

      <div className={s.pipelineDealActions}>
        {!stage.isWon ? (
          <button type="button" onClick={() => onWon(deal)} aria-label={wonLabel} title={wonLabel}>
            <Check size={13} aria-hidden="true" />
          </button>
        ) : null}
        {!stage.isLost ? (
          <button type="button" onClick={() => onLost(deal)} aria-label={lostLabel} title={lostLabel}>
            <X size={13} aria-hidden="true" />
          </button>
        ) : null}
        {canDelete ? (
          <button type="button" onClick={() => onDelete(deal)} aria-label={deleteLabel} title={deleteLabel}>
            <Trash2 size={13} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </article>
  );
}

function PipelineStageColumns({
  stages,
  activeStageId,
  onCreate,
  onOpen,
  onWon,
  onLost,
  onDelete,
  canDelete,
  t,
}) {
  const [collapsedStageIds, setCollapsedStageIds] = useState(() => new Set());

  const toggleStage = useCallback((stageId) => {
    setCollapsedStageIds((current) => {
      const next = new Set(current);
      const key = String(stageId);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return (
    <div className={s.pipelineColumns} aria-label={t('deals.workspace.pipelineColumns', 'Pipeline stage sections')}>
      {stages.map((stage) => {
        const active = String(activeStageId || '') === String(stage.id);
        const terminalClass = stage.isWon ? s.pipelineColumnWon : stage.isLost ? s.pipelineColumnLost : '';
        const deals = Array.isArray(stage.deals) ? stage.deals : [];
        const collapsed = collapsedStageIds.has(String(stage.id));
        return (
          <section
            key={stage.id}
            className={`${s.pipelineStageColumn} ${active ? s.pipelineStageColumnActive : ''} ${terminalClass}`}
            style={{ '--stage-color': stage.color || '#64748b' }}
            data-stage-section={stage.id}
            tabIndex={-1}
            aria-label={stage.name}
          >
            <div className={s.pipelineColumnRail} style={{ background: stage.color || '#64748b' }} />
            <div className={s.pipelineStageHeader}>
              <button
                type="button"
                className={s.pipelineStageToggle}
                onClick={() => toggleStage(stage.id)}
                aria-expanded={!collapsed}
                aria-label={stage.name}
                title={stage.name}
              >
                <ChevronRight size={14} aria-hidden="true" />
                <span className={s.stageSwatch} style={{ background: stage.color || '#64748b' }} />
                <strong>{stage.name}</strong>
              </button>
              <div className={s.pipelineStageStats}>
                <span>{t('deals.workspace.dealCount', '{{count}} deals', { count: Number(stage.count || 0) })}</span>
                <strong>{formatMoneyMap(stage.sum)}</strong>
              </div>
              <button type="button" className={s.pipelineStageAdd} onClick={() => onCreate(stage.id)}>
                <Plus size={14} aria-hidden="true" />
                <span>{t('deals.workspace.addDealShort', 'Deal')}</span>
              </button>
            </div>
            {!collapsed ? (
              <div className={s.pipelineColumnCards}>
                {deals.length ? deals.map((deal) => (
                  <PipelineDealCard
                    key={deal.id}
                    deal={deal}
                    stage={stage}
                    onOpen={onOpen}
                    onWon={onWon}
                    onLost={onLost}
                    onDelete={onDelete}
                    canDelete={canDelete}
                    t={t}
                  />
                )) : (
                  <div className={s.pipelineColumnEmpty}>
                    <span>{t('deals.workspace.noDealsInStage', 'No deals')}</span>
                    <button type="button" onClick={() => onCreate(stage.id)}>
                      <Plus size={14} aria-hidden="true" />
                      <span>{t('deals.workspace.addDealShort', 'Deal')}</span>
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function PipelineWorkspace({
  stages,
  activeStageId,
  onStageClick,
  onCreate,
  onOpen,
  onWon,
  onLost,
  onDelete,
  canDelete,
  t,
}) {
  const stageCount = Math.max(stages.length, 1);
  const canvasMinWidth = stageCount * 205;
  return (
    <section
      className={s.pipelineStageWorkspace}
      style={{
        '--stage-count': stageCount,
        '--stage-canvas-min': `${canvasMinWidth}px`,
      }}
    >
      <div className={s.pipelineStageScroller}>
        <div className={s.pipelineStageCanvas}>
          <SalesPipelineLine stages={stages} activeStageId={activeStageId} onStageClick={onStageClick} t={t} />
          <PipelineStageColumns
            stages={stages}
            activeStageId={activeStageId}
            onCreate={onCreate}
            onOpen={onOpen}
            onWon={onWon}
            onLost={onLost}
            onDelete={onDelete}
            canDelete={canDelete}
            t={t}
          />
        </div>
      </div>
    </section>
  );
}

function AttentionBand({ items, onOpen, t }) {
  if (!items.length) return null;
  const visibleItems = items.slice(0, 3);
  const hiddenCount = items.length - visibleItems.length;
  return (
    <section className={s.attentionBand} aria-label={t('deals.workspace.attentionTitle', 'Needs attention')}>
      <div className={s.attentionTitle}>
        <AlertTriangle size={15} aria-hidden="true" />
        <strong>{t('deals.workspace.attentionTitle', 'Needs attention')}</strong>
      </div>
      <div className={s.attentionItems}>
        {visibleItems.map((item) => (
          <button key={item.key} type="button" className={s.attentionItem} onClick={() => onOpen(item.deal.id)}>
            <span>{item.label}</span>
            <strong>{item.title}</strong>
            <small>{item.stage.name}</small>
          </button>
        ))}
        {hiddenCount > 0 ? <span className={s.attentionMore}>+{hiddenCount}</span> : null}
      </div>
    </section>
  );
}

function DealBoardCard({ deal, stage, onOpen, onWon, onLost, t }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { dealId: deal.id, sourceStageId: deal.stageId },
  });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  const priority = Number.isFinite(Number(deal.priority)) ? Number(deal.priority) : null;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`${s.boardCard} ${isDragging ? s.cardDragging : ''}`}
      onDoubleClick={() => onOpen(deal.id)}
    >
      <div className={s.cardStrip} style={{ background: stage.color || '#64748b' }} />
      <div className={s.cardHead}>
        <button type="button" className={s.dragButton} aria-label={t('deals.workspace.dragDeal', 'Drag deal')} title={t('deals.workspace.dragDeal', 'Drag deal')} {...attributes} {...listeners}>
          <GripVertical size={15} aria-hidden="true" />
        </button>
        <button type="button" className={s.cardTitleButton} onClick={() => onOpen(deal.id)}>
          <strong>{deal.title || t('deals.details.untitled', 'Untitled deal')}</strong>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>

      <div className={s.cardAccount}>
        <span>{deal.counterpartyName || t('deals.workspace.noCompany', '—')}</span>
        {deal.contactName ? <small>{deal.contactName}</small> : null}
      </div>

      <div className={s.cardValueRow}>
        <span>{formatMoney(deal.value, deal.currency)}</span>
        <span>{deal.probability || 0}%</span>
      </div>

      <DealSignals deal={deal} stage={stage} t={t} />

      <div className={s.cardFooter}>
        <span>{getOwnerLabel(deal, t)}</span>
        <span>{getStageAge(deal, t)}</span>
        {priority !== null ? <span className={s.priorityChip}>{t('deals.workspace.priorityShort', 'P{{value}}', { value: priority })}</span> : null}
      </div>

      <div className={s.cardActions}>
        {!stage.isWon ? <button type="button" onClick={() => onWon(deal)}>{t('deals.actions.won', 'Won')}</button> : null}
        {!stage.isLost ? <button type="button" className={s.dangerLink} onClick={() => onLost(deal)}>{t('deals.actions.lost', 'Lost')}</button> : null}
      </div>
    </article>
  );
}

function BoardColumn({ stage, onOpen, onCreate, onWon, onLost, t }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const count = Number(stage.count || 0);
  const wipLimit = Number(stage.wipLimit);
  const wipWarning = Number.isFinite(wipLimit) && wipLimit > 0 && count > wipLimit;
  const terminalClass = stage.isWon ? s.columnWon : stage.isLost ? s.columnLost : '';

  return (
    <section ref={setNodeRef} className={`${s.boardColumn} ${terminalClass} ${isOver ? s.columnOver : ''}`}>
      <header className={s.columnHeader}>
        <div className={s.columnTitle}>
          <span className={s.stageSwatch} style={{ background: stage.color || '#64748b' }} />
          <h2>{stage.name}</h2>
          {stage.isWon ? <span className={s.terminalBadge}>{t('deals.actions.won', 'Won')}</span> : null}
          {stage.isLost ? <span className={s.terminalBadge}>{t('deals.actions.lost', 'Lost')}</span> : null}
        </div>
        <div className={s.columnStats}>
          <span>{t('deals.workspace.dealCount', '{{count}} deals', { count })}</span>
          <span>{formatMoneyMap(stage.sum)}</span>
          <span>{t('deals.workspace.weightedValue', 'Weighted {{value}}', { value: formatMoneyMap(stage.weighted) })}</span>
        </div>
        <div className={s.columnWarnings}>
          {wipWarning ? <span><AlertTriangle size={13} aria-hidden="true" /> {t('deals.workspace.wipWarning', 'WIP {{count}}/{{limit}}', { count, limit: wipLimit })}</span> : null}
          {stage.rotDays ? <span>{t('deals.workspace.rotDays', 'Rot {{count}}d', { count: stage.rotDays })}</span> : null}
        </div>
      </header>

      <div className={s.columnBody}>
        {Array.isArray(stage.deals) && stage.deals.length ? stage.deals.map((deal) => (
          <DealBoardCard
            key={deal.id}
            deal={deal}
            stage={stage}
            onOpen={onOpen}
            onWon={onWon}
            onLost={onLost}
            t={t}
          />
        )) : (
          <div className={s.emptyColumn}>
            <p>{t('deals.workspace.noDealsInStage', 'No deals')}</p>
            <button type="button" onClick={() => onCreate(stage.id)}>
              <Plus size={14} aria-hidden="true" />
              <span>{t('deals.workspace.addDeal', 'Add deal')}</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function BoardMode({ stages, sensors, onDragEnd, onOpen, onCreate, onWon, onLost, t }) {
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <div className={s.boardScroller}>
        <div className={s.boardColumns}>
          {stages.map((stage) => (
            <BoardColumn
              key={stage.id}
              stage={stage}
              onOpen={onOpen}
              onCreate={onCreate}
              onWon={onWon}
              onLost={onLost}
              t={t}
            />
          ))}
        </div>
      </div>
    </DndContext>
  );
}

function ListMode({ rows, stages, onOpen, onMove, onWon, onLost, onDelete, canDelete, t }) {
  return (
    <div className={s.listTable} role="table" aria-label={t('deals.title', 'Deals')}>
      <div className={s.listHead} role="row">
        <span>{t('deals.columns.title', 'Deal')}</span>
        <span>{t('deals.columns.amount', 'Amount')}</span>
        <span>{t('deals.fields.stage', 'Stage')}</span>
        <span>{t('deals.columns.owner', 'Owner')}</span>
        <span>{t('deals.workspace.signals', 'Signals')}</span>
        <span>{t('deals.columns.actions', 'Actions')}</span>
      </div>
      {rows.length ? rows.map(({ stage, ...deal }) => (
        <div key={deal.id} className={s.listRow} role="row">
          <button type="button" className={s.listDealButton} onClick={() => onOpen(deal.id)}>
            <strong>{deal.title || t('deals.details.untitled', 'Untitled deal')}</strong>
            <small>{deal.counterpartyName || t('deals.workspace.noCompany', '—')}{deal.contactName ? ` · ${deal.contactName}` : ''}</small>
          </button>
          <span>{formatMoney(deal.value, deal.currency)}</span>
          <span>{stage.name}</span>
          <span>{getOwnerLabel(deal, t)}</span>
          <DealSignals deal={deal} stage={stage} t={t} />
          <div className={s.rowActions}>
            <StageMoveSelect deal={deal} stages={stages} currentStage={stage} onMove={onMove} t={t} />
            {!stage.isWon ? <button type="button" onClick={() => onWon(deal)}>{t('deals.actions.won', 'Won')}</button> : null}
            {!stage.isLost ? <button type="button" className={s.dangerLink} onClick={() => onLost(deal)}>{t('deals.actions.lost', 'Lost')}</button> : null}
            {canDelete ? <button type="button" className={s.dangerLink} onClick={() => onDelete(deal)}>{t('deals.workspace.deleteAction', 'Delete')}</button> : null}
          </div>
        </div>
      )) : (
        <div className={s.emptyStage}>
          <span>{t('deals.workspace.noDeals', 'No deals')}</span>
        </div>
      )}
    </div>
  );
}

function LostReasonModal({ open, deal, reasons, value, onValueChange, onConfirm, onCancel, loading, onConfigure, t }) {
  const activeReasons = (reasons || []).filter((reason) => !reason.archived);
  return (
    <Modal
      open={open}
      title={t('deals.workspace.lostModalTitle', 'Mark deal as lost')}
      onClose={loading ? undefined : onCancel}
      footer={(
        <>
          <Modal.Button onClick={onCancel} disabled={loading}>{t('common.cancel', 'Cancel')}</Modal.Button>
          <Modal.Button variant="primary" onClick={onConfirm} disabled={loading || !value} data-variant="danger">
            {t('deals.workspace.markLost', 'Mark lost')}
          </Modal.Button>
        </>
      )}
    >
      <div className={s.lostDialog}>
        <p>{t('deals.workspace.lostModalText', '{{title}} needs a lost reason before moving to a lost stage.', { title: deal?.title || t('deals.details.untitled', 'Untitled deal') })}</p>
        <SelectField
          label={t('deals.workspace.lostReason', 'Lost reason')}
          value={value || ''}
          onValueChange={onValueChange}
          options={activeReasons.map((reason) => ({ value: reason.id, label: reason.name }))}
          placeholder={t('deals.workspace.selectLostReason', 'Select reason')}
          searchable
        />
        {!activeReasons.length ? (
          <div className={s.lostEmpty}>
            <span>{t('deals.workspace.noLostReasons', 'No active lost reasons configured.')}</span>
            <button type="button" onClick={onConfigure}>{t('deals.workspace.configurePipeline', 'Configure Pipeline')}</button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

export default function DealsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const view = 'pipeline';
  const [selectedPipelineId, setSelectedPipelineId] = useState(() => readStorage(SALES_PIPELINE_STORAGE_KEY, ''));
  const [filters, setFilters] = useState({
    q: '',
    responsibleId: '',
    healthStatus: '',
    nextAction: '',
  });
  const [activeStageId, setActiveStageId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [lostTarget, setLostTarget] = useState(null);
  const [lostReasonId, setLostReasonId] = useState('');
  const [boardError, setBoardError] = useState('');

  const { can } = useAclPermissions();
  const canDeleteDeal = can('deal:delete');
  const { options: ownerOptions } = useCompanyMembersOptions();
  const { data: pipelinesData = [] } = useGetPipelinesQuery();
  const { data: lostReasons = [] } = useGetLostReasonsQuery();
  const pipelines = useMemo(() => normalizePipelines(pipelinesData), [pipelinesData]);
  const activePipelines = useMemo(() => pipelines.filter((pipeline) => !pipeline.archived), [pipelines]);
  const defaultPipeline = useMemo(() => pickDefaultPipeline(activePipelines), [activePipelines]);
  const selectedPipeline = useMemo(() => (
    activePipelines.find((pipeline) => String(pipeline.id) === String(selectedPipelineId || ''))
    || defaultPipeline
    || null
  ), [activePipelines, defaultPipeline, selectedPipelineId]);
  const effectivePipelineId = selectedPipeline?.id || '';
  const pipelineOptions = useMemo(() => (
    activePipelines.map((pipeline) => ({ value: pipeline.id, label: pipeline.name || pipeline.id }))
  ), [activePipelines]);

  useEffect(() => {
    if (!effectivePipelineId) return;
    setSelectedPipelineId(effectivePipelineId);
    writeStorage(SALES_PIPELINE_STORAGE_KEY, effectivePipelineId);
  }, [effectivePipelineId]);

  const boardQuery = useMemo(() => compact({
    pipelineId: effectivePipelineId,
    q: filters.q,
    responsibleId: filters.responsibleId,
    healthStatus: filters.healthStatus,
    nextAction: filters.nextAction,
    perStageLimit: 80,
  }), [effectivePipelineId, filters]);

  const {
    data: boardData,
    isFetching: boardLoading,
    error: boardFetchError,
    refetch: refetchBoard,
  } = useGetDealsBoardQuery(boardQuery, { skip: !effectivePipelineId });

  const [deleteDeal, { isLoading: deleting }] = useDeleteDealMutation();
  const [moveDealStage, { isLoading: movingStage }] = useMoveDealStageMutation();
  const [markWon, { isLoading: markingWon }] = useMarkWonMutation();
  const [markLost, { isLoading: markingLost }] = useMarkLostMutation();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const stages = useMemo(() => boardData?.stages || [], [boardData?.stages]);
  const visibleStages = useMemo(() => getVisibleStages(stages), [stages]);
  const flatDeals = useMemo(() => flattenBoardStages(visibleStages), [visibleStages]);
  const attentionItems = useMemo(() => buildAttention(visibleStages, t), [visibleStages, t]);

  useEffect(() => {
    setActiveStageId('');
  }, [effectivePipelineId]);

  useEffect(() => {
    if (!activeStageId) return;
    if (!visibleStages.some((stage) => String(stage.id) === String(activeStageId))) {
      setActiveStageId('');
    }
  }, [activeStageId, visibleStages]);

  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value || '' }));
  }, []);

  const updatePipeline = useCallback((pipelineId) => {
    setSelectedPipelineId(pipelineId || '');
    writeStorage(SALES_PIPELINE_STORAGE_KEY, pipelineId || '');
    setActiveStageId('');
    setBoardError('');
  }, []);

  const openDetail = useCallback((dealId) => {
    navigate(`/main/deals/${dealId}`);
  }, [navigate]);

  const createDeal = useCallback((stageId = '') => {
    const params = new URLSearchParams();
    if (effectivePipelineId) params.set('pipelineId', effectivePipelineId);
    if (stageId) params.set('stageId', stageId);
    const suffix = params.toString();
    navigate(`/main/deals/new${suffix ? `?${suffix}` : ''}`);
  }, [effectivePipelineId, navigate]);

  const configurePipeline = useCallback(() => {
    navigate('/main/company-settings/deals');
  }, [navigate]);

  const refreshBoard = useCallback(async () => {
    await refetchBoard();
  }, [refetchBoard]);

  const handleMove = useCallback(async (deal, targetStage) => {
    setBoardError('');
    try {
      if (targetStage.isWon) {
        await markWon({ dealId: deal.id }).unwrap();
      } else if (targetStage.isLost) {
        setLostTarget({ deal, stage: targetStage });
        setLostReasonId('');
        return;
      } else {
        await moveDealStage({ dealId: deal.id, stageId: targetStage.id }).unwrap();
      }
      await refreshBoard();
    } catch (error) {
      setBoardError(error?.data?.error || error?.data?.message || error?.message || t('deals.workspace.moveFailed', 'Failed to move deal'));
      await refreshBoard();
    }
  }, [markWon, moveDealStage, refreshBoard, t]);

  const handleDragEnd = useCallback(async ({ active, over }) => {
    const dealId = active?.data?.current?.dealId || active?.id;
    const sourceStageId = active?.data?.current?.sourceStageId;
    const targetStageId = over?.id;
    if (!dealId || !targetStageId || String(sourceStageId || '') === String(targetStageId)) return;
    const targetStage = stages.find((stage) => String(stage.id) === String(targetStageId));
    const deal = stages
      .flatMap((stage) => stage.deals || [])
      .find((item) => String(item.id) === String(dealId));
    if (!targetStage || !deal) return;
    await handleMove(deal, targetStage);
  }, [handleMove, stages]);

  const openLost = useCallback((deal) => {
    const lostStage = stages.find((stage) => stage.isLost);
    if (!lostStage) {
      setBoardError(t('deals.workspace.noLostStage', 'Lost stage is not configured for this pipeline.'));
      return;
    }
    setLostTarget({ deal, stage: lostStage });
    setLostReasonId('');
  }, [stages, t]);

  const markDealWon = useCallback((deal) => {
    const wonStage = stages.find((stage) => stage.isWon);
    if (!wonStage) {
      setBoardError(t('deals.workspace.noWonStage', 'Won stage is not configured for this pipeline.'));
      return;
    }
    handleMove(deal, wonStage);
  }, [handleMove, stages, t]);

  const confirmLost = useCallback(async () => {
    if (!lostTarget?.deal?.id || !lostReasonId) return;
    try {
      await markLost({
        dealId: lostTarget.deal.id,
        payload: { lostReasonId },
      }).unwrap();
      setLostTarget(null);
      setLostReasonId('');
      await refreshBoard();
    } catch (error) {
      setBoardError(error?.data?.error || error?.data?.message || error?.message || t('deals.workspace.markLostFailed', 'Failed to mark lost'));
    }
  }, [lostReasonId, lostTarget, markLost, refreshBoard, t]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget?.id) return;
    await deleteDeal(deleteTarget.id).unwrap();
    setDeleteTarget(null);
    await refreshBoard();
  }, [deleteDeal, deleteTarget, refreshBoard]);

  const focusStage = useCallback((stageId) => {
    if (!stageId) return;
    setActiveStageId(stageId);
    window.setTimeout(() => {
      const selector = `[data-stage-section="${String(stageId).replace(/"/g, '\\"')}"]`;
      const element = document.querySelector(selector);
      if (!element) return;
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      element.focus({ preventScroll: true });
    }, 50);
  }, []);

  const healthOptions = useMemo(() => [
    { value: '', label: t('deals.workspace.allHealth', 'All health') },
    { value: 'healthy', label: t('deals.workspace.health.healthy', 'Healthy') },
    { value: 'waiting', label: t('deals.workspace.health.waiting', 'Waiting') },
    { value: 'at_risk', label: t('deals.workspace.health.risk', 'At risk') },
    { value: 'stale', label: t('deals.workspace.health.stale', 'Stale') },
    { value: 'closed_won', label: t('deals.workspace.health.won', 'Closed won') },
    { value: 'closed_lost', label: t('deals.workspace.health.lost', 'Closed lost') },
  ], [t]);
  const nextActionOptions = useMemo(() => [
    { value: '', label: t('deals.workspace.allNextActions', 'All next actions') },
    { value: 'missing', label: t('deals.workspace.noNextAction', 'No next action') },
    { value: 'overdue', label: t('deals.workspace.overdue', 'Overdue') },
    { value: 'today', label: t('deals.workspace.dueToday', 'Due today') },
    { value: 'upcoming', label: t('deals.workspace.upcoming', 'Upcoming') },
  ], [t]);

  const controls = (
    <>
      <FilterBox icon={<Search size={15} aria-hidden="true" />} kind="search">
        <SearchField
          value={filters.q || ''}
          onValueChange={(value) => updateFilter('q', value)}
          placeholder={t('deals.filters.searchPlaceholder', 'Search deals')}
          size="sm"
          fullWidth={false}
          clearable
        />
      </FilterBox>
      <FilterBox label={t('deals.filters.pipeline', 'Pipeline')}>
        <SelectField
          value={effectivePipelineId || ''}
          onValueChange={updatePipeline}
          options={pipelineOptions}
          size="sm"
          fullWidth={false}
          searchable
        />
      </FilterBox>
      <FilterBox label={t('deals.filters.owner', 'Owner')}>
        <SelectField
          value={filters.responsibleId || ''}
          onValueChange={(value) => updateFilter('responsibleId', value)}
          options={[{ value: '', label: t('deals.filters.allOwners', 'All owners') }, ...ownerOptions]}
          size="sm"
          fullWidth={false}
          searchable
        />
      </FilterBox>
      <FilterBox label={t('deals.workspace.healthLabel', 'Health')}>
        <SelectField
          value={filters.healthStatus || ''}
          onValueChange={(value) => updateFilter('healthStatus', value)}
          options={healthOptions}
          size="sm"
          fullWidth={false}
        />
      </FilterBox>
      <FilterBox label={t('deals.workspace.nextActionLabel', 'Next Action')}>
        <SelectField
          value={filters.nextAction || ''}
          onValueChange={(value) => updateFilter('nextAction', value)}
          options={nextActionOptions}
          size="sm"
          fullWidth={false}
        />
      </FilterBox>
    </>
  );

  const headerActions = (
    <>
      <button type="button" className={s.primaryAction} onClick={() => createDeal()}>
        <Plus size={16} aria-hidden="true" />
        <span>{t('deals.actions.new', 'New deal')}</span>
      </button>
      <button type="button" className={s.secondaryAction} onClick={configurePipeline}>
        <Settings size={16} aria-hidden="true" />
        <span>{t('deals.workspace.configurePipeline', 'Configure Pipeline')}</span>
      </button>
    </>
  );

  const renderBody = () => {
    if (!effectivePipelineId) {
      return (
        <div className={s.emptyBoard}>
          <h2>{t('deals.workspace.createSalesProcess', 'Create a sales process')}</h2>
          <p>{t('deals.workspace.createSalesProcessText', 'Pipeline Builder creates the process used by Sales.')}</p>
          <button type="button" onClick={configurePipeline}>{t('deals.workspace.openBuilder', 'Open Pipeline Builder')}</button>
        </div>
      );
    }
    if (boardLoading) return <div className={s.boardState}>{t('common.loading', 'Loading')}</div>;
    if (boardFetchError) {
      return (
        <div className={s.boardState}>
          <strong>{t('deals.workspace.loadFailed', 'Could not load Sales workspace.')}</strong>
          <button type="button" onClick={refetchBoard}>{t('deals.workspace.retry', 'Retry')}</button>
        </div>
      );
    }
    if (!visibleStages.length) {
      return (
        <div className={s.emptyBoard}>
          <h2>{t('deals.workspace.noStages', 'No stages configured')}</h2>
          <p>{t('deals.workspace.noStagesText', 'This pipeline needs stages before deals can be worked.')}</p>
          <button type="button" onClick={configurePipeline}>{t('deals.workspace.configurePipeline', 'Configure Pipeline')}</button>
        </div>
      );
    }
    if (view === 'board') {
      return (
        <BoardMode
          stages={visibleStages}
          sensors={sensors}
          onDragEnd={handleDragEnd}
          onOpen={openDetail}
          onCreate={createDeal}
          onWon={markDealWon}
          onLost={openLost}
          t={t}
        />
      );
    }
    if (view === 'list') {
      return (
        <ListMode
          rows={flatDeals}
          stages={visibleStages}
          onOpen={openDetail}
          onMove={handleMove}
          onWon={markDealWon}
          onLost={openLost}
          onDelete={setDeleteTarget}
          canDelete={canDeleteDeal}
          t={t}
        />
      );
    }
    return (
      <div className={s.pipelineMode}>
        <PipelineWorkspace
          stages={visibleStages}
          activeStageId={activeStageId}
          onStageClick={focusStage}
          onCreate={createDeal}
          onOpen={openDetail}
          onWon={markDealWon}
          onLost={openLost}
          onDelete={setDeleteTarget}
          canDelete={canDeleteDeal}
          t={t}
        />
        <AttentionBand items={attentionItems} onOpen={openDetail} t={t} />
      </div>
    );
  };

  const badge = t('deals.workspace.badge', '{{count}} records', { count: boardData?.totals?.count || 0 });

  return (
    <WorkspaceShell
      title={t('deals.title', 'Deals')}
      subtitle={t('deals.workspace.subtitle', 'Pipeline workspace')}
      badge={badge}
      actions={headerActions}
      controls={controls}
      controlsAria={t('deals.workspace.controlsAria', 'Sales workspace controls')}
    >
      {boardError ? <div className={s.boardError}>{boardError}</div> : null}
      {renderBody()}

      <LostReasonModal
        open={Boolean(lostTarget)}
        deal={lostTarget?.deal}
        reasons={lostReasons}
        value={lostReasonId}
        onValueChange={setLostReasonId}
        onConfirm={confirmLost}
        onCancel={() => setLostTarget(null)}
        loading={markingLost || movingStage || markingWon}
        onConfigure={configurePipeline}
        t={t}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('deals.workspace.deleteTitle', 'Delete deal?')}
        text={t('deals.workspace.deleteText', 'The deal will be removed from the active workspace.')}
        okText={t('deals.workspace.deleteAction', 'Delete')}
        cancelText={t('common.cancel', 'Cancel')}
        danger
        loading={deleting}
        onOk={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </WorkspaceShell>
  );
}
