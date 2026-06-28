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
  CircleDashed,
  GripVertical,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';

import {
  CheckboxField,
  ColorField,
  NumberField,
  SelectField,
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

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'pipelines', label: 'Pipelines' },
  { id: 'stages', label: 'Stages' },
  { id: 'lostReasons', label: 'Lost Reasons' },
  { id: 'forecast', label: 'Probability' },
  { id: 'defaults', label: 'Defaults' },
];

const DEFAULT_PIPELINE_DRAFT = {
  name: '',
  color: '#2563eb',
  description: '',
  isDefault: false,
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
};

const DEFAULT_SETTINGS_DRAFT = {
  probabilityMode: 'automatic',
  defaultCurrency: 'PLN',
  defaultExpectedCloseDays: 30,
  visibility: 'company',
  dealNumberingEnabled: false,
  dealNumberPrefix: 'DL',
};

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
  return `${number.toLocaleString()} deals`;
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

  const [activeTab, setActiveTab] = useState('general');
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [pipelineDraft, setPipelineDraft] = useState(DEFAULT_PIPELINE_DRAFT);
  const [editingPipelineId, setEditingPipelineId] = useState('');
  const [editingPipelineDraft, setEditingPipelineDraft] = useState(DEFAULT_PIPELINE_DRAFT);
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
  const selectedPipeline = pipelines.find((pipeline) => String(pipeline.id) === String(selectedPipelineId))
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
    const name = pipelineDraft.name.trim();
    if (!name) throw new Error('Pipeline name is required');
    const created = await createPipeline({
      ...pipelineDraft,
      name,
    }).unwrap();
    setPipelineDraft(DEFAULT_PIPELINE_DRAFT);
    setSelectedPipelineId(created.id);
    setActiveTab('stages');
  }, 'Pipeline created');

  const handleSavePipeline = (pipelineId) => run(async () => {
    const name = editingPipelineDraft.name.trim();
    if (!name) throw new Error('Pipeline name is required');
    await updatePipeline({
      pipelineId,
      payload: {
        ...editingPipelineDraft,
        name,
      },
    }).unwrap();
    setEditingPipelineId('');
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
    }, 'Pipeline removed');
  };

  const handleSetDefaultPipeline = (pipeline) => run(async () => {
    await updatePipeline({
      pipelineId: pipeline.id,
      payload: { isDefault: true, archived: false },
    }).unwrap();
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
      payload: {
        ...stageDraft,
        name,
        wipLimit: stageDraft.wipLimit === '' ? null : Number(stageDraft.wipLimit),
      },
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
      payload: {
        ...editingStageDraft,
        name,
        wipLimit: editingStageDraft.wipLimit === '' ? null : Number(editingStageDraft.wipLimit),
      },
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
  }, 'Deal settings saved');

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

  const pipelineOptions = pipelines.map((pipeline) => ({
    value: pipeline.id,
    label: `${pipeline.name}${pipeline.archived ? ' (archived)' : ''}`,
  }));
  const renderGeneral = () => (
    <div className={s.gridTwo}>
      <section className={s.panel}>
        <div className={s.panelHead}>
          <div>
            <h3>General deal behavior</h3>
            <p>Company-wide defaults used by Deal Create, Detail, Kanban and Forecast.</p>
          </div>
          <button type="button" className={s.primaryBtn} onClick={handleSaveSettings} disabled={!canUpdateSettings || busy}>
            <Save size={16} aria-hidden="true" /> Save
          </button>
        </div>
        <div className={s.formGrid}>
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
          <TextField
            label="Default currency"
            value={settingsDraft.defaultCurrency}
            upper
            maxLength={8}
            disabled={!canUpdateSettings}
            onValueChange={(defaultCurrency) => setSettingsDraft((prev) => ({ ...prev, defaultCurrency }))}
          />
          <NumberField
            label="Default expected close"
            value={settingsDraft.defaultExpectedCloseDays}
            min={0}
            max={3650}
            disabled={!canUpdateSettings}
            onValueChange={(defaultExpectedCloseDays) => setSettingsDraft((prev) => ({ ...prev, defaultExpectedCloseDays }))}
          />
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
          <CheckboxField
            label="Deal numbering enabled"
            checked={settingsDraft.dealNumberingEnabled}
            disabled={!canUpdateSettings}
            onValueChange={(dealNumberingEnabled) => setSettingsDraft((prev) => ({ ...prev, dealNumberingEnabled }))}
          />
          <TextField
            label="Deal number prefix"
            value={settingsDraft.dealNumberPrefix}
            upper
            maxLength={16}
            disabled={!canUpdateSettings || !settingsDraft.dealNumberingEnabled}
            onValueChange={(dealNumberPrefix) => setSettingsDraft((prev) => ({ ...prev, dealNumberPrefix }))}
          />
        </div>
      </section>

      <section className={s.panel}>
        <div className={s.panelHead}>
          <div>
            <h3>Default pipeline</h3>
            <p>New deals start from the default pipeline and its default-entry stage.</p>
          </div>
        </div>
        <div className={s.pipelineSelectList}>
          {activePipelines.map((pipeline) => (
            <button
              key={pipeline.id}
              type="button"
              className={`${s.choiceCard} ${pipeline.isDefault ? s.choiceCardActive : ''}`}
              onClick={() => canUpdateSettings && handleSetDefaultPipeline(pipeline)}
              disabled={!canUpdateSettings || busy}
            >
              <span className={s.colorDot} style={{ background: pipeline.color || '#2563eb' }} />
              <span>{pipeline.name}</span>
              {pipeline.isDefault ? <CheckCircle2 size={16} aria-hidden="true" /> : null}
            </button>
          ))}
          {!activePipelines.length ? <div className={s.emptyState}>No active pipelines yet.</div> : null}
        </div>
      </section>
    </div>
  );

  const renderPipelines = () => (
    <div className={s.stack}>
      <section className={s.panel}>
        <div className={s.panelHead}>
          <div>
            <h3>Create pipeline</h3>
            <p>New pipelines are immediately available in Deal Create, Detail and Kanban.</p>
          </div>
          <button type="button" className={s.primaryBtn} onClick={handleCreatePipeline} disabled={!canUpdateSettings || busy}>
            <Plus size={16} aria-hidden="true" /> Create
          </button>
        </div>
        <div className={s.inlineForm}>
          <TextField label="Name" value={pipelineDraft.name} disabled={!canUpdateSettings} onValueChange={(name) => setPipelineDraft((prev) => ({ ...prev, name }))} />
          <ColorField label="Color" value={pipelineDraft.color} disabled={!canUpdateSettings} onValueChange={(color) => setPipelineDraft((prev) => ({ ...prev, color }))} />
          <TextField label="Description" value={pipelineDraft.description} disabled={!canUpdateSettings} onValueChange={(description) => setPipelineDraft((prev) => ({ ...prev, description }))} />
          <CheckboxField label="Default" checked={pipelineDraft.isDefault} disabled={!canUpdateSettings} onValueChange={(isDefault) => setPipelineDraft((prev) => ({ ...prev, isDefault }))} />
        </div>
      </section>

      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handlePipelineDragEnd}>
        <SortableContext items={pipelines.map((pipeline) => pipeline.id)} strategy={verticalListSortingStrategy}>
          <div className={s.cardList}>
            {pipelines.map((pipeline) => {
              const editing = editingPipelineId === pipeline.id;
              return (
                <SortableShell key={pipeline.id} id={pipeline.id} disabled={!canUpdateSettings || busy} className={s.pipelineCard}>
                  <div className={s.cardBody}>
                    <div className={s.cardTop}>
                      <button
                        type="button"
                        className={s.pipelineTitle}
                        onClick={() => setSelectedPipelineId(pipeline.id)}
                      >
                        <span className={s.colorDot} style={{ background: pipeline.color || '#2563eb' }} />
                        <span>{pipeline.name}</span>
                      </button>
                      <div className={s.badges}>
                        {pipeline.isDefault ? <Pill tone="success">Default</Pill> : null}
                        {pipeline.archived ? <Pill tone="warning">Archived</Pill> : null}
                        <Pill>{formatCount(pipeline.dealsCount)}</Pill>
                      </div>
                    </div>

                    {editing ? (
                      <div className={s.inlineForm}>
                        <TextField label="Name" value={editingPipelineDraft.name} disabled={!canUpdateSettings} onValueChange={(name) => setEditingPipelineDraft((prev) => ({ ...prev, name }))} />
                        <ColorField label="Color" value={editingPipelineDraft.color} disabled={!canUpdateSettings} onValueChange={(color) => setEditingPipelineDraft((prev) => ({ ...prev, color }))} />
                        <TextField label="Description" value={editingPipelineDraft.description} disabled={!canUpdateSettings} onValueChange={(description) => setEditingPipelineDraft((prev) => ({ ...prev, description }))} />
                        <CheckboxField label="Default" checked={editingPipelineDraft.isDefault} disabled={!canUpdateSettings || editingPipelineDraft.archived} onValueChange={(isDefault) => setEditingPipelineDraft((prev) => ({ ...prev, isDefault }))} />
                      </div>
                    ) : (
                      <p className={s.cardDescription}>{pipeline.description || 'No description'}</p>
                    )}
                  </div>
                  <div className={s.actions}>
                    {editing ? (
                      <>
                        <button type="button" className={s.secondaryBtn} onClick={() => setEditingPipelineId('')}>Cancel</button>
                        <button type="button" className={s.primaryBtn} onClick={() => handleSavePipeline(pipeline.id)} disabled={!canUpdateSettings || busy}><Save size={15} aria-hidden="true" /> Save</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className={s.secondaryBtn} onClick={() => { setEditingPipelineId(pipeline.id); setEditingPipelineDraft(toPipelineDraft(pipeline)); }} disabled={!canUpdateSettings || busy}>Edit</button>
                        <button type="button" className={s.secondaryBtn} onClick={() => handleSetDefaultPipeline(pipeline)} disabled={!canUpdateSettings || pipeline.isDefault || pipeline.archived || busy}>Set default</button>
                        <button type="button" className={s.secondaryBtn} onClick={() => handleArchivePipeline(pipeline)} disabled={!canUpdateSettings || busy}><Archive size={15} aria-hidden="true" /> {pipeline.archived ? 'Restore' : 'Archive'}</button>
                        <button type="button" className={s.dangerBtn} onClick={() => handleDeletePipeline(pipeline)} disabled={!canUpdateSettings || busy}><Trash2 size={15} aria-hidden="true" /> Delete</button>
                      </>
                    )}
                  </div>
                </SortableShell>
              );
            })}
            {!pipelines.length && !pipelinesFetching ? <div className={s.emptyState}>No pipelines yet.</div> : null}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );

  const renderStages = () => (
    <div className={s.stack}>
      <section className={s.panel}>
        <div className={s.panelHead}>
          <div>
            <h3>Stage editor</h3>
            <p>One default-entry, one won and one lost stage are allowed per pipeline.</p>
          </div>
          <SelectField
            className={s.pipelinePicker}
            value={selectedPipeline?.id || ''}
            options={pipelineOptions}
            disabled={!pipelines.length}
            onValueChange={setSelectedPipelineId}
          />
        </div>
      </section>

      {selectedPipeline ? (
        <>
          <section className={s.panel}>
            <div className={s.panelHead}>
              <div>
                <h3>Add stage</h3>
                <p>{selectedPipeline.name}</p>
              </div>
              <button type="button" className={s.primaryBtn} onClick={handleCreateStage} disabled={!canUpdateSettings || busy}>
                <Plus size={16} aria-hidden="true" /> Add
              </button>
            </div>
            <div className={s.stageForm}>
              <TextField label="Name" value={stageDraft.name} disabled={!canUpdateSettings} onValueChange={(name) => setStageDraft((prev) => ({ ...prev, name }))} />
              <ColorField label="Color" value={stageDraft.color} disabled={!canUpdateSettings} onValueChange={(color) => setStageDraft((prev) => ({ ...prev, color }))} />
              <NumberField label="Probability" value={stageDraft.probability} min={0} max={100} disabled={!canUpdateSettings} onValueChange={(probability) => setStageDraft((prev) => ({ ...prev, probability }))} />
              <NumberField label="WIP" value={stageDraft.wipLimit} min={0} disabled={!canUpdateSettings} onValueChange={(wipLimit) => setStageDraft((prev) => ({ ...prev, wipLimit }))} />
              <CheckboxField label="Default Entry" checked={stageDraft.isDefaultEntry} disabled={!canUpdateSettings || stageDraft.isWon || stageDraft.isLost} onValueChange={(isDefaultEntry) => setStageDraft((prev) => ({ ...prev, isDefaultEntry }))} />
              <CheckboxField label="Won" checked={stageDraft.isWon} disabled={!canUpdateSettings} onValueChange={(isWon) => setStageDraft((prev) => ({ ...prev, isWon, isLost: isWon ? false : prev.isLost, isDefaultEntry: isWon ? false : prev.isDefaultEntry, probability: isWon ? 100 : prev.probability }))} />
              <CheckboxField label="Lost" checked={stageDraft.isLost} disabled={!canUpdateSettings} onValueChange={(isLost) => setStageDraft((prev) => ({ ...prev, isLost, isWon: isLost ? false : prev.isWon, isDefaultEntry: isLost ? false : prev.isDefaultEntry, probability: isLost ? 0 : prev.probability }))} />
              <CheckboxField label="Hidden" checked={stageDraft.hidden} disabled={!canUpdateSettings} onValueChange={(hidden) => setStageDraft((prev) => ({ ...prev, hidden }))} />
            </div>
          </section>

          <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleStageDragEnd}>
            <SortableContext items={selectedStages.map((stage) => stage.id)} strategy={verticalListSortingStrategy}>
              <div className={s.cardList}>
                {selectedStages.map((stage) => {
                  const editing = editingStageId === stage.id;
                  const draft = editing ? editingStageDraft : toStageDraft(stage);
                  const alternatives = selectedStages
                    .filter((item) => String(item.id) !== String(stage.id))
                    .map((item) => ({ value: item.id, label: item.name }));
                  return (
                    <SortableShell key={stage.id} id={stage.id} disabled={!canUpdateSettings || busy} className={s.stageCard}>
                      <div className={s.stageColor} style={{ background: stage.color || '#3b82f6' }} />
                      <div className={s.cardBody}>
                        <div className={s.cardTop}>
                          <div className={s.stageTitle}>
                            <span>{stage.name}</span>
                            <small>{Number(stage.probability || 0)}%</small>
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
                          <div className={s.stageForm}>
                            <TextField label="Name" value={draft.name} disabled={!canUpdateSettings} onValueChange={(name) => setEditingStageDraft((prev) => ({ ...prev, name }))} />
                            <ColorField label="Color" value={draft.color} disabled={!canUpdateSettings} onValueChange={(color) => setEditingStageDraft((prev) => ({ ...prev, color }))} />
                            <NumberField label="Probability" value={draft.probability} min={0} max={100} disabled={!canUpdateSettings} onValueChange={(probability) => setEditingStageDraft((prev) => ({ ...prev, probability }))} />
                            <NumberField label="WIP" value={draft.wipLimit} min={0} disabled={!canUpdateSettings} onValueChange={(wipLimit) => setEditingStageDraft((prev) => ({ ...prev, wipLimit }))} />
                            <CheckboxField label="Default Entry" checked={draft.isDefaultEntry} disabled={!canUpdateSettings || draft.isWon || draft.isLost} onValueChange={(isDefaultEntry) => setEditingStageDraft((prev) => ({ ...prev, isDefaultEntry }))} />
                            <CheckboxField label="Won" checked={draft.isWon} disabled={!canUpdateSettings} onValueChange={(isWon) => setEditingStageDraft((prev) => ({ ...prev, isWon, isLost: isWon ? false : prev.isLost, isDefaultEntry: isWon ? false : prev.isDefaultEntry, probability: isWon ? 100 : prev.probability }))} />
                            <CheckboxField label="Lost" checked={draft.isLost} disabled={!canUpdateSettings} onValueChange={(isLost) => setEditingStageDraft((prev) => ({ ...prev, isLost, isWon: isLost ? false : prev.isWon, isDefaultEntry: isLost ? false : prev.isDefaultEntry, probability: isLost ? 0 : prev.probability }))} />
                            <CheckboxField label="Hidden" checked={draft.hidden} disabled={!canUpdateSettings} onValueChange={(hidden) => setEditingStageDraft((prev) => ({ ...prev, hidden }))} />
                            <CheckboxField label="Archived" checked={draft.archived} disabled={!canUpdateSettings} onValueChange={(archived) => setEditingStageDraft((prev) => ({ ...prev, archived }))} />
                          </div>
                        ) : null}

                        {Number(stage.dealsCount || 0) > 0 ? (
                          <div className={s.replacementRow}>
                            <SelectField
                              label="Replacement stage for delete"
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
                {!selectedStages.length ? <div className={s.emptyState}>No stages in this pipeline yet.</div> : null}
              </div>
            </SortableContext>
          </DndContext>
        </>
      ) : (
        <div className={s.emptyState}>Create a pipeline before editing stages.</div>
      )}
    </div>
  );

  const renderLostReasons = () => (
    <div className={s.stack}>
      <section className={s.panel}>
        <div className={s.panelHead}>
          <div>
            <h3>Create lost reason</h3>
            <p>Reasons are available for future lost-deal workflows and reporting.</p>
          </div>
          <button type="button" className={s.primaryBtn} onClick={handleCreateLostReason} disabled={!canUpdateSettings || busy}>
            <Plus size={16} aria-hidden="true" /> Create
          </button>
        </div>
        <TextField label="Reason name" value={lostReasonDraft} disabled={!canUpdateSettings} onValueChange={setLostReasonDraft} />
      </section>

      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleLostReasonDragEnd}>
        <SortableContext items={lostReasons.map((reason) => reason.id)} strategy={verticalListSortingStrategy}>
          <div className={s.cardList}>
            {lostReasons.map((reason) => {
              const editing = editingLostReasonId === reason.id;
              return (
                <SortableShell key={reason.id} id={reason.id} disabled={!canUpdateSettings || busy} className={s.reasonCard}>
                  <div className={s.cardBody}>
                    {editing ? (
                      <TextField label="Reason name" value={editingLostReasonName} disabled={!canUpdateSettings} onValueChange={setEditingLostReasonName} />
                    ) : (
                      <div className={s.reasonTitle}>
                        <span>{reason.name}</span>
                        {reason.archived ? <Pill tone="warning">Archived</Pill> : null}
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
            {!lostReasons.length && !lostReasonsFetching ? <div className={s.emptyState}>No lost reasons yet.</div> : null}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );

  const renderForecast = () => (
    <div className={s.gridTwo}>
      <section className={s.panel}>
        <div className={s.panelHead}>
          <div>
            <h3>Probability input</h3>
            <p>Probability uses stage values from the selected pipeline. Reports are intentionally out of scope.</p>
          </div>
          <CircleDashed size={20} aria-hidden="true" />
        </div>
        <div className={s.formGrid}>
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
            <Save size={16} aria-hidden="true" /> Save probability settings
          </button>
        </div>
      </section>

      <section className={s.panel}>
        <div className={s.panelHead}>
          <div>
            <h3>Pipeline probabilities</h3>
            <p>Stage probabilities below feed Kanban summaries and Deal Detail stage path.</p>
          </div>
        </div>
        <div className={s.probabilityList}>
          {(selectedPipeline?.stages || []).map((stage) => (
            <div key={stage.id} className={s.probabilityRow}>
              <span className={s.colorDot} style={{ background: stage.color || '#3b82f6' }} />
              <span>{stage.name}</span>
              <strong>{Number(stage.probability || 0)}%</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const renderDefaults = () => (
    <div className={s.gridTwo}>
      <section className={s.panel}>
        <div className={s.panelHead}>
          <div>
            <h3>Creation defaults</h3>
            <p>Defaults used when a deal is created without explicit pipeline context.</p>
          </div>
          <button type="button" className={s.primaryBtn} onClick={handleSaveSettings} disabled={!canUpdateSettings || busy}>
            <Save size={16} aria-hidden="true" /> Save
          </button>
        </div>
        <div className={s.formGrid}>
          <SelectField
            label="Default Pipeline"
            value={activePipelines.find((pipeline) => pipeline.isDefault)?.id || ''}
            options={activePipelines.map((pipeline) => ({ value: pipeline.id, label: pipeline.name }))}
            disabled={!canUpdateSettings}
            onValueChange={(pipelineId) => {
              const pipeline = activePipelines.find((item) => item.id === pipelineId);
              if (pipeline) handleSetDefaultPipeline(pipeline);
            }}
          />
          <TextField
            label="Currency"
            value={settingsDraft.defaultCurrency}
            upper
            maxLength={8}
            disabled={!canUpdateSettings}
            onValueChange={(defaultCurrency) => setSettingsDraft((prev) => ({ ...prev, defaultCurrency }))}
          />
          <NumberField
            label="Expected close days"
            value={settingsDraft.defaultExpectedCloseDays}
            min={0}
            max={3650}
            disabled={!canUpdateSettings}
            onValueChange={(defaultExpectedCloseDays) => setSettingsDraft((prev) => ({ ...prev, defaultExpectedCloseDays }))}
          />
        </div>
      </section>

      <section className={s.panel}>
        <div className={s.panelHead}>
          <div>
            <h3>Current entry stages</h3>
            <p>Each pipeline has one default-entry stage.</p>
          </div>
        </div>
        <div className={s.pipelineSelectList}>
          {pipelines.map((pipeline) => {
            const entry = pipeline.stages?.find((stage) => stage.isDefaultEntry);
            return (
              <div key={pipeline.id} className={s.choiceCard}>
                <span className={s.colorDot} style={{ background: pipeline.color || '#2563eb' }} />
                <span>{pipeline.name}</span>
                <strong>{entry?.name || 'No entry stage'}</strong>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );

  const content = {
    general: renderGeneral,
    pipelines: renderPipelines,
    stages: renderStages,
    lostReasons: renderLostReasons,
    forecast: renderForecast,
    defaults: renderDefaults,
  }[activeTab];

  return (
    <div className={s.wrap}>
      <header className={s.header}>
        <div>
          <h2>Deals Settings</h2>
          <p>Company sales configuration for pipelines, stages, forecast defaults and lost reasons.</p>
        </div>
        <div className={s.headerStats}>
          <Pill tone="success">{activePipelines.length} active pipelines</Pill>
          <Pill>{pipelines.length} total pipelines</Pill>
        </div>
      </header>

      <nav className={s.tabs} aria-label="Deals settings tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`${s.tab} ${activeTab === tab.id ? s.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {notice ? <div className={s.notice}>{notice}</div> : null}
      {errorText ? <div className={s.error}>{errorText}</div> : null}
      {pipelinesFetching ? <div className={s.notice}>Loading deal settings...</div> : null}

      <main className={s.content}>
        {content ? content() : null}
      </main>
    </div>
  );
}
