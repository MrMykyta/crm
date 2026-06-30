import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  ArrowLeft,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  Flag,
  Mail,
  MessageSquare,
  Phone,
  ReceiptText,
  Save,
  Settings,
  ShoppingCart,
  StickyNote,
  Trash2,
  Trophy,
  UserRound,
} from 'lucide-react';

import {
  DetailLayout,
  DetailSection,
} from '../../../../components/detail';
import ConfirmDialog from '../../../../components/dialogs/ConfirmDialog';
import EntityNotesSection from '../../../../components/notes/EntityNotesSection';
import {
  AutocompleteField,
  DateField,
  NumberField,
  SelectField,
  TextareaField,
  TextField,
} from '../../../../components/ui/fields';
import useCompanyMembersOptions from '../../../../hooks/useCompanyMembersOptions';
import useAclPermissions from '../../../../hooks/useAclPermissions';
import PipelinePath from '../../../../components/deals/PipelinePath';

import {
  useCreateDealMutation,
  useDeleteDealMutation,
  useCreateDealActivityMutation,
  useDeleteDealActivityMutation,
  useGetDealActivitiesQuery,
  useGetDealByIdQuery,
  useGetPipelinesQuery,
  useMarkLostMutation,
  useMarkWonMutation,
  useMoveDealStageMutation,
  useUpdateDealMutation,
} from '../../../../store/rtk/dealsApi';
import { useGetCounterpartyLookupQuery } from '../../../../store/rtk/counterpartyApi';
import { useListTasksQuery } from '../../../../store/rtk/tasksApi';

import s from './DealDetailsPage.module.css';

const EMPTY_VALUES = {
  title: '',
  counterpartyId: '',
  counterpartyName: '',
  pipelineId: '',
  stageId: '',
  value: '',
  currency: 'PLN',
  status: 'new',
  responsibleId: '',
  contactId: '',
  contactName: '',
  expectedCloseDate: '',
  priority: '',
  probability: '',
  nextActionAt: '',
  nextActionType: '',
  healthStatus: '',
  description: '',
};

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function moneyLabel(value, currency, noneLabel = '—') {
  if (value === null || value === undefined || value === '') return noneLabel;
  const num = Number(value);
  if (Number.isNaN(num)) return `${value} ${currency || ''}`.trim();
  return `${num.toLocaleString()} ${currency || 'PLN'}`;
}

function formatDate(value, locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(locale || undefined);
}

function toDateInputValue(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function formatShortDate(value, locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(locale || undefined, { month: 'short', day: 'numeric' });
}

function getDaysSince(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diffMs / 86400000));
}

function getCounterpartyLabel(deal) {
  return (
    deal?.counterparty?.shortName ||
    deal?.counterparty?.fullName ||
    deal?.counterpartyName ||
    ''
  );
}

function getContactLabel(deal) {
  return (
    deal?.contact?.displayName ||
    [deal?.contact?.firstName, deal?.contact?.lastName].filter(Boolean).join(' ') ||
    deal?.contactName ||
    ''
  );
}

function normalizePipelines(data = []) {
  return (Array.isArray(data) ? data : [])
    .map((pipeline) => ({
      ...pipeline,
      stages: (Array.isArray(pipeline?.stages) ? pipeline.stages : [])
        .slice()
        .sort((a, b) => {
          const aOrder = Number(a?.order ?? a?.position ?? 0);
          const bOrder = Number(b?.order ?? b?.position ?? 0);
          if (aOrder !== bOrder) return aOrder - bOrder;
          return String(a?.id || '').localeCompare(String(b?.id || ''));
        }),
    }))
    .sort((a, b) => {
      const aOrder = Number(a?.order ?? 0);
      const bOrder = Number(b?.order ?? 0);
      if (aOrder !== bOrder) return aOrder - bOrder;
      return String(a?.name || '').localeCompare(String(b?.name || ''));
    });
}

function pickDefaultPipeline(pipelines = []) {
  return (
    pipelines.find((pipeline) => pipeline?.isDefault && !pipeline?.archived) ||
    pipelines.find((pipeline) => !pipeline?.archived) ||
    pipelines[0] ||
    null
  );
}

function pickDefaultStage(pipeline) {
  const stages = Array.isArray(pipeline?.stages) ? pipeline.stages : [];
  return (
    stages.find((stage) => stage?.isDefaultEntry && !stage?.archived) ||
    stages.find((stage) => !stage?.archived && !stage?.isWon && !stage?.isLost) ||
    stages.find((stage) => !stage?.archived) ||
    stages[0] ||
    null
  );
}

function toFormDeal(deal = {}) {
  return {
    ...EMPTY_VALUES,
    title: deal?.title || '',
    counterpartyId: deal?.counterpartyId || deal?.counterparty?.id || '',
    counterpartyName: getCounterpartyLabel(deal),
    pipelineId: deal?.pipelineId || deal?.pipeline?.id || '',
    stageId: deal?.stageId || deal?.stage?.id || '',
    value: deal?.value ?? '',
    currency: deal?.currency || 'PLN',
    status: deal?.status || 'new',
    responsibleId: deal?.responsibleId || deal?.responsible?.id || '',
    contactId: deal?.contactId || deal?.contact?.id || '',
    contactName: getContactLabel(deal),
    expectedCloseDate: toDateInputValue(deal?.expectedCloseDate),
    priority: deal?.priority ?? '',
    probability: deal?.probability ?? '',
    nextActionAt: deal?.nextActionAt || '',
    nextActionType: deal?.nextActionType || '',
    healthStatus: deal?.healthStatus || '',
    description: deal?.description || '',
    createdAt: deal?.createdAt || null,
    updatedAt: deal?.updatedAt || null,
    stageEnteredAt: deal?.stageEnteredAt || null,
  };
}

function buildPayload(values = {}) {
  const value = values.value === '' || values.value == null ? null : Number(values.value);
  const priority = values.priority === '' || values.priority == null ? null : Number(values.priority);
  const probability = values.probability === '' || values.probability == null ? null : Number(values.probability);
  return {
    title: asText(values.title),
    counterpartyId: asText(values.counterpartyId),
    pipelineId: asText(values.pipelineId) || null,
    stageId: asText(values.stageId) || null,
    status: values.status || 'new',
    value: Number.isNaN(value) ? null : value,
    currency: asText(values.currency) || 'PLN',
    responsibleId: values.responsibleId || null,
    contactId: values.contactId || null,
    expectedCloseDate: values.expectedCloseDate || null,
    priority: Number.isNaN(priority) ? null : priority,
    probability: Number.isNaN(probability) ? null : probability,
    nextActionAt: values.nextActionAt || null,
    nextActionType: asText(values.nextActionType) || null,
    healthStatus: asText(values.healthStatus) || null,
    description: asText(values.description) || null,
  };
}

function getHealthTone(healthStatus, status) {
  const normalized = String(healthStatus || status || '').toLowerCase();
  if (normalized.includes('won')) return 'won';
  if (normalized.includes('lost')) return 'lost';
  if (normalized.includes('stale') || normalized.includes('risk')) return 'risk';
  if (normalized.includes('wait')) return 'waiting';
  if (normalized.includes('healthy')) return 'healthy';
  return 'neutral';
}

function HealthBadge({ value, status, t }) {
  const tone = getHealthTone(value, status);
  const label = value || (status === 'won' ? t('deals.status.won', 'Won') : status === 'lost' ? t('deals.status.lost', 'Lost') : t('deals.health.unknown', 'Health pending'));
  return (
    <span className={`${s.healthBadge} ${s[`health_${tone}`] || ''}`}>
      <span aria-hidden="true" />
      {label}
    </span>
  );
}

function NextActionBadge({ values, t, locale }) {
  const hasAction = Boolean(values.nextActionAt || values.nextActionType);
  if (!hasAction) {
    return (
      <span className={`${s.nextActionBadge} ${s.nextActionMissing}`}>
        <CalendarClock size={14} aria-hidden="true" />
        {t('deals.nextAction.missing', 'No next action')}
      </span>
    );
  }
  const type = values.nextActionType || t('deals.nextAction.action', 'Action');
  const date = values.nextActionAt ? formatShortDate(values.nextActionAt, locale) : t('common.unscheduled', 'Unscheduled');
  return (
    <span className={s.nextActionBadge}>
      <CalendarClock size={14} aria-hidden="true" />
      {type} · {date}
    </span>
  );
}

function InfoRow({ label, value, to }) {
  const content = to ? <Link to={to}>{value || '—'}</Link> : <strong>{value || '—'}</strong>;
  return (
    <div className={s.infoRow}>
      <span>{label}</span>
      {content}
    </div>
  );
}

function FactGroup({ title, children }) {
  return (
    <section className={s.factGroup}>
      <h3>{title}</h3>
      <div className={s.factGroupBody}>{children}</div>
    </section>
  );
}

function SmartButtonsBar({ dealId, t }) {
  const items = [
    { key: 'offers', label: t('deals.smart.offers', 'Offers'), icon: FileText, count: 0 },
    { key: 'orders', label: t('deals.smart.orders', 'Orders'), icon: ShoppingCart, count: 0 },
    { key: 'invoices', label: t('deals.smart.invoices', 'Invoices'), icon: ReceiptText, count: 0 },
    { key: 'documents', label: t('deals.smart.documents', 'Documents'), icon: ClipboardList, count: 0 },
    { key: 'notes', label: t('deals.smart.notes', 'Notes'), icon: StickyNote, count: '—' },
    { key: 'tasks', label: t('deals.smart.tasks', 'Tasks'), icon: CheckCircle2, count: '—' },
    { key: 'communication', label: t('deals.smart.communication', 'Communication'), icon: MessageSquare, count: '—' },
  ];
  return (
    <div className={s.smartBar} aria-label={t('deals.smart.title', 'Linked sales objects')}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button key={item.key} type="button" disabled={!dealId} title={item.label}>
            <Icon size={14} aria-hidden="true" />
            <span>{item.label}</span>
            <strong>{item.count}</strong>
          </button>
        );
      })}
    </div>
  );
}

const ACTIVITY_TYPES = ['note', 'call', 'email', 'meeting', 'task'];

function getActivityTypeLabel(type, t) {
  const labels = {
    note: t('deals.activity.note', 'Note'),
    call: t('deals.activity.call', 'Call'),
    email: t('deals.activity.email', 'Email'),
    meeting: t('deals.activity.meeting', 'Meeting'),
    task: t('deals.activity.task', 'Task'),
    deal_created: t('deals.activity.systemDealCreated', 'Deal created'),
    stage_change: t('deals.activity.stageChanged', 'Stage changed'),
    status_change: t('deals.activity.statusChanged', 'Status changed'),
    system: t('deals.activity.system', 'System'),
  };
  return labels[type] || type || t('deals.activity.system', 'System');
}

function getActivityTitle(activity, t) {
  const title = activity?.title || '';
  const mapped = {
    deal_created: t('deals.activity.systemDealCreated', 'Deal created'),
    stage_changed: t('deals.activity.stageChanged', 'Stage changed'),
    deal_won: t('deals.activity.dealWon', 'Deal won'),
    deal_lost: t('deals.activity.dealLost', 'Deal lost'),
  };
  if (mapped[title]) return mapped[title];
  if (title) return title;
  return getActivityTypeLabel(activity?.type, t);
}

function getActivityText(activity, t) {
  const metadata = activity?.metadata || {};
  if (activity?.body) return activity.body;
  if (activity?.title === 'deal_created') {
    return t('deals.activity.systemDealCreatedText', 'Deal workspace was created.');
  }
  if (activity?.type === 'stage_change') {
    return t('deals.activity.stageChangedText', '{{from}} → {{to}}', {
      from: metadata.fromStageName || t('common.none', '—'),
      to: metadata.toStageName || t('common.none', '—'),
    });
  }
  if (activity?.type === 'status_change') {
    if (metadata.status === 'won') return t('deals.activity.statusWonText', 'Deal marked as won.');
    if (metadata.status === 'lost') return t('deals.activity.statusLostText', 'Deal marked as lost.');
  }
  return getActivityTypeLabel(activity?.type, t);
}

function getActivityAuthor(activity, t) {
  const author = activity?.author;
  const name = [author?.firstName, author?.lastName].filter(Boolean).join(' ');
  return name || author?.email || t('deals.activity.systemAuthor', 'System');
}

function ActivityComposer({ disabled, t, onCreate, isSubmitting }) {
  const [activityType, setActivityType] = useState('note');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const types = ACTIVITY_TYPES.map((key) => ({ key, label: getActivityTypeLabel(key, t) }));

  const handleSubmit = async () => {
    const cleanTitle = asText(title);
    const cleanBody = asText(body);
    if (!cleanTitle && !cleanBody) {
      setError(t('deals.activity.validationRequired', 'Add a title or description.'));
      return;
    }
    setError('');
    try {
      await onCreate({
        type: activityType,
        title: cleanTitle || null,
        body: cleanBody || null,
      });
      setTitle('');
      setBody('');
    } catch (submitError) {
      setError(submitError?.data?.error || submitError?.message || t('deals.activity.createFailed', 'Activity was not saved.'));
    }
  };

  return (
    <section className={s.composer}>
      <header className={s.composerHeader}>
        <div>
          <strong>{t('deals.activity.composerTitle', 'Activity')}</strong>
          <span>{t('deals.activity.composerSubtitle', 'Capture the last touch and keep the next step visible.')}</span>
        </div>
        {disabled ? <small>{t('deals.activity.saveFirstHint', 'Save the deal to log activity.')}</small> : null}
      </header>
      <div className={s.composerModes}>
        {types.map((item) => (
          <button
            key={item.key}
            type="button"
            disabled={disabled || isSubmitting}
            className={item.key === activityType ? s.modeActive : ''}
            onClick={() => setActivityType(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <input
        className={s.composerTitleInput}
        disabled={disabled || isSubmitting}
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
          setError('');
        }}
        placeholder={t('deals.activity.titlePlaceholder', 'Optional title')}
      />
      <textarea
        disabled={disabled || isSubmitting}
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
          setError('');
        }}
        placeholder={t('deals.activity.placeholder', 'Log what happened, then set the next action...')}
        rows={3}
      />
      {error ? <p className={s.composerError}>{error}</p> : null}
      <div className={s.composerFooter}>
        <span>{t('deals.activity.nextStepHint', 'Add outcome, then schedule the next action.')}</span>
        <button type="button" disabled={disabled || isSubmitting} onClick={handleSubmit}>
          {isSubmitting ? t('deals.activity.submitting', 'Saving...') : t('deals.activity.log', 'Log activity')}
        </button>
      </div>
    </section>
  );
}

function ActivityTimeline({ activities, isLoading, error, t, locale, onDelete, deletingActivityId }) {
  if (isLoading) {
    return (
      <section className={s.timeline} aria-label={t('deals.activity.timeline', 'Activity timeline')}>
        <div className={s.timelineState}>{t('deals.activity.loading', 'Loading activity...')}</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={s.timeline} aria-label={t('deals.activity.timeline', 'Activity timeline')}>
        <div className={s.timelineState}>{t('deals.activity.loadError', 'Activity could not be loaded.')}</div>
      </section>
    );
  }

  if (!activities.length) {
    return (
      <section className={s.timeline} aria-label={t('deals.activity.timeline', 'Activity timeline')}>
        <div className={s.timelineState}>
          <strong>{t('deals.activity.emptyTitle', 'No activity yet')}</strong>
          <span>{t('deals.activity.emptyText', 'Notes, calls, meetings, and lifecycle changes will appear here.')}</span>
        </div>
      </section>
    );
  }

  return (
    <section className={s.timeline} aria-label={t('deals.activity.timeline', 'Activity timeline')}>
      {activities.map((item) => {
        const isSystem = !ACTIVITY_TYPES.includes(item.type);
        const Icon = isSystem ? Activity : item.type === 'call' ? Phone : item.type === 'email' ? Mail : item.type === 'meeting' ? CalendarClock : item.type === 'task' ? CheckCircle2 : StickyNote;
        const canDelete = ACTIVITY_TYPES.includes(item.type);
        return (
          <article key={item.id} className={`${s.timelineItem} ${isSystem ? s.timelineItemSystem : ''}`}>
            <span className={s.timelineIcon}><Icon size={15} aria-hidden="true" /></span>
            <div>
              <header>
                <strong>{getActivityTitle(item, t)}</strong>
                <span>{formatDate(item.occurredAt || item.createdAt, locale)} · {getActivityAuthor(item, t)}</span>
              </header>
              <p>{getActivityText(item, t)}</p>
              <small>{getActivityTypeLabel(item.type, t)}</small>
            </div>
            {canDelete ? (
              <button
                type="button"
                className={s.timelineDelete}
                disabled={deletingActivityId === item.id}
                onClick={() => onDelete(item.id)}
                aria-label={t('deals.activity.delete', 'Delete activity')}
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}

function TasksTab({ dealId }) {
  const { t } = useTranslation();
  const { data, isFetching, error } = useListTasksQuery(
    { dealId, limit: 20, sort: 'updatedAt:desc' },
    { skip: !dealId }
  );
  const tasks = data?.items || [];

  if (isFetching) return <div className={s.placeholder}>{t('common.loading', 'Loading')}</div>;
  if (error) {
    return (
      <DetailSection
        title={t('deals.tasks.emptyTitle', 'Tasks')}
        description={t('deals.tasks.unavailableText', 'Task links are prepared for the activity timeline. No linked tasks could be loaded yet.')}
      />
    );
  }
  if (!tasks.length) {
    return (
      <DetailSection
        title={t('deals.tasks.emptyTitle', 'Tasks')}
        description={t('deals.tasks.emptyText', 'No tasks are linked to this deal yet.')}
      />
    );
  }

  return (
    <DetailSection title={t('deals.tabs.tasks', 'Tasks')}>
      <div className={s.taskList}>
        {tasks.map((task) => (
          <Link key={task.id} to={`/main/tasks/${task.id}`} className={s.taskRow}>
            <span>{task.title || task.id}</span>
            <small>{task.status || '—'}</small>
          </Link>
        ))}
      </div>
    </DetailSection>
  );
}

export default function DealDetailsPage({ createMode = false }) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isCreateMode = createMode || id === 'new' || !id;
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { can } = useAclPermissions();
  const { options: ownerOptions } = useCompanyMembersOptions();

  const [values, setValues] = useState(EMPTY_VALUES);
  const [errors, setErrors] = useState({});
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activePanel, setActivePanel] = useState('overview');
  const [deletingActivityId, setDeletingActivityId] = useState('');
  const [counterpartyTerm, setCounterpartyTerm] = useState('');
  const [counterpartyDebounced, setCounterpartyDebounced] = useState('');
  const [selectedCounterparty, setSelectedCounterparty] = useState(null);

  const canCreateDeal = can('deal:create');
  const canUpdateDeal = can('deal:update');
  const canDeleteDeal = can('deal:delete');
  const editable = isCreateMode ? canCreateDeal : canUpdateDeal;

  const {
    data: detail,
    isFetching: detailLoading,
    error: detailError,
  } = useGetDealByIdQuery(id, {
    skip: isCreateMode || !id,
    refetchOnMountOrArgChange: true,
  });
  const {
    data: activities = [],
    isFetching: activitiesLoading,
    error: activitiesError,
  } = useGetDealActivitiesQuery(
    { dealId: id, limit: 50 },
    { skip: isCreateMode || !id }
  );
  const { data: pipelinesData = [], isFetching: pipelinesLoading } = useGetPipelinesQuery();
  const pipelines = useMemo(() => normalizePipelines(pipelinesData), [pipelinesData]);
  const pipelineById = useMemo(
    () => new Map(pipelines.map((pipeline) => [String(pipeline.id), pipeline])),
    [pipelines]
  );
  const currentPipeline = pipelineById.get(String(values.pipelineId || '')) || null;
  const currentStages = useMemo(
    () => currentPipeline?.stages || [],
    [currentPipeline]
  );
  const currentStage = currentStages.find((stage) => String(stage.id) === String(values.stageId)) || null;
  const prefillPipelineId = searchParams.get('pipelineId') || '';
  const prefillStageId = searchParams.get('stageId') || '';

  const { data: counterpartyOptions = [], isFetching: counterpartyLoading } =
    useGetCounterpartyLookupQuery(
      { term: counterpartyDebounced, limit: 12 },
      { skip: !counterpartyDebounced }
    );

  const [createDeal, { isLoading: creating }] = useCreateDealMutation();
  const [updateDeal, { isLoading: updating }] = useUpdateDealMutation();
  const [deleteDeal, { isLoading: deleting }] = useDeleteDealMutation();
  const [moveDealStage, { isLoading: movingStage }] = useMoveDealStageMutation();
  const [markWon, { isLoading: markingWon }] = useMarkWonMutation();
  const [markLost, { isLoading: markingLost }] = useMarkLostMutation();
  const [createDealActivity, { isLoading: creatingActivity }] = useCreateDealActivityMutation();
  const [deleteDealActivity] = useDeleteDealActivityMutation();
  const saving = creating || updating || movingStage || markingWon || markingLost;

  useEffect(() => {
    const timer = setTimeout(() => {
      setCounterpartyDebounced(asText(counterpartyTerm));
    }, 320);
    return () => clearTimeout(timer);
  }, [counterpartyTerm]);

  useEffect(() => {
    if (!isCreateMode || pipelinesLoading || !pipelines.length) return;
    const requestedPipeline = pipelines.find((pipeline) => (
      String(pipeline.id) === String(prefillPipelineId)
      && !pipeline.archived
    ));
    const pipeline = requestedPipeline || pickDefaultPipeline(pipelines);
    const requestedStage = (pipeline?.stages || []).find((stage) => (
      String(stage.id) === String(prefillStageId)
      && !stage.archived
      && !stage.hidden
    ));
    const stage = requestedStage || pickDefaultStage(pipeline);
    setValues((prev) => ({
      ...prev,
      pipelineId: prev.pipelineId || pipeline?.id || '',
      stageId: prev.stageId || stage?.id || '',
    }));
  }, [isCreateMode, pipelines, pipelinesLoading, prefillPipelineId, prefillStageId]);

  useEffect(() => {
    if (isCreateMode) {
      setValues((prev) => ({ ...EMPTY_VALUES, pipelineId: prev.pipelineId, stageId: prev.stageId }));
      setDirty(false);
      setErrors({});
      setSaveError('');
      return;
    }
    if (!detail) return;
    const next = toFormDeal(detail);
    setValues(next);
    setCounterpartyTerm(next.counterpartyName);
    setSelectedCounterparty(next.counterpartyId ? { id: next.counterpartyId, name: next.counterpartyName } : null);
    setDirty(false);
    setErrors({});
    setSaveError('');
  }, [detail, isCreateMode]);

  const statusLabels = useMemo(() => ({
    new: t('deals.status.new', 'New'),
    in_progress: t('deals.status.inProgress', 'In progress'),
    won: t('deals.status.won', 'Won'),
    lost: t('deals.status.lost', 'Lost'),
  }), [t]);

  const pipelineOptions = useMemo(() => pipelines.map((pipeline) => ({
    value: pipeline.id,
    label: pipeline.archived ? `${pipeline.name} (${t('common.archived', 'Archived')})` : pipeline.name,
    disabled: pipeline.archived,
  })), [pipelines, t]);

  const setField = useCallback((key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setSaveError('');
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }, []);

  const validate = useCallback(() => {
    const nextErrors = {};
    if (!asText(values.title)) nextErrors.title = t('deals.validation.titleRequired', 'Title is required');
    if (!asText(values.counterpartyId)) nextErrors.counterpartyId = t('deals.validation.counterpartyRequired', 'Select a counterparty');
    if (!asText(values.pipelineId)) nextErrors.pipelineId = t('deals.validation.pipelineRequired', 'Select a pipeline');
    if (!asText(values.stageId)) nextErrors.stageId = t('deals.validation.stageRequired', 'Select a stage');
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [t, values.counterpartyId, values.pipelineId, values.stageId, values.title]);

  const syncStageLocally = useCallback((stageId) => {
    const stage = currentStages.find((item) => String(item.id) === String(stageId));
    if (!stage) return;
    setValues((prev) => ({
      ...prev,
      stageId: stage.id,
      status: stage.isWon ? 'won' : stage.isLost ? 'lost' : (prev.status === 'new' && stage.isDefaultEntry ? 'new' : 'in_progress'),
    }));
    setDirty(true);
  }, [currentStages]);

  const handleStageSelect = useCallback(async (stageId) => {
    if (!stageId || stageId === values.stageId) return;
    setSaveError('');
    if (isCreateMode) {
      syncStageLocally(stageId);
      return;
    }
    try {
      const moved = await moveDealStage({ dealId: id, stageId }).unwrap();
      const next = toFormDeal(moved);
      setValues(next);
      setDirty(false);
    } catch (error) {
      setSaveError(error?.data?.error || error?.message || t('common.error', 'Error'));
    }
  }, [id, isCreateMode, moveDealStage, syncStageLocally, t, values.stageId]);

  const handlePipelineSelect = useCallback((pipelineId) => {
    const pipeline = pipelineById.get(String(pipelineId));
    const stage = pickDefaultStage(pipeline);
    setValues((prev) => ({
      ...prev,
      pipelineId,
      stageId: stage?.id || '',
      status: stage?.isWon ? 'won' : stage?.isLost ? 'lost' : prev.status,
    }));
    setDirty(true);
    setSaveError('');
  }, [pipelineById]);

  const handleTerminal = useCallback(async (kind) => {
    const stage = currentStages.find((item) => (kind === 'won' ? item.isWon : item.isLost));
    if (stage) {
      await handleStageSelect(stage.id);
      return;
    }
    if (isCreateMode) {
      setField('status', kind);
      return;
    }
    const action = kind === 'won' ? markWon : markLost;
    const updated = await action(id).unwrap();
    setValues(toFormDeal(updated));
    setDirty(false);
  }, [currentStages, handleStageSelect, id, isCreateMode, markLost, markWon, setField]);

  const noneLabel = t('common.none', '—');

  const handleSave = useCallback(async () => {
    if (!editable || !validate()) return;
    setSaveError('');
    const payload = buildPayload(values);
    try {
      if (isCreateMode) {
        const created = await createDeal(payload).unwrap();
        navigate(`/main/deals/${created.id}`);
      } else {
        const updated = await updateDeal({ dealId: id, payload }).unwrap();
        setValues(toFormDeal(updated));
        setDirty(false);
      }
    } catch (error) {
      setSaveError(error?.data?.error || error?.message || t('common.error', 'Error'));
    }
  }, [createDeal, editable, id, isCreateMode, navigate, t, updateDeal, validate, values]);

  const handleCreateActivity = useCallback(async (payload) => {
    if (!id || isCreateMode) return;
    await createDealActivity({ dealId: id, payload }).unwrap();
  }, [createDealActivity, id, isCreateMode]);

  const handleDeleteActivity = useCallback(async (activityId) => {
    if (!id || !activityId) return;
    setDeletingActivityId(activityId);
    setSaveError('');
    try {
      await deleteDealActivity({ dealId: id, activityId }).unwrap();
    } catch (error) {
      setSaveError(error?.data?.error || error?.message || t('deals.activity.deleteFailed', 'Activity was not deleted.'));
    } finally {
      setDeletingActivityId('');
    }
  }, [deleteDealActivity, id, t]);

  const ownerLabel = useMemo(() => (
    ownerOptions.find((option) => String(option.value) === String(values.responsibleId || ''))?.label
    || t('deals.form.ownerUnassigned', 'Unassigned')
  ), [ownerOptions, t, values.responsibleId]);

  const sidePanels = useMemo(() => [
    { key: 'overview', label: t('deals.tabs.overview', 'Overview') },
    { key: 'notes', label: t('deals.tabs.notes', 'Notes'), disabled: isCreateMode },
    { key: 'tasks', label: t('deals.tabs.tasks', 'Tasks'), disabled: isCreateMode },
    { key: 'system', label: t('deals.tabs.system', 'System'), disabled: isCreateMode },
  ], [isCreateMode, t]);

  const renderPanel = () => {
    if (activePanel === 'notes' && !isCreateMode) {
      return (
        <EntityNotesSection
          ownerType="deal"
          ownerId={id}
          title={t('deals.notes.title', 'Deal notes')}
          hideFiltersWhenEmpty
          hidePagerWhenSingle
          emptyTitle={t('deals.notes.emptyTitle', 'No notes yet')}
          emptyText={t('deals.notes.emptyText', 'Notes linked to this deal will appear here.')}
          addNoteLabel={t('deals.notes.add', 'Add note')}
        />
      );
    }
    if (activePanel === 'tasks' && !isCreateMode) return <TasksTab dealId={id} />;
    if (activePanel === 'system' && !isCreateMode) {
      return (
        <DetailSection title={t('deals.tabs.system', 'System')}>
          <div className={s.systemRows}>
            <div><span>ID</span><strong>{id}</strong></div>
            <div><span>{t('deals.fields.status', 'Status')}</span><strong>{statusLabels[values.status] || values.status || noneLabel}</strong></div>
            <div><span>{t('deals.fields.createdAt', 'Created')}</span><strong>{formatDate(values.createdAt, i18n.language)}</strong></div>
            <div><span>{t('deals.fields.updatedAt', 'Updated')}</span><strong>{formatDate(values.updatedAt, i18n.language)}</strong></div>
            <div><span>{t('deals.fields.stageEnteredAt', 'Stage entered')}</span><strong>{formatDate(values.stageEnteredAt, i18n.language)}</strong></div>
          </div>
        </DetailSection>
      );
    }
    return (
      <div className={s.overviewPanel}>
        <InfoRow label={t('deals.fields.stage', 'Stage')} value={currentStage?.name || noneLabel} />
        <InfoRow label={t('deals.fields.owner', 'Owner')} value={ownerLabel} />
        <InfoRow label={t('deals.fields.expectedClose', 'Expected close')} value={formatShortDate(values.expectedCloseDate, i18n.language)} />
        <InfoRow label={t('deals.fields.nextAction', 'Next action')} value={values.nextActionType || t('deals.nextAction.missing', 'No next action')} />
        <div className={s.overviewSignals}>
          <HealthBadge value={values.healthStatus} status={values.status} t={t} />
          <span>{statusLabels[values.status] || values.status || noneLabel}</span>
        </div>
      </div>
    );
  };

  const sidebar = (
    <aside className={s.factsColumn} aria-label={t('deals.sections.dealFacts', 'Deal facts')}>
      <section className={s.factsPanel}>
        <header className={s.factsHeader}>
          <span>{t('deals.sections.dealFacts', 'Deal facts')}</span>
          <strong>{currentPipeline?.name || t('deals.pipeline.noPipeline', 'No pipeline')}</strong>
        </header>

        <FactGroup title={t('deals.sections.relationship', 'Relationship')}>
          <TextField
            label={t('deals.fields.title', 'Title')}
            value={values.title}
            onValueChange={(next) => setField('title', next)}
            disabled={!editable}
            required
            error={errors.title}
          />
          <AutocompleteField
            label={t('deals.fields.relationship', 'Client / Lead / Counterparty')}
            value={selectedCounterparty}
            inputValue={counterpartyTerm}
            onInputChange={(next) => {
              setCounterpartyTerm(next);
              if (selectedCounterparty && asText(next) !== selectedCounterparty.name) {
                setSelectedCounterparty(null);
                setField('counterpartyId', '');
                setField('counterpartyName', '');
              }
            }}
            options={counterpartyOptions}
            onChange={(nextValue, option) => {
              if (!option) return;
              setSelectedCounterparty(option);
              setCounterpartyTerm(option.name || '');
              setField('counterpartyId', String(nextValue || option.id || ''));
              setField('counterpartyName', option.name || '');
            }}
            disabled={!editable}
            placeholder={t('deals.placeholders.relationship', 'Type company, client, or lead name')}
            hint={t('deals.common.typeToSearch', 'Type name or NIP')}
            searchingLabel={t('common.searching', 'Searching...')}
            emptyLabel={t('deals.modal.new.counterpartyEmpty', 'No counterparties found')}
            loading={Boolean(counterpartyDebounced) && counterpartyLoading}
            getOptionLabel={(option) => option?.name || String(option?.id || '')}
            getOptionSecondary={(option) => [option?.nip, option?.city].filter(Boolean).join(' • ')}
            error={errors.counterpartyId}
          />
          <div className={s.inlineFacts}>
            <InfoRow
              label={t('deals.fields.company', 'Company')}
              value={values.counterpartyName || noneLabel}
              to={values.counterpartyId ? `/main/counterparties/${values.counterpartyId}` : undefined}
            />
            <InfoRow label={t('deals.fields.contact', 'Contact')} value={values.contactName || noneLabel} />
          </div>
          <div className={s.quickContactActions}>
            <button type="button" disabled><Phone size={14} aria-hidden="true" />{t('deals.actions.call', 'Call')}</button>
            <button type="button" disabled><Mail size={14} aria-hidden="true" />{t('deals.actions.email', 'Email')}</button>
          </div>
        </FactGroup>

        <FactGroup title={t('deals.sections.ownership', 'Ownership')}>
          <SelectField
            label={t('deals.fields.owner', 'Owner')}
            value={values.responsibleId}
            onValueChange={(next) => setField('responsibleId', next)}
            options={[{ value: '', label: t('deals.form.ownerUnassigned', 'Unassigned') }, ...ownerOptions]}
            disabled={!editable}
          />
          <SelectField
            label={t('deals.fields.pipeline', 'Pipeline')}
            value={values.pipelineId}
            onValueChange={handlePipelineSelect}
            options={pipelineOptions}
            disabled={!editable || pipelinesLoading}
            error={errors.pipelineId}
          />
          {errors.stageId ? <p className={s.fieldError}>{errors.stageId}</p> : null}
        </FactGroup>

        <FactGroup title={t('deals.sections.money', 'Money')}>
          <div className={s.twoCols}>
            <NumberField
              label={t('deals.fields.amount', 'Amount')}
              value={values.value}
              emitAs="string"
              step="0.01"
              onValueChange={(next) => setField('value', next)}
              disabled={!editable}
            />
            <TextField
              label={t('deals.fields.currency', 'Currency')}
              value={values.currency}
              onValueChange={(next) => setField('currency', next)}
              disabled={!editable}
            />
          </div>
          <div className={s.twoCols}>
            <NumberField
              label={t('deals.fields.probability', 'Probability')}
              value={values.probability}
              emitAs="string"
              min="0"
              max="100"
              onValueChange={(next) => setField('probability', next)}
              disabled={!editable}
            />
            <NumberField
              label={t('deals.fields.priority', 'Priority')}
              value={values.priority}
              emitAs="string"
              min="0"
              max="100"
              onValueChange={(next) => setField('priority', next)}
              disabled={!editable}
            />
          </div>
        </FactGroup>

        <FactGroup title={t('deals.sections.timing', 'Timing')}>
          <DateField
            label={t('deals.fields.expectedClose', 'Expected close')}
            value={values.expectedCloseDate}
            onValueChange={(next) => setField('expectedCloseDate', next)}
            disabled={!editable}
          />
          <TextField
            label={t('deals.fields.nextActionType', 'Next action')}
            value={values.nextActionType}
            onValueChange={(next) => setField('nextActionType', next)}
            disabled={!editable}
          />
        </FactGroup>

        <FactGroup title={t('deals.sections.details', 'Details')}>
          <TextareaField
            label={t('deals.fields.description', 'Description')}
            value={values.description}
            onValueChange={(next) => setField('description', next)}
            disabled={!editable}
            minRows={values.description ? 4 : 2}
            placeholder={t('deals.placeholders.description', 'Optional description')}
          />
        </FactGroup>
      </section>
    </aside>
  );

  if (!isCreateMode && detailLoading && !detail) {
    return <div className={s.emptyState}>{t('deals.details.loading', 'Loading deal…')}</div>;
  }

  if (!isCreateMode && detailError?.status === 403) {
    return <div className={s.emptyState}>{t('deals.details.noPermission', 'No permission to view this deal.')}</div>;
  }

  if (!isCreateMode && (detailError?.status === 404 || (!detailLoading && !detail))) {
    return <div className={s.emptyState}>{t('deals.details.notFound', 'Deal not found.')}</div>;
  }

  const title = values.title || (isCreateMode ? t('deals.create.title', 'New deal') : t('deals.details.untitled', 'Untitled deal'));
  const daysInStage = getDaysSince(values.stageEnteredAt);
  const stageProbability = currentStage?.probability ?? 0;
  const saveLabel = saveError || (saving
    ? t('common.saving', 'Saving…')
    : dirty
      ? t('common.unsaved', 'Unsaved')
      : t('common.saved', 'Saved'));

  return (
    <>
      <DetailLayout
        mode="entity"
        className={s.detailV3}
        header={(
          <header className={s.dealHero}>
            <div className={s.heroNav}>
              <button type="button" onClick={() => navigate('/main/deals')}>
                <ArrowLeft size={15} aria-hidden="true" />
                {t('deals.actions.back', 'Back to deals')}
              </button>
              <span>{t('menu.crm', 'CRM')} / {t('deals.title', 'Deals')}</span>
              <span className={`${s.saveState} ${saveError ? s.saveStateError : dirty ? s.saveStateDirty : ''}`}>{saveLabel}</span>
            </div>

            <div className={s.heroSummary}>
              <div className={s.heroIdentity}>
                <h1>{title}</h1>
                <div className={s.heroSubline}>
                  <span><Building2 size={14} aria-hidden="true" />{values.counterpartyName || t('deals.fields.company', 'Company')}</span>
                  {values.contactName ? <span><UserRound size={14} aria-hidden="true" />{values.contactName}</span> : null}
                  <span>{statusLabels[values.status] || values.status || noneLabel}</span>
                </div>
              </div>

              <div className={s.heroMetrics}>
                <span>
                  <span>{t('deals.fields.amount', 'Amount')}</span>
                  <strong>{moneyLabel(values.value, values.currency, noneLabel)}</strong>
                </span>
                <span>
                  <span>{t('deals.fields.stage', 'Stage')}</span>
                  <strong>{currentStage?.name || t('deals.pipeline.noStage', 'No stage selected')}</strong>
                </span>
                <span>
                  <span>{t('deals.fields.probability', 'Probability')}</span>
                  <strong>{values.probability || stageProbability || 0}%</strong>
                </span>
              </div>

              <div className={s.heroSignals}>
                <HealthBadge value={values.healthStatus} status={values.status} t={t} />
                <NextActionBadge values={values} t={t} locale={i18n.language} />
                {daysInStage != null ? (
                  <span className={s.stageAge}>{t('deals.pipeline.daysInStage', '{{count}}d in stage', { count: daysInStage })}</span>
                ) : null}
              </div>

              <div className={s.heroActions}>
                <button type="button" className={s.winAction} onClick={() => handleTerminal('won')} disabled={!editable || saving || values.status === 'won'}>
                  <Trophy size={15} aria-hidden="true" />
                  <span>{t('deals.actions.won', 'Won')}</span>
                </button>
                <button type="button" className={s.lostAction} onClick={() => handleTerminal('lost')} disabled={!editable || saving || values.status === 'lost'}>
                  <Flag size={15} aria-hidden="true" />
                  <span>{t('deals.actions.lost', 'Lost')}</span>
                </button>
                <button type="button" className={s.saveAction} onClick={handleSave} disabled={saving || !editable}>
                  <Save size={15} aria-hidden="true" />
                  <span>{isCreateMode ? t('deals.actions.create', 'Create deal') : t('common.save', 'Save')}</span>
                </button>
                {!isCreateMode && canDeleteDeal ? (
                  <button type="button" className={s.deleteAction} onClick={() => setDeleteOpen(true)} disabled={deleting} aria-label={t('common.delete', 'Delete')}>
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </div>

            <div className={s.heroPath}>
              {currentStages.length ? (
                <PipelinePath
                  stages={currentStages}
                  currentStageId={values.stageId}
                  disabled={!editable || saving}
                  onSelect={handleStageSelect}
                  emptyLabel={t('deals.pipeline.noStages', 'This pipeline has no stages yet.')}
                  wonLabel={t('deals.status.won', 'Won')}
                  lostLabel={t('deals.status.lost', 'Lost')}
                />
              ) : (
                <div className={s.pipelineEmpty}>
                  <Settings size={16} aria-hidden="true" />
                  <div>
                    <strong>{t('deals.pipeline.notConfigured', 'Pipeline not configured')}</strong>
                    <p>{t('deals.pipeline.configureHint', 'Set up pipelines and stages before working this deal.')}</p>
                  </div>
                  <Link to="/main/company-settings/deals">{t('deals.pipeline.configureLink', 'Open deal settings')}</Link>
                </div>
              )}
            </div>
          </header>
        )}
        sidebar={sidebar}
        content={(
          <div className={s.activityWorkspace}>
            <main className={s.activityMain}>
              <SmartButtonsBar dealId={!isCreateMode ? id : ''} t={t} />
              <ActivityComposer
                disabled={isCreateMode || !editable}
                t={t}
                onCreate={handleCreateActivity}
                isSubmitting={creatingActivity}
              />
              <ActivityTimeline
                activities={activities}
                isLoading={activitiesLoading}
                error={activitiesError}
                t={t}
                locale={i18n.language}
                onDelete={handleDeleteActivity}
                deletingActivityId={deletingActivityId}
              />
            </main>
            <aside className={s.activitySide} aria-label={t('deals.activity.sidePanel', 'Deal activity panel')}>
              <div className={s.panelTabs}>
                {sidePanels.map((panel) => (
                  <button
                    key={panel.key}
                    type="button"
                    className={activePanel === panel.key ? s.panelTabActive : ''}
                    disabled={panel.disabled}
                    onClick={() => setActivePanel(panel.key)}
                  >
                    {panel.label}
                  </button>
                ))}
              </div>
              <div className={s.panelBody}>{renderPanel()}</div>
            </aside>
          </div>
        )}
      />

      <ConfirmDialog
        open={deleteOpen}
        title={t('deals.confirm.deleteTitle', 'Удалить сделку?')}
        text={t('deals.confirm.deleteText', 'Сделка будет удалена или архивирована согласно настройкам системы.')}
        okText={t('common.delete', 'Удалить')}
        cancelText={t('common.cancel', 'Отмена')}
        danger
        loading={deleting}
        onOk={async () => {
          await deleteDeal(id).unwrap();
          setDeleteOpen(false);
          navigate('/main/deals');
        }}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  );
}
