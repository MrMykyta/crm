// src/pages/system/TaskPage/TaskDetailPage/index.js
import { useParams } from 'react-router-dom';
import { useMemo } from 'react';
import EntityDetailPage from '../../../_scaffold/EntityDetailPage';
import { buildTaskSchema, toFormTask, toApiTask } from '../../../../schemas/task.schema';
import { useGetTaskQuery, useUpdateTaskMutation } from '../../../../store/rtk/tasksApi';

// опционально: ParticipantsEditor, если используешь левую панель участников
// import ParticipantsEditor from '../../../../components/forms/SmartForm/ParticipantsEditor';

const TABS = [
  { key:'overview',   label:'Описание' },
  { key:'notes',      label:'Заметки' },
  { key:'files',      label:'Файлы' },
  { key:'relations',  label:'Связи' },
  { key:'history',    label:'История' },
  { key:'reminders',  label:'Напоминания' },
  { key:'settings',   label:'Настройки' },
];

export default function TaskDetailPage(){
  const { id } = useParams();

  const { data: base, isFetching } = useGetTaskQuery(id);
  const [updateTask, { isLoading: saving }] = useUpdateTaskMutation();

  // если есть отдельная ручка lookups — подтяни здесь через RTK в будущем
  const lookups = useMemo(() => ({
    userOptions: [], departmentOptions: [],
    contactOptions: [], counterpartyOptions: [], dealOptions: [],
  }), []);

  const schemaBuilder = useMemo(() => (i18n) => buildTaskSchema(i18n, lookups), [lookups]);

  const save = async (entityId, payload) => {
    const saved = await updateTask({ id: entityId, payload }).unwrap();
    return saved; // EntityDetailPage возьмёт saved для дальнейшей работы
  };

  if (!base && isFetching) return null;
  if (!base) return null;

  return (
    <EntityDetailPage
      id={id}
      tabs={TABS}
      tabsNamespace="crm.task.detail"
      schemaBuilder={schemaBuilder}
      toForm={toFormTask}
      toApi={toApiTask}
      isSaving={saving}
      load={async()=>base}
      save={save}
      storageKeyPrefix="task"
      autosave={{ debounceMs: 500 }}
      saveOnExit={true}
      clearDraftOnUnmount={true}
      // leftExtras={<ParticipantsEditor .../>}
    />
  );
}