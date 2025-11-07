// src/pages/crm/tasks/index.jsx
import React, { useMemo, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import ListPage from '../../../components/data/ListPage';
import Modal from '../../../components/Modal';
import AddButton from '../../../components/buttons/AddButton/AddButton';
import LinkCell from '../../../components/cells/LinkCell';
import FilterToolbar from '../../../components/filters/FilterToolbar';
import useGridPrefs from '../../../hooks/useGridPrefs';
import useOpenAsModal from '../../../hooks/useOpenAsModal';

import { TASK_STATUS } from '../../../schemas/task.schema';
import { buildTaskLookups } from '../../../utils/taskLookups';

import TaskForm from './TaskForm';
import { useCreateTaskMutation } from '../../../store/rtk/tasksApi';

export default function TasksPage(){
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const openAsModal = useOpenAsModal();

  const { colWidths, colOrder, onColumnResize, onColumnOrderChange } = useGridPrefs('crm.tasks');

  // lookups (users/departments/contacts/counterparties/deals) и текущий пользователь
  const lookups = useMemo(() => buildTaskLookups(), []);
  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); }
    catch { return null; }
  }, []);

  const [createTask] = useCreateTaskMutation();

  const openDetail = useCallback((id)=>{
    const suffix = openAsModal ? '?modal=1' : '';
    navigate(`/main/tasks/${id}${suffix}`);
  }, [navigate, openAsModal]);

  const columns = useMemo(()=>[
    {
      key:'title', title:t('crm.task.table.title'), sortable:true, width:360,
      render:(r)=> (
        <LinkCell
          primary={r.title}
          secondary={r.category || undefined}
          onClick={()=>openDetail(r.id)}
          ariaLabel={t('crm.task.actions.openTask', { name: r.title })}
        />
      )
    },
    { key:'status', title:t('crm.task.table.status'), sortable:true, width:160, render:(r)=> t(`crm.task.enums.status.${r.status}`) },
    { key:'priority', title:t('crm.task.table.priority'), sortable:true, width:120 },
    { key:'schedule', title:t('crm.task.table.schedule'), width:260, render:(r)=>{
        const s = r.startAt ? new Date(r.startAt) : null;
        const e = r.endAt ? new Date(r.endAt) : null;
        if(!s && !e) return '—';
        const fmt = (d)=> d?.toLocaleString?.() || '';
        return e ? `${fmt(s)} — ${fmt(e)}` : fmt(s);
      }
    },
    { key:'assignees', title:t('crm.task.table.assignees'), width:200, render:(r)=>{
        const users = Array.isArray(r.userParticipants) ? r.userParticipants.filter(u=>u?.TaskUserParticipant?.role==='assignee') : [];
        if (!users.length) return '—';
        const names = users
          .map(u=> `${u.firstName||''} ${u.lastName||''}`.trim())
          .filter(Boolean);
        return names.slice(0,2).join(', ') + (names.length>2 ? ` +${names.length-2}` : '');
      }
    },
  ], [t, openDetail]);

  const defaultQuery = useMemo(()=>({ sort:'createdAt', dir:'DESC', limit:25 }), []);
  const actions = useMemo(()=> (
    <AddButton onClick={()=>setOpen(true)} title={t('crm.task.actions.addTask')}>
      {t('crm.task.actions.addTask')}
    </AddButton>
  ), [t]);

  const footer = useMemo(()=> (
    <>
      <Modal.Button onClick={()=>setOpen(false)}>{t('common.cancel')}</Modal.Button>
      <Modal.Button variant="primary" form="task-create-form" disabled={saving}>
        {saving ? t('common.saving') : t('common.save')}
      </Modal.Button>
    </>
  ), [t, saving]);

  return (
    <>
      <ListPage
        ref={listRef}
        title={t('crm.task.titles.tasks')}
        source="tasks"
        columns={columns}
        defaultQuery={defaultQuery}
        actions={actions}
        columnWidths={colWidths}
        onColumnResize={onColumnResize}
        columnOrder={colOrder}
        onColumnOrderChange={onColumnOrderChange}
        ToolbarComponent={(props)=> (
          <FilterToolbar
            {...props}
            controls={[
              { type:'search', key:'search', placeholder: t('crm.task.filters.searchPlaceholder'), debounce:400 },
              { type:'select', key:'status', label:t('crm.task.fields.status'), options:[
                { value:'', label:t('common.all') },
                ...TASK_STATUS.map(v=>({ value:v, label:t(`crm.task.enums.status.${v}`) }))
              ]},
              { type:'dateRange', key:'range', fromKey:'from', toKey:'to', label:t('crm.task.filters.range') },
            ]}
          />
        )}
      />

      <Modal open={open} onClose={()=>setOpen(false)} title={t('crm.task.dialogs.newTask')} size="lg" footer={footer}>
        <TaskForm
          id="task-create-form"
          loading={saving}
          withButtons={false}
          lookups={lookups}
          currentUserId={currentUser?.id}
          onCancel={()=>setOpen(false)}
          onSubmit={async (values)=>{
            setSaving(true);
            try{
              await createTask(values).unwrap();
              setOpen(false);
              listRef.current?.refetch?.();
            } finally { setSaving(false); }
          }}
        />
      </Modal>
    </>
  );
}