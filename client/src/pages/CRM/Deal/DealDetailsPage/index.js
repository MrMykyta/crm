import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeDollarSign, Flag, Settings, Trophy } from 'lucide-react';

import {
  DetailCard,
  DetailLayout,
  DetailSection,
} from '../../../../components/detail';
import ConfirmDialog from '../../../../components/dialogs/ConfirmDialog';
import EntityNotesSection from '../../../../components/notes/EntityNotesSection';
import {
  AutocompleteField,
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
    description: deal?.description || '',
    createdAt: deal?.createdAt || null,
    updatedAt: deal?.updatedAt || null,
    stageEnteredAt: deal?.stageEnteredAt || null,
  };
}

function buildPayload(values = {}) {
  const value = values.value === '' || values.value == null ? null : Number(values.value);
  return {
    title: asText(values.title),
    counterpartyId: asText(values.counterpartyId),
    pipelineId: asText(values.pipelineId) || null,
    stageId: asText(values.stageId) || null,
    status: values.status || 'new',
    value: Number.isNaN(value) ? null : value,
    currency: asText(values.currency) || 'PLN',
    responsibleId: values.responsibleId || null,
    description: asText(values.description) || null,
  };
}

function getStatusTone(status) {
  if (status === 'won') return 'success';
  if (status === 'lost') return 'danger';
  if (status === 'in_progress') return 'warning';
  return 'neutral';
}

function TasksTab({ dealId }) {
  const { t } = useTranslation();
  const { data, isFetching, error } = useListTasksQuery(
    { dealId, limit: 20, sort: 'updatedAt:desc' },
    { skip: !dealId }
  );
  const tasks = data?.items || [];

  if (isFetching) return <div className={s.placeholder}>{t('common.loading', 'Loading')}</div>;
  if (error) return <div className={s.placeholder}>{t('deals.tasks.error', 'Tasks could not be loaded.')}</div>;
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
  const [activeTab, setActiveTab] = useState('overview');
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

  const tabs = useMemo(() => {
    const baseTabs = [
      {
        key: 'overview',
        label: t('deals.tabs.overview', 'Overview'),
        children: (
          <div className={s.tabStack}>
            <DetailSection title={t('deals.sections.salesSnapshot', 'Sales snapshot')}>
              <div className={s.overviewFacts}>
                <div>
                  <span>{t('deals.fields.pipeline', 'Pipeline')}</span>
                  <strong>{currentPipeline?.name || noneLabel}</strong>
                </div>
                <div>
                  <span>{t('deals.fields.stage', 'Stage')}</span>
                  <strong>{currentStage?.name || noneLabel}</strong>
                </div>
                <div>
                  <span>{t('deals.fields.amount', 'Amount')}</span>
                  <strong>{moneyLabel(values.value, values.currency, noneLabel)}</strong>
                </div>
                <div>
                  <span>{t('deals.fields.status', 'Status')}</span>
                  <strong>{statusLabels[values.status] || values.status || noneLabel}</strong>
                </div>
              </div>
            </DetailSection>
          </div>
        ),
      },
    ];

    if (isCreateMode) return baseTabs;
    return [
      ...baseTabs,
      {
        key: 'notes',
        label: t('deals.tabs.notes', 'Notes'),
        children: (
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
        ),
      },
      {
        key: 'tasks',
        label: t('deals.tabs.tasks', 'Tasks'),
        children: <TasksTab dealId={id} />,
      },
      {
        key: 'system',
        label: t('deals.tabs.system', 'System'),
        children: (
          <DetailSection title={t('deals.tabs.system', 'System')}>
            <div className={s.systemRows}>
              <div><span>ID</span><strong>{id}</strong></div>
              <div><span>{t('deals.fields.status', 'Status')}</span><strong>{statusLabels[values.status] || values.status || noneLabel}</strong></div>
              <div><span>{t('deals.fields.createdAt', 'Created')}</span><strong>{formatDate(values.createdAt, i18n.language)}</strong></div>
              <div><span>{t('deals.fields.updatedAt', 'Updated')}</span><strong>{formatDate(values.updatedAt, i18n.language)}</strong></div>
              <div><span>{t('deals.fields.stageEnteredAt', 'Stage entered')}</span><strong>{formatDate(values.stageEnteredAt, i18n.language)}</strong></div>
            </div>
          </DetailSection>
        ),
      },
    ];
  }, [currentPipeline?.name, currentStage?.name, i18n.language, id, isCreateMode, noneLabel, statusLabels, t, values.createdAt, values.currency, values.stageEnteredAt, values.status, values.updatedAt, values.value]);

  const sidebar = (
    <div className={s.sidebar}>
      <DetailCard title={t('deals.sections.sales', 'Sales')}>
        <TextField
          label={t('deals.fields.title', 'Title')}
          value={values.title}
          onValueChange={(next) => setField('title', next)}
          disabled={!editable}
          required
          error={errors.title}
        />
        <AutocompleteField
          label={t('deals.fields.relationship', 'Клиент / Лид / Контрагент')}
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
        <SelectField
          label={t('deals.fields.owner', 'Owner')}
          value={values.responsibleId}
          onValueChange={(next) => setField('responsibleId', next)}
          options={[{ value: '', label: t('deals.form.ownerUnassigned', 'Unassigned') }, ...ownerOptions]}
          disabled={!editable}
        />
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
        <TextareaField
          label={t('deals.fields.description', 'Description')}
          value={values.description}
          onValueChange={(next) => setField('description', next)}
          disabled={!editable}
          minRows={5}
          placeholder={t('deals.placeholders.description', 'Optional description')}
        />
      </DetailCard>

      <DetailCard title={t('deals.sections.pipeline', 'Pipeline')}>
        <SelectField
          label={t('deals.fields.pipeline', 'Pipeline')}
          value={values.pipelineId}
          onValueChange={handlePipelineSelect}
          options={pipelineOptions}
          disabled={!editable || pipelinesLoading}
          error={errors.pipelineId}
        />
        <div className={s.stageFact}>
          <span>{t('deals.fields.currentStage', 'Current stage')}</span>
          <strong>{currentStage?.name || noneLabel}</strong>
          {currentStage?.probability != null ? <small>{currentStage.probability}%</small> : null}
          {errors.stageId ? <em>{errors.stageId}</em> : null}
        </div>
      </DetailCard>
    </div>
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
  const subtitle = [
    values.counterpartyName,
    moneyLabel(values.value, values.currency, ''),
    currentStage?.name,
  ].filter(Boolean).join(' · ');

  return (
    <>
      <DetailLayout
        mode="entity"
        breadcrumbs={[
          { label: t('menu.crm', 'CRM') },
          { label: t('deals.title', 'Deals'), to: '/main/deals' },
          { label: isCreateMode ? t('common.new', 'New') : title },
        ]}
        title={title}
        subtitle={subtitle || t('deals.subtitle.empty', 'Pipeline-first sales opportunity')}
        icon={<BadgeDollarSign size={18} aria-hidden="true" />}
        status={{
          value: values.status,
          label: statusLabels[values.status] || values.status || noneLabel,
          tone: getStatusTone(values.status),
        }}
        saveState={{
          saving,
          dirty,
          error: saveError,
          label: saveError || (saving
            ? t('common.saving', 'Saving…')
            : dirty
              ? t('common.unsaved', 'Unsaved')
              : t('common.saved', 'Saved')),
        }}
        actions={[
          {
            key: 'back',
            label: t('deals.actions.back', 'Back to deals'),
            onClick: () => navigate('/main/deals'),
          },
          {
            key: 'delete',
            label: deleting ? t('common.loading', 'Loading') : t('common.delete', 'Delete'),
            destructive: true,
            hidden: isCreateMode || !canDeleteDeal,
            disabled: deleting,
            onClick: () => setDeleteOpen(true),
          },
        ]}
        primaryAction={{
          key: isCreateMode ? 'create' : 'save',
          label: isCreateMode ? t('deals.actions.create', 'Create deal') : t('common.save', 'Save'),
          disabled: saving || !editable,
          onClick: handleSave,
        }}
        sidebar={sidebar}
        tabs={tabs}
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
      >
        <div className={s.hero}>
          <div className={s.heroTop}>
            <div className={s.heroMain}>
              <div className={s.eyebrow}>{t('deals.pipeline.salesProcess', 'Sales process')}</div>
              <h2>{currentPipeline?.name || t('deals.pipeline.notConfigured', 'Pipeline not configured')}</h2>
              <div className={s.heroMetrics}>
                <span className={s.moneyMetric}>{moneyLabel(values.value, values.currency, noneLabel)}</span>
                <span>{currentStage?.name || t('deals.pipeline.noStage', 'No stage selected')}</span>
                <span>{stageProbability}%</span>
                {daysInStage != null ? (
                  <span>{t('deals.pipeline.daysInStage', '{{count}}d in stage', { count: daysInStage })}</span>
                ) : values.stageEnteredAt ? (
                  <span>{formatDate(values.stageEnteredAt, i18n.language)}</span>
                ) : null}
              </div>
            </div>
            <div className={s.heroActions}>
              <button type="button" className={s.winAction} onClick={() => handleTerminal('won')} disabled={!editable || saving || values.status === 'won'}>
                <Trophy size={16} aria-hidden="true" />
                <span>{t('deals.actions.won', 'Won')}</span>
              </button>
              <button type="button" className={s.lostAction} onClick={() => handleTerminal('lost')} disabled={!editable || saving || values.status === 'lost'}>
                <Flag size={16} aria-hidden="true" />
                <span>{t('deals.actions.lost', 'Lost')}</span>
              </button>
            </div>
          </div>
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
      </DetailLayout>

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
