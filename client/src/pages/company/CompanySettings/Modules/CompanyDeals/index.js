import React, { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import {
  Archive,
  CheckCircle2,
  CircleDollarSign,
  GripVertical,
  Layers3,
  Plus,
  Save,
  ShieldCheck,
  Target,
  Trash2,
  Wand2,
  Workflow,
} from 'lucide-react';

import {
  CheckboxField,
  ColorField,
  NumberField,
  SelectField,
  TextareaField,
  TextField,
} from '../../../../../components/ui/fields';
import useAclPermissions from '../../../../../hooks/useAclPermissions';
import {
  useCreateLostReasonMutation,
  useCreatePipelineMutation,
  useCreatePipelineStageMutation,
  useDeleteLostReasonMutation,
  useDeletePipelineMutation,
  useDeletePipelineStageMutation,
  useGetDealSettingsQuery,
  useGetLostReasonsQuery,
  useGetPipelinesQuery,
  useReorderLostReasonsMutation,
  useReorderPipelineStagesMutation,
  useReorderPipelinesMutation,
  useUpdateDealSettingsMutation,
  useUpdateLostReasonMutation,
  useUpdatePipelineMutation,
  useUpdatePipelineStageMutation,
} from '../../../../../store/rtk/dealsApi';

import s from './CompanyDeals.module.css';

const DEFAULT_PIPELINE_DRAFT = {
  name: '',
  color: '#2563eb',
  description: '',
  isDefault: false,
  archived: false,
};

const DEFAULT_STAGE_DRAFT = {
  name: '',
  color: '#3b82f6',
  probability: 10,
  isDefaultEntry: false,
  isWon: false,
  isLost: false,
  hidden: false,
  archived: false,
  wipLimit: '',
  rotDays: '',
};

const DEFAULT_SETTINGS_DRAFT = {
  probabilityMode: 'automatic',
  defaultCurrency: 'PLN',
  defaultExpectedCloseDays: 30,
  visibility: 'company',
  dealNumberingEnabled: false,
  dealNumberPrefix: 'DL',
};

const PIPELINE_TEMPLATES = [
  {
    id: 'standard',
    name: 'Standard Sales',
    color: '#2563eb',
    icon: Target,
    description: 'Qualify, propose, negotiate, close.',
    stages: [
      { name: 'Qualification', probability: 10, color: '#64748b', isDefaultEntry: true, rotDays: 7, wipLimit: 12 },
      { name: 'Proposal', probability: 40, color: '#0ea5e9', rotDays: 10, wipLimit: 10 },
      { name: 'Negotiation', probability: 70, color: '#f59e0b', rotDays: 8, wipLimit: 8 },
      { name: 'Won', probability: 100, color: '#22c55e', isWon: true },
      { name: 'Lost', probability: 0, color: '#ef4444', isLost: true },
    ],
  },
  {
    id: 'service',
    name: 'Service',
    color: '#0891b2',
    icon: ShieldCheck,
    description: 'Request, estimate, scheduled work, outcome.',
    stages: [
      { name: 'Request', probability: 15, color: '#06b6d4', isDefaultEntry: true, rotDays: 3, wipLimit: 20 },
      { name: 'Estimate', probability: 35, color: '#3b82f6', rotDays: 5, wipLimit: 12 },
      { name: 'Scheduled', probability: 75, color: '#8b5cf6', rotDays: 7, wipLimit: 10 },
      { name: 'Won', probability: 100, color: '#22c55e', isWon: true },
      { name: 'Lost', probability: 0, color: '#ef4444', isLost: true },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    color: '#7c3aed',
    icon: Workflow,
    description: 'Discovery, stakeholder buy-in, legal, close.',
    stages: [
      { name: 'Discovery', probability: 10, color: '#6366f1', isDefaultEntry: true, rotDays: 14, wipLimit: 8 },
      { name: 'Business case', probability: 35, color: '#8b5cf6', rotDays: 21, wipLimit: 8 },
      { name: 'Legal', probability: 70, color: '#f97316', rotDays: 14, wipLimit: 6 },
      { name: 'Won', probability: 100, color: '#22c55e', isWon: true },
      { name: 'Lost', probability: 0, color: '#ef4444', isLost: true },
    ],
  },
];

function getOrder(item = {}, fallback = 0) {
  const raw = item.order ?? item.position ?? fallback;
  const num = Number(raw);
  return Number.isFinite(num) ? num : fallback;
}

function normalizePipelines(data = []) {
  return (Array.isArray(data) ? data : [])
    .map((pipeline, pipelineIndex) => ({
      ...pipeline,
      order: getOrder(pipeline, pipelineIndex),
      stages: (Array.isArray(pipeline.stages) ? pipeline.stages : [])
        .slice()
        .sort((left, right) => getOrder(left) - getOrder(right)),
    }))
    .sort((left, right) => getOrder(left) - getOrder(right));
}

function toStageDraft(stage = DEFAULT_STAGE_DRAFT) {
  return {
    name: stage.name || '',
    color: stage.color || DEFAULT_STAGE_DRAFT.color,
    probability: Number(stage.probability ?? 0),
    isDefaultEntry: Boolean(stage.isDefaultEntry),
    isWon: Boolean(stage.isWon),
    isLost: Boolean(stage.isLost),
    hidden: Boolean(stage.hidden),
    archived: Boolean(stage.archived),
    wipLimit: stage.wipLimit ?? '',
    rotDays: stage.rotDays ?? '',
  };
}

function toPipelineDraft(pipeline = DEFAULT_PIPELINE_DRAFT) {
  return {
    name: pipeline.name || '',
    color: pipeline.color || DEFAULT_PIPELINE_DRAFT.color,
    description: pipeline.description || '',
    isDefault: Boolean(pipeline.isDefault),
    archived: Boolean(pipeline.archived),
  };
}

function formatCount(value) {
  const number = Number(value || 0);
  return `${number.toLocaleString()} ${number === 1 ? 'deal' : 'deals'}`;
}

function cleanStagePayload(draft) {
  return {
    ...draft,
    name: draft.name.trim(),
    probability: Number(draft.probability || 0),
    wipLimit: draft.wipLimit === '' ? null : Number(draft.wipLimit),
    rotDays: draft.rotDays === '' ? null : Number(draft.rotDays),
  };
}

function getErrorMessage(error) {
  return error?.data?.error || error?.data?.message || error?.error || error?.message || 'Action failed';
}

function SortableShell({ id, disabled, className, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${className || ''} ${isDragging ? s.dragging : ''}`}
    >
      <button
        type="button"
        className={s.dragHandle}
        disabled={disabled}
        aria-label="Drag"
        title="Drag"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} aria-hidden="true" />
      </button>
      {children}
    </div>
  );
}

function Pill({ children, tone = 'neutral' }) {
  return <span className={`${s.pill} ${s[`pill_${tone}`] || ''}`}>{children}</span>;
}

export default function CompanyDeals() {
  const { can } = useAclPermissions();
  const canUpdateSettings = can('company:settings:update');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [pipelineDraft, setPipelineDraft] = useState(DEFAULT_PIPELINE_DRAFT);
  const [newPipelineDraft, setNewPipelineDraft] = useState(DEFAULT_PIPELINE_DRAFT);
  const [stageDraft, setStageDraft] = useState(DEFAULT_STAGE_DRAFT);
  const [editingStageId, setEditingStageId] = useState('');
  const [editingStageDraft, setEditingStageDraft] = useState(DEFAULT_STAGE_DRAFT);
  const [replacementStageById, setReplacementStageById] = useState({});
  const [lostReasonDraft, setLostReasonDraft] = useState('');
  const [editingLostReasonId, setEditingLostReasonId] = useState('');
  const [editingLostReasonName, setEditingLostReasonName] = useState('');
  const [settingsDraft, setSettingsDraft] = useState(DEFAULT_SETTINGS_DRAFT);
  const [notice, setNotice] = useState('');
  const [errorText, setErrorText] = useState('');

  const { data: pipelinesData = [], isFetching: pipelinesFetching } = useGetPipelinesQuery();
  const { data: dealSettings } = useGetDealSettingsQuery();
  const { data: lostReasonsData = [], isFetching: lostReasonsFetching } = useGetLostReasonsQuery();

  const pipelines = useMemo(() => normalizePipelines(pipelinesData), [pipelinesData]);
  const activePipelines = pipelines.filter((pipeline) => !pipeline.archived);
  const archivedPipelines = pipelines.filter((pipeline) => pipeline.archived);
  const selectedPipeline = pipelines.find((pipeline) => String(pipeline.id) === String(selectedPipelineId))
    || activePipelines.find((pipeline) => pipeline.isDefault)
    || activePipelines[0]
    || pipelines[0]
    || null;
  const selectedStages = selectedPipeline?.stages || [];
  const lostReasons = useMemo(
    () => (Array.isArray(lostReasonsData) ? lostReasonsData : [])
      .slice()
      .sort((left, right) => getOrder(left) - getOrder(right)),
    [lostReasonsData]
  );

  const [createPipeline, createPipelineState] = useCreatePipelineMutation();
  const [updatePipeline, updatePipelineState] = useUpdatePipelineMutation();
  const [deletePipeline, deletePipelineState] = useDeletePipelineMutation();
  const [reorderPipelines] = useReorderPipelinesMutation();
  const [createStage, createStageState] = useCreatePipelineStageMutation();
  const [updateStage, updateStageState] = useUpdatePipelineStageMutation();
  const [deleteStage, deleteStageState] = useDeletePipelineStageMutation();
  const [reorderStages] = useReorderPipelineStagesMutation();
  const [updateDealSettings, updateDealSettingsState] = useUpdateDealSettingsMutation();
  const [createLostReason, createLostReasonState] = useCreateLostReasonMutation();
  const [updateLostReason, updateLostReasonState] = useUpdateLostReasonMutation();
  const [deleteLostReason, deleteLostReasonState] = useDeleteLostReasonMutation();
  const [reorderLostReasons] = useReorderLostReasonsMutation();

  const busy = createPipelineState.isLoading
    || updatePipelineState.isLoading
    || deletePipelineState.isLoading
    || createStageState.isLoading
    || updateStageState.isLoading
    || deleteStageState.isLoading
    || updateDealSettingsState.isLoading
    || createLostReasonState.isLoading
    || updateLostReasonState.isLoading
    || deleteLostReasonState.isLoading;

  useEffect(() => {
    if (!selectedPipelineId && selectedPipeline?.id) {
      setSelectedPipelineId(selectedPipeline.id);
    }
  }, [selectedPipeline?.id, selectedPipelineId]);

  useEffect(() => {
    if (selectedPipeline) {
      setPipelineDraft(toPipelineDraft(selectedPipeline));
    }
  }, [selectedPipeline?.id, selectedPipeline?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (dealSettings) {
      setSettingsDraft({
        ...DEFAULT_SETTINGS_DRAFT,
        ...dealSettings,
        defaultExpectedCloseDays: dealSettings.defaultExpectedCloseDays ?? '',
      });
    }
  }, [dealSettings]);

  const run = async (action, success) => {
    setErrorText('');
    setNotice('');
    try {
      await action();
      if (success) setNotice(success);
    } catch (error) {
      setErrorText(getErrorMessage(error));
    }
  };

  const handleCreatePipeline = () => run(async () => {
    const name = newPipelineDraft.name.trim();
    if (!name) throw new Error('Pipeline name is required');
    const created = await createPipeline({
      ...newPipelineDraft,
      name,
    }).unwrap();
    setNewPipelineDraft(DEFAULT_PIPELINE_DRAFT);
    setSelectedPipelineId(created.id);
  }, 'Pipeline created');

  const handleCreateTemplate = (template) => run(async () => {
    const created = await createPipeline({
      name: template.name,
      color: template.color,
      description: template.description,
      isDefault: !activePipelines.length,
    }).unwrap();

    for (const stage of template.stages) {
      await createStage({
        pipelineId: created.id,
        payload: cleanStagePayload({ ...DEFAULT_STAGE_DRAFT, ...stage }),
      }).unwrap();
    }
    setSelectedPipelineId(created.id);
  }, `${template.name} pipeline created`);

  const handleSavePipeline = () => run(async () => {
    if (!selectedPipeline?.id) return;
    const name = pipelineDraft.name.trim();
    if (!name) throw new Error('Pipeline name is required');
    await updatePipeline({
      pipelineId: selectedPipeline.id,
      payload: {
        ...pipelineDraft,
        name,
      },
    }).unwrap();
  }, 'Pipeline saved');

  const handleArchivePipeline = (pipeline) => run(async () => {
    await updatePipeline({
      pipelineId: pipeline.id,
      payload: { archived: !pipeline.archived },
    }).unwrap();
  }, pipeline.archived ? 'Pipeline restored' : 'Pipeline archived');

  const handleDeletePipeline = (pipeline) => {
    if (!window.confirm(`Delete pipeline "${pipeline.name}"? Pipelines with deals will be archived.`)) return;
    run(async () => {
      await deletePipeline(pipeline.id).unwrap();
      if (String(selectedPipelineId) === String(pipeline.id)) setSelectedPipelineId('');
    }, 'Pipeline removed');
  };

  const handleSetDefaultPipeline = (pipeline) => run(async () => {
    await updatePipeline({
      pipelineId: pipeline.id,
      payload: { isDefault: true, archived: false },
    }).unwrap();
    setSelectedPipelineId(pipeline.id);
  }, 'Default pipeline updated');

  const handlePipelineDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id || !canUpdateSettings) return;
    const ids = pipelines.map((pipeline) => pipeline.id);
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    run(async () => {
      await reorderPipelines(arrayMove(ids, oldIndex, newIndex)).unwrap();
    });
  };

  const handleCreateStage = () => run(async () => {
    if (!selectedPipeline?.id) throw new Error('Select a pipeline first');
    const name = stageDraft.name.trim();
    if (!name) throw new Error('Stage name is required');
    await createStage({
      pipelineId: selectedPipeline.id,
      payload: cleanStagePayload({ ...stageDraft, name }),
    }).unwrap();
    setStageDraft(DEFAULT_STAGE_DRAFT);
  }, 'Stage created');

  const handleSaveStage = (stageId) => run(async () => {
    if (!selectedPipeline?.id) return;
    const name = editingStageDraft.name.trim();
    if (!name) throw new Error('Stage name is required');
    await updateStage({
      pipelineId: selectedPipeline.id,
      stageId,
      payload: cleanStagePayload({ ...editingStageDraft, name }),
    }).unwrap();
    setEditingStageId('');
  }, 'Stage saved');

  const handleDeleteStage = (stage) => run(async () => {
    if (!selectedPipeline?.id) return;
    const replacementStageId = replacementStageById[stage.id] || null;
    if (Number(stage.dealsCount || 0) > 0 && !replacementStageId) {
      throw new Error('Select replacement stage before deleting a stage with deals');
    }
    await deleteStage({
      pipelineId: selectedPipeline.id,
      stageId: stage.id,
      replacementStageId,
    }).unwrap();
    setReplacementStageById((prev) => {
      const next = { ...prev };
      delete next[stage.id];
      return next;
    });
  }, 'Stage deleted');

  const handleStageDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id || !selectedPipeline?.id || !canUpdateSettings) return;
    const ids = selectedStages.map((stage) => stage.id);
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    run(async () => {
      await reorderStages({
        pipelineId: selectedPipeline.id,
        orderedStageIds: arrayMove(ids, oldIndex, newIndex),
      }).unwrap();
    });
  };

  const handleSaveSettings = () => run(async () => {
    await updateDealSettings({
      ...settingsDraft,
      defaultExpectedCloseDays: settingsDraft.defaultExpectedCloseDays === ''
        ? null
        : Number(settingsDraft.defaultExpectedCloseDays),
    }).unwrap();
  }, 'Defaults saved');

  const handleCreateLostReason = () => run(async () => {
    const name = lostReasonDraft.trim();
    if (!name) throw new Error('Lost reason name is required');
    await createLostReason({ name }).unwrap();
    setLostReasonDraft('');
  }, 'Lost reason created');

  const handleSaveLostReason = (lostReasonId) => run(async () => {
    const name = editingLostReasonName.trim();
    if (!name) throw new Error('Lost reason name is required');
    await updateLostReason({ lostReasonId, payload: { name } }).unwrap();
    setEditingLostReasonId('');
  }, 'Lost reason saved');

  const handleLostReasonDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id || !canUpdateSettings) return;
    const ids = lostReasons.map((reason) => reason.id);
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    run(async () => {
      await reorderLostReasons(arrayMove(ids, oldIndex, newIndex)).unwrap();
    });
  };

  const renderTemplates = (compact = false) => (
    <div className={compact ? s.templateStack : s.templateGrid}>
      {PIPELINE_TEMPLATES.map((template) => {
        const Icon = template.icon;
        return (
          <button
            key={template.id}
            type="button"
            className={s.templateCard}
            onClick={() => handleCreateTemplate(template)}
            disabled={!canUpdateSettings || busy}
          >
            <span className={s.templateIcon} style={{ color: template.color }}>
              <Icon size={18} aria-hidden="true" />
            </span>
            <span>
              <strong>{template.name}</strong>
              <small>{template.description}</small>
            </span>
          </button>
        );
      })}
    </div>
  );

  const renderPipelineNav = (items, title) => {
    if (!items.length) return null;
    return (
      <div className={s.pipelineGroup}>
        <div className={s.groupTitle}>{title}</div>
        {items.map((pipeline) => (
          <SortableShell key={pipeline.id} id={pipeline.id} disabled={!canUpdateSettings || busy} className={s.pipelineNavItem}>
            <button
              type="button"
              className={`${s.pipelineButton} ${String(selectedPipeline?.id) === String(pipeline.id) ? s.pipelineButtonActive : ''}`}
              onClick={() => setSelectedPipelineId(pipeline.id)}
            >
              <span className={s.colorDot} style={{ background: pipeline.color || '#2563eb' }} />
              <span className={s.pipelineName}>{pipeline.name}</span>
              <span className={s.pipelineCount}>{Number(pipeline.stages?.length || 0)}</span>
            </button>
            <div className={s.navBadges}>
              {pipeline.isDefault ? <Pill tone="success">Default</Pill> : null}
              {pipeline.archived ? <Pill tone="warning">Archive</Pill> : null}
            </div>
          </SortableShell>
        ))}
      </div>
    );
  };

  const renderPipelineList = () => (
    <aside className={s.sidebar}>
      <div className={s.sidebarHead}>
        <div>
          <h3>Pipeline List</h3>
          <p>{activePipelines.length} active · {archivedPipelines.length} archived</p>
        </div>
        <Layers3 size={19} aria-hidden="true" />
      </div>

      {renderTemplates(true)}

      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handlePipelineDragEnd}>
        <SortableContext items={pipelines.map((pipeline) => pipeline.id)} strategy={verticalListSortingStrategy}>
          <div className={s.pipelineList}>
            {renderPipelineNav(activePipelines, 'Active')}
            {renderPipelineNav(archivedPipelines, 'Archive')}
          </div>
        </SortableContext>
      </DndContext>

      <div className={s.quickCreate}>
        <TextField
          label="New pipeline"
          value={newPipelineDraft.name}
          disabled={!canUpdateSettings}
          onValueChange={(name) => setNewPipelineDraft((prev) => ({ ...prev, name }))}
        />
        <ColorField
          label="Color"
          value={newPipelineDraft.color}
          disabled={!canUpdateSettings}
          onValueChange={(color) => setNewPipelineDraft((prev) => ({ ...prev, color }))}
        />
        <button type="button" className={s.primaryBtn} onClick={handleCreatePipeline} disabled={!canUpdateSettings || busy}>
          <Plus size={16} aria-hidden="true" /> Create
        </button>
      </div>
    </aside>
  );

  const renderPipelineEditor = () => {
    if (!selectedPipeline) {
      return (
        <section className={s.firstRun}>
          <div className={s.firstRunHead}>
            <Wand2 size={24} aria-hidden="true" />
            <div>
              <h3>Templates</h3>
              <p>Create a working pipeline with stages, probabilities, WIP and rot days.</p>
            </div>
          </div>
          {renderTemplates()}
        </section>
      );
    }

    return (
      <div className={s.editorStack}>
        <section className={s.panel}>
          <div className={s.panelHead}>
            <div>
              <h3>Pipeline Editor</h3>
              <p>{formatCount(selectedPipeline.dealsCount)} · {selectedStages.length} stages</p>
            </div>
            <div className={s.actions}>
              <button type="button" className={s.secondaryBtn} onClick={() => handleSetDefaultPipeline(selectedPipeline)} disabled={!canUpdateSettings || selectedPipeline.isDefault || busy}>
                <CheckCircle2 size={15} aria-hidden="true" /> Default
              </button>
              <button type="button" className={s.secondaryBtn} onClick={() => handleArchivePipeline(selectedPipeline)} disabled={!canUpdateSettings || busy}>
                <Archive size={15} aria-hidden="true" /> {selectedPipeline.archived ? 'Restore' : 'Archive'}
              </button>
              <button type="button" className={s.dangerBtn} onClick={() => handleDeletePipeline(selectedPipeline)} disabled={!canUpdateSettings || busy}>
                <Trash2 size={15} aria-hidden="true" /> Delete
              </button>
              <button type="button" className={s.primaryBtn} onClick={handleSavePipeline} disabled={!canUpdateSettings || busy}>
                <Save size={16} aria-hidden="true" /> Save
              </button>
            </div>
          </div>

          <div className={s.pipelineForm}>
            <TextField label="Name" value={pipelineDraft.name} disabled={!canUpdateSettings} onValueChange={(name) => setPipelineDraft((prev) => ({ ...prev, name }))} />
            <ColorField label="Color" value={pipelineDraft.color} disabled={!canUpdateSettings} onValueChange={(color) => setPipelineDraft((prev) => ({ ...prev, color }))} />
            <CheckboxField label="Default" checked={pipelineDraft.isDefault} disabled={!canUpdateSettings || pipelineDraft.archived} onValueChange={(isDefault) => setPipelineDraft((prev) => ({ ...prev, isDefault }))} />
            <CheckboxField label="Archive" checked={pipelineDraft.archived} disabled={!canUpdateSettings} onValueChange={(archived) => setPipelineDraft((prev) => ({ ...prev, archived, isDefault: archived ? false : prev.isDefault }))} />
            <TextareaField className={s.descriptionField} label="Description" rows={3} value={pipelineDraft.description} disabled={!canUpdateSettings} onValueChange={(description) => setPipelineDraft((prev) => ({ ...prev, description }))} />
          </div>
        </section>

        <section className={s.panel}>
          <div className={s.panelHead}>
            <div>
              <h3>Stages</h3>
              <p>Drag cards to reorder this pipeline.</p>
            </div>
            <button type="button" className={s.primaryBtn} onClick={handleCreateStage} disabled={!canUpdateSettings || busy}>
              <Plus size={16} aria-hidden="true" /> Add stage
            </button>
          </div>

          <div className={s.stageCreate}>
            <TextField label="Stage name" value={stageDraft.name} disabled={!canUpdateSettings} onValueChange={(name) => setStageDraft((prev) => ({ ...prev, name }))} />
            <ColorField label="Color" value={stageDraft.color} disabled={!canUpdateSettings} onValueChange={(color) => setStageDraft((prev) => ({ ...prev, color }))} />
            <NumberField label="Probability" value={stageDraft.probability} min={0} max={100} disabled={!canUpdateSettings} onValueChange={(probability) => setStageDraft((prev) => ({ ...prev, probability }))} />
            <NumberField label="WIP" value={stageDraft.wipLimit} min={0} disabled={!canUpdateSettings} onValueChange={(wipLimit) => setStageDraft((prev) => ({ ...prev, wipLimit }))} />
            <NumberField label="Rot Days" value={stageDraft.rotDays} min={0} disabled={!canUpdateSettings} onValueChange={(rotDays) => setStageDraft((prev) => ({ ...prev, rotDays }))} />
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleStageDragEnd}>
            <SortableContext items={selectedStages.map((stage) => stage.id)} strategy={verticalListSortingStrategy}>
              <div className={s.stageList}>
                {selectedStages.map((stage) => {
                  const editing = editingStageId === stage.id;
                  const draft = editing ? editingStageDraft : toStageDraft(stage);
                  const alternatives = selectedStages
                    .filter((item) => String(item.id) !== String(stage.id))
                    .map((item) => ({ value: item.id, label: item.name }));

                  return (
                    <SortableShell key={stage.id} id={stage.id} disabled={!canUpdateSettings || busy} className={s.stageCard}>
                      <span className={s.stageAccent} style={{ background: stage.color || '#3b82f6' }} />
                      <div className={s.stageMain}>
                        <div className={s.stageTop}>
                          <div className={s.stageIdentity}>
                            <strong>{stage.name}</strong>
                            <span>{Number(stage.probability || 0)}%</span>
                          </div>
                          <div className={s.badges}>
                            {stage.isDefaultEntry ? <Pill tone="success">Default Entry</Pill> : null}
                            {stage.isWon ? <Pill tone="success">Won</Pill> : null}
                            {stage.isLost ? <Pill tone="danger">Lost</Pill> : null}
                            {stage.hidden ? <Pill tone="warning">Hidden</Pill> : null}
                            {stage.archived ? <Pill tone="warning">Archived</Pill> : null}
                            <Pill>{formatCount(stage.dealsCount)}</Pill>
                          </div>
                        </div>

                        {editing ? (
                          <div className={s.stageEdit}>
                            <TextField label="Name" value={draft.name} disabled={!canUpdateSettings} onValueChange={(name) => setEditingStageDraft((prev) => ({ ...prev, name }))} />
                            <ColorField label="Color" value={draft.color} disabled={!canUpdateSettings} onValueChange={(color) => setEditingStageDraft((prev) => ({ ...prev, color }))} />
                            <NumberField label="Probability" value={draft.probability} min={0} max={100} disabled={!canUpdateSettings} onValueChange={(probability) => setEditingStageDraft((prev) => ({ ...prev, probability }))} />
                            <NumberField label="WIP" value={draft.wipLimit} min={0} disabled={!canUpdateSettings} onValueChange={(wipLimit) => setEditingStageDraft((prev) => ({ ...prev, wipLimit }))} />
                            <NumberField label="Rot Days" value={draft.rotDays} min={0} disabled={!canUpdateSettings} onValueChange={(rotDays) => setEditingStageDraft((prev) => ({ ...prev, rotDays }))} />
                            <CheckboxField label="Default Entry" checked={draft.isDefaultEntry} disabled={!canUpdateSettings || draft.isWon || draft.isLost} onValueChange={(isDefaultEntry) => setEditingStageDraft((prev) => ({ ...prev, isDefaultEntry }))} />
                            <CheckboxField label="Won" checked={draft.isWon} disabled={!canUpdateSettings} onValueChange={(isWon) => setEditingStageDraft((prev) => ({ ...prev, isWon, isLost: isWon ? false : prev.isLost, isDefaultEntry: isWon ? false : prev.isDefaultEntry, probability: isWon ? 100 : prev.probability }))} />
                            <CheckboxField label="Lost" checked={draft.isLost} disabled={!canUpdateSettings} onValueChange={(isLost) => setEditingStageDraft((prev) => ({ ...prev, isLost, isWon: isLost ? false : prev.isWon, isDefaultEntry: isLost ? false : prev.isDefaultEntry, probability: isLost ? 0 : prev.probability }))} />
                            <CheckboxField label="Hidden" checked={draft.hidden} disabled={!canUpdateSettings} onValueChange={(hidden) => setEditingStageDraft((prev) => ({ ...prev, hidden }))} />
                            <CheckboxField label="Archived" checked={draft.archived} disabled={!canUpdateSettings} onValueChange={(archived) => setEditingStageDraft((prev) => ({ ...prev, archived }))} />
                          </div>
                        ) : (
                          <div className={s.stageMetrics}>
                            <span>WIP {stage.wipLimit ?? 'none'}</span>
                            <span>Rot {stage.rotDays ?? 'none'}</span>
                          </div>
                        )}

                        {Number(stage.dealsCount || 0) > 0 ? (
                          <div className={s.replacementRow}>
                            <SelectField
                              label="Replacement stage"
                              value={replacementStageById[stage.id] || ''}
                              options={alternatives}
                              disabled={!canUpdateSettings || !alternatives.length}
                              clearable
                              onValueChange={(replacementStageId) => setReplacementStageById((prev) => ({ ...prev, [stage.id]: replacementStageId }))}
                            />
                          </div>
                        ) : null}
                      </div>
                      <div className={s.actions}>
                        {editing ? (
                          <>
                            <button type="button" className={s.secondaryBtn} onClick={() => setEditingStageId('')}>Cancel</button>
                            <button type="button" className={s.primaryBtn} onClick={() => handleSaveStage(stage.id)} disabled={!canUpdateSettings || busy}><Save size={15} aria-hidden="true" /> Save</button>
                          </>
                        ) : (
                          <>
                            <button type="button" className={s.secondaryBtn} onClick={() => { setEditingStageId(stage.id); setEditingStageDraft(toStageDraft(stage)); }} disabled={!canUpdateSettings || busy}>Edit</button>
                            <button type="button" className={s.dangerBtn} onClick={() => handleDeleteStage(stage)} disabled={!canUpdateSettings || busy}><Trash2 size={15} aria-hidden="true" /> Delete</button>
                          </>
                        )}
                      </div>
                    </SortableShell>
                  );
                })}
                {!selectedStages.length ? <div className={s.emptyState}>Add the first stage from the row above.</div> : null}
              </div>
            </SortableContext>
          </DndContext>
        </section>
      </div>
    );
  };

  const renderLostReasons = () => (
    <section className={s.panel}>
      <div className={s.panelHead}>
        <div>
          <h3>Lost Reasons</h3>
          <p>Company-wide reasons used by lost deal flows.</p>
        </div>
        <button type="button" className={s.primaryBtn} onClick={handleCreateLostReason} disabled={!canUpdateSettings || busy}>
          <Plus size={16} aria-hidden="true" /> Add
        </button>
      </div>
      <div className={s.reasonCreate}>
        <TextField label="Reason" value={lostReasonDraft} disabled={!canUpdateSettings} onValueChange={setLostReasonDraft} />
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleLostReasonDragEnd}>
        <SortableContext items={lostReasons.map((reason) => reason.id)} strategy={verticalListSortingStrategy}>
          <div className={s.reasonList}>
            {lostReasons.map((reason) => {
              const editing = editingLostReasonId === reason.id;
              return (
                <SortableShell key={reason.id} id={reason.id} disabled={!canUpdateSettings || busy} className={s.reasonCard}>
                  <div className={s.reasonMain}>
                    {editing ? (
                      <TextField label="Reason" value={editingLostReasonName} disabled={!canUpdateSettings} onValueChange={setEditingLostReasonName} />
                    ) : (
                      <div className={s.reasonTitle}>
                        <span>{reason.name}</span>
                        {reason.archived ? <Pill tone="warning">Archive</Pill> : null}
                      </div>
                    )}
                  </div>
                  <div className={s.actions}>
                    {editing ? (
                      <>
                        <button type="button" className={s.secondaryBtn} onClick={() => setEditingLostReasonId('')}>Cancel</button>
                        <button type="button" className={s.primaryBtn} onClick={() => handleSaveLostReason(reason.id)} disabled={!canUpdateSettings || busy}><Save size={15} aria-hidden="true" /> Save</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className={s.secondaryBtn} onClick={() => { setEditingLostReasonId(reason.id); setEditingLostReasonName(reason.name || ''); }} disabled={!canUpdateSettings || busy}>Edit</button>
                        <button type="button" className={s.secondaryBtn} onClick={() => run(async () => updateLostReason({ lostReasonId: reason.id, payload: { archived: !reason.archived } }).unwrap(), reason.archived ? 'Lost reason restored' : 'Lost reason archived')} disabled={!canUpdateSettings || busy}><Archive size={15} aria-hidden="true" /> {reason.archived ? 'Restore' : 'Archive'}</button>
                        <button type="button" className={s.dangerBtn} onClick={() => run(async () => deleteLostReason(reason.id).unwrap(), 'Lost reason deleted')} disabled={!canUpdateSettings || busy}><Trash2 size={15} aria-hidden="true" /> Delete</button>
                      </>
                    )}
                  </div>
                </SortableShell>
              );
            })}
            {!lostReasons.length && !lostReasonsFetching ? <div className={s.emptyState}>Add a lost reason from the field above.</div> : null}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );

  const renderBottom = () => (
    <div className={s.lowerGrid}>
      {renderLostReasons()}

      <section className={s.panel}>
        <div className={s.panelHead}>
          <div>
            <h3>Forecast</h3>
            <p>Stage probabilities feed weighted pipeline value.</p>
          </div>
          <CircleDollarSign size={20} aria-hidden="true" />
        </div>
        <div className={s.settingsGrid}>
          <SelectField
            label="Probability mode"
            value={settingsDraft.probabilityMode}
            options={[
              { value: 'manual', label: 'Manual' },
              { value: 'automatic', label: 'Automatic' },
              { value: 'hybrid', label: 'Hybrid' },
            ]}
            disabled={!canUpdateSettings}
            onValueChange={(probabilityMode) => setSettingsDraft((prev) => ({ ...prev, probabilityMode }))}
          />
          <button type="button" className={s.primaryBtn} onClick={handleSaveSettings} disabled={!canUpdateSettings || busy}>
            <Save size={16} aria-hidden="true" /> Save
          </button>
        </div>
        <div className={s.probabilityList}>
          {selectedStages.map((stage) => (
            <div key={stage.id} className={s.probabilityRow}>
              <span className={s.colorDot} style={{ background: stage.color || '#3b82f6' }} />
              <span>{stage.name}</span>
              <strong>{Number(stage.probability || 0)}%</strong>
            </div>
          ))}
        </div>
      </section>

      <section className={s.panel}>
        <div className={s.panelHead}>
          <div>
            <h3>Defaults</h3>
            <p>Creation defaults used by new deals.</p>
          </div>
          <button type="button" className={s.primaryBtn} onClick={handleSaveSettings} disabled={!canUpdateSettings || busy}>
            <Save size={16} aria-hidden="true" /> Save
          </button>
        </div>
        <div className={s.settingsGrid}>
          <TextField label="Currency" value={settingsDraft.defaultCurrency} upper maxLength={8} disabled={!canUpdateSettings} onValueChange={(defaultCurrency) => setSettingsDraft((prev) => ({ ...prev, defaultCurrency }))} />
          <NumberField label="Expected Close" value={settingsDraft.defaultExpectedCloseDays} min={0} max={3650} disabled={!canUpdateSettings} onValueChange={(defaultExpectedCloseDays) => setSettingsDraft((prev) => ({ ...prev, defaultExpectedCloseDays }))} />
          <SelectField
            label="Visibility"
            value={settingsDraft.visibility}
            options={[
              { value: 'company', label: 'Company' },
              { value: 'team', label: 'Team' },
              { value: 'owner', label: 'Owner' },
            ]}
            disabled={!canUpdateSettings}
            onValueChange={(visibility) => setSettingsDraft((prev) => ({ ...prev, visibility }))}
          />
          <CheckboxField label="Numbering" checked={settingsDraft.dealNumberingEnabled} disabled={!canUpdateSettings} onValueChange={(dealNumberingEnabled) => setSettingsDraft((prev) => ({ ...prev, dealNumberingEnabled }))} />
          <TextField label="Prefix" value={settingsDraft.dealNumberPrefix} upper maxLength={16} disabled={!canUpdateSettings || !settingsDraft.dealNumberingEnabled} onValueChange={(dealNumberPrefix) => setSettingsDraft((prev) => ({ ...prev, dealNumberPrefix }))} />
        </div>
      </section>

      <section className={`${s.panel} ${s.automationPanel}`}>
        <div className={s.panelHead}>
          <div>
            <h3>Automation</h3>
            <p>Stage automation engine is not enabled in this backend.</p>
          </div>
          <Workflow size={20} aria-hidden="true" />
        </div>
        <Pill tone="warning">Deferred</Pill>
      </section>
    </div>
  );

  return (
    <div className={s.wrap}>
      <header className={s.header}>
        <div>
          <h2>Pipeline Builder</h2>
          <p>Pipeline is the sales process. Stages, reasons, forecast and defaults live around it.</p>
        </div>
        <div className={s.headerStats}>
          <Pill tone="success">{activePipelines.length} active</Pill>
          <Pill>{pipelines.length} total</Pill>
        </div>
      </header>

      {notice ? <div className={s.notice}>{notice}</div> : null}
      {errorText ? <div className={s.error}>{errorText}</div> : null}
      {pipelinesFetching ? <div className={s.notice}>Loading pipeline builder...</div> : null}

      <main className={s.builder}>
        {renderPipelineList()}
        <section className={s.workspace}>
          {renderPipelineEditor()}
          {selectedPipeline ? renderBottom() : null}
        </section>
      </main>
    </div>
  );
}
