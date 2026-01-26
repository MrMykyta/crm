// src/pages/system/TaskPage/TaskDetailPage/index.jsx
import { useParams } from 'react-router-dom';
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import EntityDetailPage from '../../../_scaffold/EntityDetailPage';
import { buildTaskSchema, toFormTask, toApiTask } from '../../../../schemas/task.schema';
import { useGetTaskQuery, useUpdateTaskMutation } from '../../../../store/rtk/tasksApi';
import { filterSchema } from '../../../../utils/filterSchema';
import TaskDetailTabs from '../TaskDetailTabs';

const TABS = [
  { key:'overview',  label:'Описание' },
  { key:'files',     label:'Файлы' },
  { key:'tasks',     label:'Задачи' },
  { key:'offers',    label:'Предложения' },
  { key:'orders',    label:'Заказы' },
  { key:'invoices',  label:'Счета' },
  { key:'documents', label:'Документы' },
  { key:'email',     label:'Имейл' },
];

const TASK_FORM_FIELDS = [
  'title','category','status','priority', 'creator',
  'startAt','endAt',
  'assigneeIds','watcherIds',
  'counterpartyId','dealId','contactIds',
  'statusAggregate',
];

export default function TaskDetailPage(){
  const { id } = useParams();
  const { data: base, isFetching } = useGetTaskQuery(id);
  const [updateTask, { isLoading: saving }] = useUpdateTaskMutation();
  const members = useSelector((s) => s.bootstrap?.companyUsers || []);
  const currentUserId = useSelector((s) => s.auth?.currentUser?.id || null);

  const schemaBuilder = useMemo(() => (i18n) => {
    const full = buildTaskSchema(i18n, { members, currentUserId });
    return filterSchema(full, TASK_FORM_FIELDS);
  }, [members, currentUserId]);

  const save = async (entityId, payload) => {
    const saved = await updateTask({ id: entityId, payload }).unwrap();
    return saved;
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
      saveOnExit
      clearDraftOnUnmount
      RightTabsComponent={TaskDetailTabs}
    />
  );
}
