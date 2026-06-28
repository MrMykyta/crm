import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ChevronRight, GripVertical, LayoutGrid, List, Plus, Trash2 } from 'lucide-react';

import {
  Workspace,
  useWorkspaceData,
} from '../../../../components/workspace';
import LinkCell from '../../../../components/cells/LinkCell';
import AddButton from '../../../../components/buttons/AddButton/AddButton';
import ConfirmDialog from '../../../../components/dialogs/ConfirmDialog';
import {
  DateField,
  SearchField,
  SelectField,
} from '../../../../components/ui/fields';
import useGridPrefs from '../../../../hooks/useGridPrefs';
import useCompanyMembersOptions from '../../../../hooks/useCompanyMembersOptions';
import useAclPermissions from '../../../../hooks/useAclPermissions';
import PipelinePath from '../../../../components/deals/PipelinePath';

import {
  useDeleteDealMutation,
  useGetDealsQuery,
  useGetPipelinesQuery,
  useMarkWonMutation,
  useMarkLostMutation,
  useMoveDealStageMutation,
} from '../../../../store/rtk/dealsApi';

import s from './DealsListPage.module.css';

// buildStatusLabels: собирает итоговую структуру данных в рамках UI-компонента.
const buildStatusLabels = (t) => ({
  new: t('deals.status.new', 'New'),
  in_progress: t('deals.status.inProgress', 'In progress'),
  won: t('deals.status.won', 'Won'),
  lost: t('deals.status.lost', 'Lost'),
});

const sanitizeDealsQuery = (query = {}) => Object.fromEntries(
  Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '')
);

const DEALS_VIEW_STORAGE_KEY = 'crm.deals.viewMode';
const DEALS_BOARD_PIPELINE_STORAGE_KEY = 'crm.deals.board.pipelineId';
const BOARD_PAGE_LIMIT = 200;

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
    // localStorage can be unavailable in restricted browser contexts.
  }
}

function getStageOrder(stage = {}) {
  const raw = stage.order ?? stage.position ?? 0;
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function normalizePipelines(pipelines = []) {
  return (Array.isArray(pipelines) ? pipelines : [])
    .map((pipeline, pipelineIndex) => ({
      ...pipeline,
      order: Number.isFinite(Number(pipeline.order)) ? Number(pipeline.order) : pipelineIndex,
      stages: (Array.isArray(pipeline.stages) ? pipeline.stages : [])
        .slice()
        .sort((left, right) => getStageOrder(left) - getStageOrder(right)),
    }))
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
}

function pickDefaultPipeline(pipelines = []) {
  return pipelines.find((pipeline) => pipeline.isDefault && !pipeline.archived)
    || pipelines.find((pipeline) => !pipeline.archived)
    || pipelines[0]
    || null;
}

function getVisibleStages(pipeline) {
  return (pipeline?.stages || [])
    .filter((stage) => !stage.hidden && !stage.archived)
    .sort((left, right) => getStageOrder(left) - getStageOrder(right));
}

function getCounterpartyName(deal = {}) {
  return deal.counterparty?.fullName
    || deal.counterparty?.shortName
    || deal.counterparty?.name
    || '';
}

function getOwnerName(deal = {}) {
  const user = deal.responsible || deal.owner;
  if (!user) return '';
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || '';
}

function getEffectiveProbability(deal = {}, stage = {}) {
  const raw = deal.probability ?? deal.effectiveProbability ?? stage?.probability ?? 0;
  const num = Number(raw);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, num));
}

function summarizeDeals(deals = [], stageById = new Map()) {
  const byCurrency = new Map();
  for (const deal of deals) {
    const rawValue = Number(deal.value);
    if (!Number.isFinite(rawValue)) continue;
    const currency = deal.currency || 'PLN';
    const stage = stageById.get(String(deal.stageId || deal.stage?.id || ''));
    const probability = getEffectiveProbability(deal, stage);
    const current = byCurrency.get(currency) || { value: 0, forecast: 0 };
    current.value += rawValue;
    current.forecast += rawValue * (probability / 100);
    byCurrency.set(currency, current);
  }
  return byCurrency;
}

function buildStageAggregates(deals = [], stages = []) {
  const initial = (Array.isArray(stages) ? stages : []).reduce((acc, stage) => {
    if (stage?.id) acc[String(stage.id)] = { count: 0, totals: {} };
    return acc;
  }, {});
  return (Array.isArray(deals) ? deals : []).reduce((acc, deal) => {
    const stageId = String(deal.stageId || deal.stage?.id || '');
    if (!stageId) return acc;
    const current = acc[stageId] || { count: 0, totals: {} };
    current.count += 1;
    const rawValue = Number(deal.value);
    if (Number.isFinite(rawValue) && rawValue > 0) {
      const currency = deal.currency || 'PLN';
      current.totals[currency] = (current.totals[currency] || 0) + rawValue;
    }
    acc[stageId] = current;
    return acc;
  }, initial);
}

function formatMoneySummary(summary, noneLabel = '—') {
  const entries = [...summary.entries()].filter(([, totals]) => totals.value || totals.forecast);
  if (!entries.length) return noneLabel;
  return entries
    .map(([currency, totals]) => `${Number(totals.value || 0).toLocaleString()} ${currency}`)
    .join(' + ');
}

function formatForecastSummary(summary, noneLabel = '—') {
  const entries = [...summary.entries()].filter(([, totals]) => totals.forecast);
  if (!entries.length) return noneLabel;
  return entries
    .map(([currency, totals]) => `${Number(totals.forecast || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`)
    .join(' + ');
}

// buildStatusOptions: собирает итоговую структуру данных в рамках UI-компонента.
const buildStatusOptions = (t, labels, includeAll = false) => {
  const options = [
    { value: 'new', label: labels.new },
    { value: 'in_progress', label: labels.in_progress },
    { value: 'won', label: labels.won },
    { value: 'lost', label: labels.lost },
  ];
  if (!includeAll) return options;
  return [
    { value: '', label: t('deals.filters.allStatuses', 'All statuses') },
    ...options,
  ];
};

// formatMoney: форматирует данные для отображения.
function formatMoney(value, currency, noneLabel = '—') {
  if (value === null || value === undefined || value === '') return noneLabel;
  const num = Number(value);
  if (Number.isNaN(num)) return `${value} ${currency || ''}`.trim();
  const cur = currency || 'PLN';
  return `${num.toLocaleString()} ${cur}`;
}

function ViewSwitch({ value, onChange, t }) {
  return (
    <div className={s.viewSwitch} role="group" aria-label={t('deals.view.label', 'View')}>
      <button
        type="button"
        className={`${s.viewButton} ${value === 'list' ? s.viewButtonActive : ''}`}
        onClick={() => onChange('list')}
        aria-pressed={value === 'list'}
      >
        <List size={15} aria-hidden="true" />
        <span>{t('deals.view.list', 'Список')}</span>
      </button>
      <button
        type="button"
        className={`${s.viewButton} ${value === 'board' ? s.viewButtonActive : ''}`}
        onClick={() => onChange('board')}
        aria-pressed={value === 'board'}
      >
        <LayoutGrid size={15} aria-hidden="true" />
        <span>{t('deals.view.board', 'Доска')}</span>
      </button>
    </div>
  );
}

function DealCard({
  deal,
  stage,
  statusLabels,
  onOpen,
  onDelete,
  canDelete,
  deleting,
  t,
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: {
      dealId: deal.id,
      sourceStageId: deal.stageId || deal.stage?.id || '',
    },
  });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  const ownerName = getOwnerName(deal);
  const probability = getEffectiveProbability(deal, stage);
  const priority = deal.priority || deal.priorityLabel || deal.priorityValue || '';

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`${s.dealCard} ${isDragging ? s.dealCardDragging : ''}`}
      onClick={() => onOpen(deal.id)}
      tabIndex={0}
      role="button"
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(deal.id);
        }
      }}
      {...attributes}
    >
      <div className={s.cardColorStrip} style={{ background: stage?.color || 'var(--accent)' }} />
      <div className={s.cardHeader}>
        <button
          type="button"
          className={s.dragHandle}
          aria-label={t('deals.board.dragDeal', 'Drag deal')}
          title={t('deals.board.dragDeal', 'Drag deal')}
          onClick={(event) => event.stopPropagation()}
          {...listeners}
        >
          <GripVertical size={15} aria-hidden="true" />
        </button>
        <div className={s.cardTitleBlock}>
          <h3 className={s.cardTitle}>{deal.title || t('deals.details.untitled', 'Untitled deal')}</h3>
          {getCounterpartyName(deal) ? <p className={s.cardCounterparty}>{getCounterpartyName(deal)}</p> : null}
        </div>
      </div>

      <div className={s.cardMeta}>
        <span className={s.cardAmount}>{formatMoney(deal.value, deal.currency, t('common.none', '—'))}</span>
        <span className={s.cardProbability}>{probability}%</span>
      </div>

      <div className={s.cardChips}>
        {deal.status === 'won' || deal.status === 'lost' ? (
          <span className={`${s.statusChip} ${s[`status_${deal.status}`] || ''}`}>
            {statusLabels[deal.status] || deal.status}
          </span>
        ) : null}
        {priority ? <span className={s.priorityChip}>{priority}</span> : null}
        {ownerName ? <span className={s.ownerChip}>{ownerName}</span> : null}
      </div>

      <div className={s.cardActions}>
        <button
          type="button"
          className={s.cardAction}
          onClick={(event) => {
            event.stopPropagation();
            onOpen(deal.id);
          }}
        >
          {t('deals.actions.open', 'Open')}
          <ChevronRight size={14} aria-hidden="true" />
        </button>
        {canDelete ? (
          <button
            type="button"
            className={s.cardDanger}
            disabled={deleting}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(deal);
            }}
            title={t('common.delete', 'Удалить')}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </article>
  );
}

function KanbanColumn({
  stage,
  deals,
  stageById,
  statusLabels,
  canDelete,
  deleting,
  onOpen,
  onDelete,
  onCreate,
  t,
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const summary = summarizeDeals(deals, stageById);

  return (
    <section
      ref={setNodeRef}
      className={`${s.boardColumn} ${isOver ? s.boardColumnOver : ''}`}
      aria-label={stage.name}
    >
      <header className={s.columnHeader}>
        <div className={s.columnTitleRow}>
          <span className={s.stageColor} style={{ background: stage.color || 'var(--accent)' }} />
          <h2>{stage.name}</h2>
          {stage.isWon || stage.isLost ? (
            <span className={s.terminalBadge}>
              {stage.isWon ? t('deals.board.wonColumn', 'Won') : t('deals.board.lostColumn', 'Lost')}
            </span>
          ) : null}
        </div>
        <div className={s.columnStats}>
          <span>{t('deals.board.count', { count: deals.length, defaultValue: `${deals.length} deals` })}</span>
          <span>{formatMoneySummary(summary)}</span>
          <span>{t('deals.board.forecastShort', { value: formatForecastSummary(summary), defaultValue: `Forecast ${formatForecastSummary(summary)}` })}</span>
        </div>
      </header>

      <div className={s.columnCards}>
        {deals.length ? deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            stage={stage}
            statusLabels={statusLabels}
            canDelete={canDelete}
            deleting={deleting}
            onOpen={onOpen}
            onDelete={onDelete}
            t={t}
          />
        )) : (
          <div className={s.emptyColumn}>
            <p>{t('deals.board.emptyColumn', 'Нет сделок')}</p>
            <button type="button" onClick={() => onCreate(stage.id)}>
              <Plus size={14} aria-hidden="true" />
              <span>{t('deals.board.createInStage', 'Создать сделку')}</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// Компонент DealsListPage: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function DealsListPage() {
  const listRef = useRef(null);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    colWidths,
    colOrder,
    colVisibility,
    onColumnResize,
    onColumnOrderChange,
    onColumnVisibilityChange,
  } = useGridPrefs('crm.deals');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewMode, setViewModeState] = useState(() => {
    const saved = readStorage(DEALS_VIEW_STORAGE_KEY, 'list');
    return saved === 'board' ? 'board' : 'list';
  });
  const [boardPipelineId, setBoardPipelineId] = useState(() => readStorage(DEALS_BOARD_PIPELINE_STORAGE_KEY, ''));
  const [boardError, setBoardError] = useState('');
  const [stageOverrides, setStageOverrides] = useState({});
  const [deleteDeal, { isLoading: deleting }] = useDeleteDealMutation();
  const [markWon] = useMarkWonMutation();
  const [markLost] = useMarkLostMutation();
  const [moveDealStage] = useMoveDealStageMutation();
  const { data: pipelinesData = [] } = useGetPipelinesQuery();
  const { can } = useAclPermissions();
  const canDeleteDeal = can('deal:delete');
  const { options: ownerOptions } = useCompanyMembersOptions();
  const statusLabels = useMemo(() => buildStatusLabels(t), [t]);
  const statusOptions = useMemo(
    () => buildStatusOptions(t, statusLabels, true),
    [t, statusLabels]
  );
  const pipelines = useMemo(() => normalizePipelines(pipelinesData), [pipelinesData]);
  const activePipelines = useMemo(
    () => pipelines.filter((pipeline) => !pipeline.archived),
    [pipelines]
  );
  const defaultPipeline = useMemo(() => pickDefaultPipeline(pipelines), [pipelines]);
  const selectedBoardPipeline = useMemo(() => {
    const stored = activePipelines.find((pipeline) => String(pipeline.id) === String(boardPipelineId || ''));
    return stored || defaultPipeline || null;
  }, [activePipelines, boardPipelineId, defaultPipeline]);
  const selectedBoardPipelineId = selectedBoardPipeline?.id || '';
  const visibleBoardStages = useMemo(
    () => getVisibleStages(selectedBoardPipeline),
    [selectedBoardPipeline]
  );
  const stageById = useMemo(() => {
    const map = new Map();
    for (const pipeline of pipelines) {
      for (const stage of pipeline.stages || []) map.set(String(stage.id), stage);
    }
    return map;
  }, [pipelines]);
  const pipelineOptions = useMemo(() => [
    { value: '', label: t('deals.filters.allPipelines', 'All pipelines') },
    ...pipelines.map((pipeline) => ({ value: pipeline.id, label: pipeline.name || pipeline.id })),
  ], [pipelines, t]);
  const boardPipelineOptions = useMemo(() => (
    activePipelines.map((pipeline) => ({ value: pipeline.id, label: pipeline.name || pipeline.id }))
  ), [activePipelines]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const setViewMode = useCallback((next) => {
    const normalized = next === 'board' ? 'board' : 'list';
    setViewModeState(normalized);
    writeStorage(DEALS_VIEW_STORAGE_KEY, normalized);
  }, []);

  const openDetail = useCallback((id) => {
    navigate(`/main/deals/${id}`);
  }, [navigate]);

  const columns = useMemo(() => ([
    {
      key: 'title',
      title: t('deals.columns.title', 'Deal'),
      sortable: true,
      width: 320,
            // render: описывает рендер соответствующего блока UI.
render: (r) => (
        <LinkCell
          primary={r.title}
          secondary={r.counterparty?.fullName || r.counterparty?.shortName || undefined}
          onClick={() => openDetail(r.id)}
          ariaLabel={t('deals.aria.openDeal', {
            title: r.title || r.id,
            defaultValue: `Open deal ${r.title || r.id}`,
          })}
        />
      ),
    },
    {
      key: 'value',
      title: t('deals.columns.amount', 'Amount'),
      sortable: true,
      width: 160,
            // render: описывает рендер соответствующего блока UI.
render: (r) => formatMoney(r.value, r.currency, t('common.none', '—')),
    },
    {
      key: 'status',
      title: t('deals.columns.status', 'Status'),
      sortable: true,
      width: 140,
            // render: описывает рендер соответствующего блока UI.
render: (r) => statusLabels[r.status] || r.status || t('common.none', '—'),
    },
    {
      key: 'responsible',
      title: t('deals.columns.owner', 'Owner'),
      width: 200,
            // render: описывает рендер соответствующего блока UI.
render: (r) => {
        const u = r.responsible;
        return u
          ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email
          : t('common.none', '—');
      },
    },
    {
      key: 'updatedAt',
      title: t('deals.columns.updated', 'Updated'),
      sortable: true,
      width: 180,
            // render: описывает рендер соответствующего блока UI.
render: (r) => (r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : t('common.none', '—')),
    },
  ]), [openDetail, statusLabels, t]);

  const defaultQuery = useMemo(() => ({
    page: 1,
    sort: 'createdAt',
    dir: 'DESC',
    limit: 25,
  }), []);
  const [query, setQuery] = useState(defaultQuery);
  useEffect(() => {
    if (viewMode !== 'board' || !selectedBoardPipelineId) return;
    setQuery((prev) => (
      prev.pipelineId === selectedBoardPipelineId
        ? prev
        : { ...prev, pipelineId: selectedBoardPipelineId, stageId: undefined, page: 1 }
    ));
  }, [selectedBoardPipelineId, viewMode]);

  const stageOptions = useMemo(() => {
    const selected = pipelines.find((pipeline) => String(pipeline.id) === String(query.pipelineId || (viewMode === 'board' ? selectedBoardPipelineId : '') || ''));
    const stages = selected
      ? selected.stages || []
      : pipelines.flatMap((pipeline) => pipeline.stages || []);
    return [
      { value: '', label: t('deals.filters.allStages', 'All stages') },
      ...stages.map((stage) => ({ value: stage.id, label: stage.name || stage.id })),
    ];
  }, [pipelines, query.pipelineId, selectedBoardPipelineId, t, viewMode]);
  const apiQuery = useMemo(() => {
    const next = viewMode === 'board'
      ? {
        ...query,
        page: 1,
        limit: BOARD_PAGE_LIMIT,
        pipelineId: selectedBoardPipelineId || query.pipelineId,
      }
      : query;
    return sanitizeDealsQuery(next);
  }, [query, selectedBoardPipelineId, viewMode]);
  const {
    data: dealsData,
    isFetching: dealsLoading,
    error: dealsError,
    refetch: refetchDeals,
  } = useGetDealsQuery(apiQuery);
  const loadedDeals = useMemo(() => {
    if (Array.isArray(dealsData)) return dealsData;
    if (Array.isArray(dealsData?.items)) return dealsData.items;
    if (Array.isArray(dealsData?.data)) return dealsData.data;
    return [];
  }, [dealsData]);
  const boardDeals = useMemo(() => loadedDeals.map((deal) => {
    const override = stageOverrides[deal.id];
    if (!override) return deal;
    return {
      ...deal,
      stageId: override.stageId,
      pipelineId: override.pipelineId || deal.pipelineId,
      status: override.status || deal.status,
    };
  }), [loadedDeals, stageOverrides]);
  const dealsTotal = Number(dealsData?.total ?? loadedDeals.length ?? 0);
  const hasAnyFilter = Boolean(
    query.q || query.pipelineId || query.stageId || query.responsibleId || query.status || query.dateFrom || query.dateTo
  );

  const workspaceData = useWorkspaceData({
    externalData: loadedDeals,
    externalMeta: {
      total: dealsTotal,
      page: dealsData?.page || query.page || defaultQuery.page,
      limit: dealsData?.limit || query.limit || defaultQuery.limit,
    },
    externalLoading: dealsLoading,
    externalError: dealsError,
    onExternalRefetch: refetchDeals,
    query,
    onQueryChange: setQuery,
    defaultQuery,
  });

  const updateFilter = useCallback((key, value) => {
    setQuery((prev) => ({
      ...prev,
      [key]: value || undefined,
      page: 1,
    }));
  }, []);

  const updateBoardPipeline = useCallback((pipelineId) => {
    setBoardPipelineId(pipelineId || '');
    writeStorage(DEALS_BOARD_PIPELINE_STORAGE_KEY, pipelineId || '');
    setBoardError('');
    setQuery((prev) => ({
      ...prev,
      pipelineId: pipelineId || undefined,
      stageId: undefined,
      page: 1,
    }));
  }, []);

  const columnState = useMemo(() => ({
    widths: colWidths,
    order: colOrder,
    visibility: colVisibility,
  }), [colOrder, colVisibility, colWidths]);

  const handleColumnStateChange = useCallback((next = {}) => {
    onColumnResize(next.widths || {});
    onColumnOrderChange(Array.isArray(next.order) ? next.order : []);
    onColumnVisibilityChange(next.visibility || {});
  }, [onColumnOrderChange, onColumnResize, onColumnVisibilityChange]);

  const actions = useMemo(() => (
    <div className={s.headerActions}>
      <ViewSwitch value={viewMode} onChange={setViewMode} t={t} />
      <AddButton onClick={() => navigate('/main/deals/new')} title={t('deals.actions.new', 'New deal')}>
       {t('deals.actions.new', 'New deal')}
      </AddButton>
    </div>
  ), [navigate, setViewMode, t, viewMode]);

  const rowActions = useCallback((row) => {
    const isWon = row.status === 'won';
    const isLost = row.status === 'lost';
    return (
      <div className={s.rowActions}>
        <button className={s.rowLink} onClick={() => openDetail(row.id)}>
          {t('deals.actions.open', 'Open')}
        </button>
        <span className={s.sep}>·</span>
        <button
          className={s.rowLink}
          disabled={isWon}
          onClick={() => markWon(row.id)}
        >
          {t('deals.actions.won', 'Won')}
        </button>
        <span className={s.sep}>·</span>
        <button
          className={s.rowDanger}
          disabled={isLost}
          onClick={() => markLost(row.id)}
        >
          {t('deals.actions.lost', 'Lost')}
        </button>
        {canDeleteDeal ? (
          <>
            <span className={s.sep}>·</span>
            <button
              type="button"
              className={s.rowDanger}
              disabled={deleting}
              onClick={() => setDeleteTarget(row)}
            >
              {t('common.delete', 'Удалить')}
            </button>
          </>
        ) : null}
      </div>
    );
  }, [canDeleteDeal, deleting, markLost, markWon, openDetail, t]);

  const createInStage = useCallback((stageId) => {
    const params = new URLSearchParams();
    if (selectedBoardPipelineId) params.set('pipelineId', selectedBoardPipelineId);
    if (stageId) params.set('stageId', stageId);
    const suffix = params.toString();
    navigate(`/main/deals/new${suffix ? `?${suffix}` : ''}`);
  }, [navigate, selectedBoardPipelineId]);

  const handleBoardDragEnd = useCallback(async ({ active, over }) => {
    const dealId = active?.data?.current?.dealId || active?.id;
    const targetStageId = over?.id;
    const sourceStageId = active?.data?.current?.sourceStageId;
    if (!dealId || !targetStageId || String(targetStageId) === String(sourceStageId || '')) return;

    const targetStage = stageById.get(String(targetStageId));
    if (!targetStage || targetStage.hidden || targetStage.archived) return;

    setBoardError('');
    setStageOverrides((prev) => ({
      ...prev,
      [dealId]: {
        stageId: targetStage.id,
        pipelineId: targetStage.pipelineId || selectedBoardPipelineId,
        status: targetStage.isWon ? 'won' : targetStage.isLost ? 'lost' : 'in_progress',
      },
    }));

    try {
      await moveDealStage({ dealId, stageId: targetStage.id }).unwrap();
      await refetchDeals();
    } catch (error) {
      setBoardError(error?.data?.error || error?.data?.message || error?.message || t('deals.board.moveFailed', 'Failed to move deal'));
      await refetchDeals();
    } finally {
      setStageOverrides((prev) => {
        const next = { ...prev };
        delete next[dealId];
        return next;
      });
    }
  }, [moveDealStage, refetchDeals, selectedBoardPipelineId, stageById, t]);

  const boardDealsByStage = useMemo(() => {
    const map = new Map(visibleBoardStages.map((stage) => [String(stage.id), []]));
    for (const deal of boardDeals) {
      const stageId = String(deal.stageId || deal.stage?.id || '');
      if (map.has(stageId)) map.get(stageId).push(deal);
    }
    return map;
  }, [boardDeals, visibleBoardStages]);

  const boardSummary = useMemo(() => ({
    count: boardDeals.length,
    money: summarizeDeals(boardDeals, stageById),
  }), [boardDeals, stageById]);
  const stageBarPipeline = useMemo(() => {
    if (viewMode === 'board') return selectedBoardPipeline;
    return activePipelines.find((pipeline) => String(pipeline.id) === String(query.pipelineId || ''))
      || defaultPipeline
      || selectedBoardPipeline
      || null;
  }, [activePipelines, defaultPipeline, query.pipelineId, selectedBoardPipeline, viewMode]);
  const stageBarStages = useMemo(() => stageBarPipeline?.stages || [], [stageBarPipeline]);
  const stageBarDeals = viewMode === 'board' ? boardDeals : workspaceData.rows;
  const stageBarAggregates = useMemo(
    () => buildStageAggregates(stageBarDeals, stageBarStages),
    [stageBarDeals, stageBarStages]
  );
  const handleStageBarSelect = useCallback((stageId) => {
    updateFilter('stageId', stageId);
  }, [updateFilter]);
  const clearStageFilter = useCallback(() => {
    updateFilter('stageId', '');
  }, [updateFilter]);
  const stageBar = (
    <section className={s.stageBarSection} aria-label={t('deals.pipeline.stageBar', 'Pipeline stage overview')}>
      <PipelinePath
        stages={stageBarStages}
        currentStageId={query.stageId || ''}
        aggregates={stageBarAggregates}
        showAll
        allSelected={!query.stageId}
        allLabel={t('deals.filters.allStages', 'All stages')}
        onClear={clearStageFilter}
        onSelect={handleStageBarSelect}
        emptyLabel={t('deals.pipeline.noStages', 'This pipeline has no stages yet.')}
        wonLabel={t('deals.status.won', 'Won')}
        lostLabel={t('deals.status.lost', 'Lost')}
        ariaLabel={t('deals.pipeline.stageBar', 'Pipeline stage overview')}
      />
    </section>
  );

  const boardControls = useMemo(() => [
    {
      key: 'q',
      kind: 'search',
      label: t('common.search', 'Search'),
      control: (
        <SearchField
          value={query.q || ''}
          onValueChange={(value) => updateFilter('q', value)}
          placeholder={t('deals.filters.searchPlaceholder', 'Search deals')}
          size="sm"
          clearable
          fullWidth={false}
        />
      ),
    },
    {
      key: 'stageId',
      label: t('deals.filters.stage', 'Stage'),
      control: (
        <SelectField
          value={query.stageId || ''}
          onValueChange={(value) => updateFilter('stageId', value)}
          options={stageOptions}
          size="sm"
          fullWidth={false}
        />
      ),
    },
    {
      key: 'responsibleId',
      label: t('deals.filters.owner', 'Owner'),
      control: (
        <SelectField
          value={query.responsibleId || ''}
          onValueChange={(value) => updateFilter('responsibleId', value)}
          options={[{ value: '', label: t('deals.filters.allOwners', 'All owners') }, ...ownerOptions]}
          size="sm"
          fullWidth={false}
        />
      ),
    },
    {
      key: 'status',
      label: t('deals.filters.status', 'Status'),
      control: (
        <SelectField
          value={query.status || ''}
          onValueChange={(value) => updateFilter('status', value)}
          options={statusOptions}
          size="sm"
          fullWidth={false}
        />
      ),
    },
    {
      key: 'dateRange',
      label: t('deals.filters.dateRange', 'Date range'),
      control: (
        <div className={s.dateRange}>
          <DateField
            inputClassName={s.dateInput}
            value={query.dateFrom || ''}
            onValueChange={(value) => updateFilter('dateFrom', value)}
            fullWidth={false}
          />
          <DateField
            inputClassName={s.dateInput}
            value={query.dateTo || ''}
            onValueChange={(value) => updateFilter('dateTo', value)}
            fullWidth={false}
          />
        </div>
      ),
    },
  ], [
    ownerOptions,
    query.dateFrom,
    query.dateTo,
    query.q,
    query.responsibleId,
    query.stageId,
    query.status,
    stageOptions,
    statusOptions,
    t,
    updateFilter,
  ]);

  const workspaceColumns = useMemo(() => [
    ...columns.map((column) => ({
      ...column,
      fallbackLabel: column.title,
      minWidth: Math.max(110, Math.min(Number(column.width) || 180, 180)),
      maxWidth: 560,
      category: column.category || 'core',
      required: column.key === 'title',
      numeric: column.key === 'value',
    })),
    {
      key: 'actions',
      fallbackLabel: t('common.actions', 'Actions'),
      width: 280,
      minWidth: 240,
      maxWidth: 360,
      category: 'context',
      required: true,
      render: rowActions,
    },
  ], [columns, rowActions, t]);

  const renderCell = useCallback((row, column) => {
    if (typeof column.render === 'function') return column.render(row);
    const value = row?.[column.key];
    return value == null || value === '' ? '—' : String(value);
  }, []);

  const workspaceControls = useMemo(() => [
    {
      key: 'q',
      kind: 'search',
      label: t('common.search', 'Search'),
      control: (
        <SearchField
          value={query.q || ''}
          onValueChange={(value) => updateFilter('q', value)}
          placeholder={t('deals.filters.searchPlaceholder', 'Search deals')}
          size="sm"
          clearable
          fullWidth={false}
        />
      ),
    },
    {
      key: 'pipelineId',
      label: t('deals.filters.pipeline', 'Pipeline'),
      control: (
        <SelectField
          value={query.pipelineId || ''}
          onValueChange={(value) => updateFilter('pipelineId', value)}
          options={pipelineOptions}
          size="sm"
          fullWidth={false}
        />
      ),
    },
    {
      key: 'stageId',
      label: t('deals.filters.stage', 'Stage'),
      control: (
        <SelectField
          value={query.stageId || ''}
          onValueChange={(value) => updateFilter('stageId', value)}
          options={stageOptions}
          size="sm"
          fullWidth={false}
        />
      ),
    },
    {
      key: 'responsibleId',
      label: t('deals.filters.owner', 'Owner'),
      control: (
        <SelectField
          value={query.responsibleId || ''}
          onValueChange={(value) => updateFilter('responsibleId', value)}
          options={[{ value: '', label: t('deals.filters.allOwners', 'All owners') }, ...ownerOptions]}
          size="sm"
          fullWidth={false}
        />
      ),
    },
    {
      key: 'status',
      label: t('deals.filters.status', 'Status'),
      control: (
        <SelectField
          value={query.status || ''}
          onValueChange={(value) => updateFilter('status', value)}
          options={statusOptions}
          size="sm"
          fullWidth={false}
        />
      ),
    },
    {
      key: 'dateRange',
      label: t('deals.filters.dateRange', 'Date range'),
      control: (
        <div className={s.dateRange}>
          <DateField
            inputClassName={s.dateInput}
            value={query.dateFrom || ''}
            onValueChange={(value) => updateFilter('dateFrom', value)}
            fullWidth={false}
          />
          <DateField
            inputClassName={s.dateInput}
            value={query.dateTo || ''}
            onValueChange={(value) => updateFilter('dateTo', value)}
            fullWidth={false}
          />
        </div>
      ),
    },
  ], [
    ownerOptions,
    pipelineOptions,
    query.dateFrom,
    query.dateTo,
    query.pipelineId,
    query.q,
    query.responsibleId,
    query.stageId,
    query.status,
    statusOptions,
    stageOptions,
    t,
    updateFilter,
  ]);

  const workspaceLabels = useMemo(() => ({
    loading: t('common.loading', 'Loading'),
    errorTitle: t('deals.errorTitle', 'Не удалось загрузить сделки'),
    retry: t('list.refresh', 'Refresh'),
    resetColumns: t('list.columns.reset', 'Reset'),
    columnsMenu: t('list.columns.configureShort', 'Columns'),
    showAllColumns: t('list.columns.configure', 'Show all'),
    showTechnicalColumns: t('list.columns.groupSystem', 'System'),
    hideTechnicalColumns: t('list.columns.hideAdditional', 'Hide extra'),
    requiredColumn: t('list.columns.recommended', 'Recommended'),
    visibleColumns: (count) => t('list.columns.visibleCount', { count }),
    groupLabel: (group) => {
      if (group === 'context') return t('list.columns.groupAdditional', 'Additional');
      if (group === 'technical') return t('list.columns.groupSystem', 'System');
      return t('list.columns.groupMain', 'Main');
    },
    columnLabel: (column) => column.fallbackLabel || column.title || column.key,
  }), [t]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget?.id) return;
    await deleteDeal(deleteTarget.id).unwrap();
    setDeleteTarget(null);
    listRef.current?.refetch?.();
  }, [deleteDeal, deleteTarget]);

  const listView = (
    <div className={s.listPage}>
      {stageBar}
      <Workspace
        ref={listRef}
        title={t('deals.title', 'Deals')}
        badge={t('deals.workspaceCount', {
          count: workspaceData.total,
          defaultValue: `${workspaceData.total}`,
        })}
        actions={actions}
        controls={workspaceControls}
        rows={workspaceData.rows}
        columns={workspaceColumns}
        loading={workspaceData.loading}
        error={workspaceData.error}
        onRetry={workspaceData.refetch}
        onRefetch={workspaceData.refetch}
        renderCell={renderCell}
        getRowId={(row) => row?.id}
        getRowKey={(row) => String(row?.id || row?.title || '')}
        onRowClick={(row) => row?.id && openDetail(row.id)}
        sortKey={workspaceData.query.sort}
        sortDir={workspaceData.query.dir}
        onSort={workspaceData.setSort}
        columnState={columnState}
        onColumnStateChange={handleColumnStateChange}
        emptyState={{
          title: t(
            hasAnyFilter ? 'deals.emptyFilteredTitle' : 'deals.emptyTitle',
            hasAnyFilter ? 'Deals not found' : 'No deals'
          ),
          description: t(
            hasAnyFilter ? 'deals.emptyFilteredText' : 'deals.emptyText',
            hasAnyFilter ? 'Change search or filters.' : 'Create the first deal.'
          ),
        }}
        errorState={{
          title: t('deals.errorTitle', 'Не удалось загрузить сделки'),
          description: String(
            dealsError?.data?.message
            || dealsError?.data?.error
            || dealsError?.message
            || t('common.error', 'Error')
          ),
          retryLabel: t('list.refresh', 'Refresh'),
        }}
        labels={workspaceLabels}
        pagination={workspaceData.pagination}
      />
    </div>
  );

  const boardView = (
    <div className={s.boardPage}>
      <header className={s.boardTopbar}>
        <div className={s.headerMain}>
          <h1>{t('deals.title', 'Deals')}</h1>
          <div className={s.subtitleRow}>
            <span>{t('deals.workspaceCount', { count: boardSummary.count, defaultValue: `${boardSummary.count}` })}</span>
            <span>{formatMoneySummary(boardSummary.money)}</span>
            <span>{t('deals.board.forecastShort', { value: formatForecastSummary(boardSummary.money), defaultValue: `Forecast ${formatForecastSummary(boardSummary.money)}` })}</span>
          </div>
        </div>
        {actions}
      </header>

      <section className={s.boardToolbar} aria-label={t('deals.board.toolbar', 'Board controls')}>
        <div className={s.pipelinePicker}>
          <span>{t('deals.filters.pipeline', 'Pipeline')}</span>
          <SelectField
            value={selectedBoardPipelineId}
            onValueChange={updateBoardPipeline}
            options={boardPipelineOptions}
            placeholder={t('deals.filters.pipeline', 'Pipeline')}
            size="sm"
            fullWidth={false}
          />
        </div>
        <button type="button" className={s.boardRefresh} onClick={refetchDeals}>
          {t('list.refresh', 'Refresh')}
        </button>
      </section>

      <section className={s.boardFilters} aria-label={t('deals.board.filters', 'Board filters')}>
        {boardControls.map((control) => (
          <div key={control.key} className={control.kind === 'search' ? s.boardFilterSearch : s.boardFilter}>
            <span>{control.label}</span>
            {control.control}
          </div>
        ))}
      </section>

      {stageBar}

      {boardError ? <div className={s.boardError}>{boardError}</div> : null}
      {dealsLoading ? <div className={s.boardState}>{t('common.loading', 'Loading')}</div> : null}
      {dealsError ? (
        <div className={s.boardState}>
          <strong>{t('deals.errorTitle', 'Не удалось загрузить сделки')}</strong>
          <button type="button" onClick={refetchDeals}>{t('list.refresh', 'Refresh')}</button>
        </div>
      ) : null}
      {!dealsLoading && !dealsError && !visibleBoardStages.length ? (
        <div className={s.boardState}>
          {t('deals.board.noStages', 'No visible stages in this pipeline.')}
        </div>
      ) : null}

      {!dealsLoading && !dealsError && visibleBoardStages.length ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleBoardDragEnd}
        >
          <div className={s.boardViewport}>
            <div className={s.boardGrid}>
              {visibleBoardStages.map((stage) => (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  deals={boardDealsByStage.get(String(stage.id)) || []}
                  stageById={stageById}
                  statusLabels={statusLabels}
                  canDelete={canDeleteDeal}
                  deleting={deleting}
                  onOpen={openDetail}
                  onDelete={setDeleteTarget}
                  onCreate={createInStage}
                  t={t}
                />
              ))}
            </div>
          </div>
        </DndContext>
      ) : null}
    </div>
  );

  return (
    <>
      {viewMode === 'board' ? boardView : listView}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('deals.confirm.deleteTitle', 'Удалить сделку?')}
        text={t(
          'deals.confirm.deleteText',
          'Сделка будет удалена или архивирована согласно настройкам системы.'
        )}
        okText={t('common.delete', 'Удалить')}
        cancelText={t('common.cancel', 'Отмена')}
        danger
        loading={deleting}
        onOk={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
