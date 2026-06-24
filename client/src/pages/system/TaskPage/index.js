// src/pages/crm/tasks/index.jsx
import React, { useMemo, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

import ListPage from '../../../components/data/ListPage';
import Modal from '../../../components/Modal';
import AddButton from '../../../components/buttons/AddButton/AddButton';
import ConfirmDialog from '../../../components/dialogs/ConfirmDialog';
import LinkCell from '../../../components/cells/LinkCell';
import FilterToolbar from '../../../components/filters/FilterToolbar';
import useGridPrefs from '../../../hooks/useGridPrefs';
import useOpenAsModal from '../../../hooks/useOpenAsModal';

import { TASK_STATUS, formatTaskDate } from '../../../schemas/task.schema';
import { buildTaskLookups } from '../../../utils/taskLookups';

import TaskForm from './TaskForm';
import { useCreateTaskMutation, useDeleteTaskMutation, useListTasksQuery } from '../../../store/rtk/tasksApi';
import s from './TaskListCells.module.css';
import w from './TaskWorkspace.module.css';

const CLIENT_FILTER_KEYS = new Set(['priorityBucket', 'overdueOnly', 'dueTodayOnly', 'myTasks', 'assigneeId']);
const CLOSED_STATUSES = new Set(['done', 'canceled', 'cancelled']);

const normalizeStatus = (value) => String(value || 'todo').trim().toLowerCase();

const getTaskDueDate = (task = {}) => {
  const raw = task.endAt ?? task.plannedEndAt ?? task.dueDate ?? task.startAt ?? task.plannedStartAt ?? null;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isSameLocalDay = (a, b) => Boolean(a && b)
  && a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate();

const isTaskClosed = (task) => CLOSED_STATUSES.has(normalizeStatus(task?.status));

const isTaskOverdue = (task, now = new Date()) => {
  const due = getTaskDueDate(task);
  if (!due || isTaskClosed(task)) return false;
  return due.getTime() < now.getTime();
};

const isTaskDueToday = (task, now = new Date()) => {
  const due = getTaskDueDate(task);
  if (!due || isTaskClosed(task)) return false;
  return isSameLocalDay(due, now);
};

const getPriorityBucket = (priority) => {
  const value = Math.max(0, Math.min(100, Number(priority ?? 50) || 0));
  if (value <= 24) return 'low';
  if (value <= 49) return 'normal';
  if (value <= 74) return 'high';
  return 'urgent';
};

const getTaskAssigneeIds = (task = {}) => {
  const participants = Array.isArray(task.userParticipants) ? task.userParticipants : [];
  return participants
    .filter((user) => user?.TaskUserParticipant?.role === 'assignee')
    .map((user) => String(user.id || user.userId || ''))
    .filter(Boolean);
};

const sanitizeTasksQuery = (query = {}) => Object.fromEntries(
  Object.entries(query).filter(([key, value]) => !CLIENT_FILTER_KEYS.has(key) && value !== undefined && value !== '')
);

// Компонент TasksPage: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function TasksPage(){
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const openAsModal = useOpenAsModal();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const defaultQuery = useMemo(()=>({ sort:'createdAt', dir:'DESC', limit:100 }), []);
  const [query, setQuery] = useState(defaultQuery);

  const {
    colWidths,
    colOrder,
    colVisibility,
    savedViews,
    activeViewId,
    onColumnResize,
    onColumnOrderChange,
    onColumnVisibilityChange,
    onSavedViewsChange,
    onActiveViewChange,
    resetGridPrefs,
  } = useGridPrefs('crm.tasks');

  // lookups (users/departments/contacts/counterparties/deals) и текущий пользователь
  const members = useSelector((s) => s.bootstrap?.companyUsers || []);
  const currentUser = useSelector((s) => s.auth?.currentUser || null);
  const lookups = useMemo(() => buildTaskLookups({ members }), [members]);
  const currentUserId = currentUser?.id ? String(currentUser.id) : '';
  const memberOptions = useMemo(() => {
    const options = (Array.isArray(members) ? members : [])
      .map((member) => {
        const id = member.userId || member.id;
        if (!id) return null;
        const name = member.name || [member.firstName, member.lastName].filter(Boolean).join(' ').trim() || member.email || id;
        return { value: String(id), label: name };
      })
      .filter(Boolean);
    return [{ value: '', label: t('crm.task.filters.allAssignees') }, ...options];
  }, [members, t]);

  const apiQuery = useMemo(() => sanitizeTasksQuery(query), [query]);
  const {
    data: tasksData,
    isFetching: tasksLoading,
    error: tasksError,
    refetch: refetchTasks,
  } = useListTasksQuery(apiQuery);

  const loadedTasks = useMemo(() => {
    if (Array.isArray(tasksData)) return tasksData;
    if (Array.isArray(tasksData?.items)) return tasksData.items;
    if (Array.isArray(tasksData?.data)) return tasksData.data;
    return [];
  }, [tasksData]);

  const filteredTasks = useMemo(() => {
    const now = new Date();
    return loadedTasks.filter((task) => {
      if (query.priorityBucket && getPriorityBucket(task.priority) !== query.priorityBucket) return false;
      if (query.overdueOnly && !isTaskOverdue(task, now)) return false;
      if (query.dueTodayOnly && !isTaskDueToday(task, now)) return false;
      if (query.myTasks && currentUserId && !getTaskAssigneeIds(task).includes(currentUserId)) return false;
      if (query.assigneeId && !getTaskAssigneeIds(task).includes(String(query.assigneeId))) return false;
      return true;
    });
  }, [currentUserId, loadedTasks, query.assigneeId, query.dueTodayOnly, query.myTasks, query.overdueOnly, query.priorityBucket]);

  const kpis = useMemo(() => {
    const now = new Date();
    return [
      { key: 'total', value: loadedTasks.length, tone: 'neutral' },
      { key: 'overdue', value: loadedTasks.filter((task) => isTaskOverdue(task, now)).length, tone: 'danger' },
      { key: 'dueToday', value: loadedTasks.filter((task) => isTaskDueToday(task, now)).length, tone: 'warning' },
      { key: 'inProgress', value: loadedTasks.filter((task) => normalizeStatus(task.status) === 'in_progress').length, tone: 'info' },
      { key: 'completed', value: loadedTasks.filter((task) => normalizeStatus(task.status) === 'done').length, tone: 'success' },
    ];
  }, [loadedTasks]);

  const hasAnyFilter = Boolean(
    query.search
    || query.status
    || query.from
    || query.to
    || query.priorityBucket
    || query.overdueOnly
    || query.dueTodayOnly
    || query.myTasks
    || query.assigneeId
  );

  const resetClientFilters = useCallback(() => {
    setQuery((prev) => {
      const next = { ...prev, page: 1 };
      CLIENT_FILTER_KEYS.forEach((key) => {
        delete next[key];
      });
      return next;
    });
  }, []);

  const [createTask] = useCreateTaskMutation();
  const [deleteTask, { isLoading: deletingTask }] = useDeleteTaskMutation();

  const openDetail = useCallback((id)=>{
    const suffix = openAsModal ? '?modal=1' : '';
    navigate(`/main/tasks/${id}${suffix}`);
  }, [navigate, openAsModal]);

  const columns = useMemo(()=>[
    {
      key:'title', title:t('crm.task.fields.title'), sortable:true, width:360,
            // render: описывает рендер соответствующего блока UI.
render:(r)=> (
        <LinkCell
          primary={r.title}
          secondary={r.category || undefined}
          onClick={()=>openDetail(r.id)}
          ariaLabel={t('crm.task.actions.openTask', { name: r.title })}
        />
      )
    },
    {
      key:'status',
      title:t('crm.task.fields.status'),
      sortable:true,
      width:160,
            // render: описывает рендер соответствующего блока UI.
render:(r)=> {
        const status = normalizeStatus(r.status);
        return (
          <span className={`${s.statusChip} ${s[`status_${status}`] || s.status_todo}`}>
            <span className={s.chipDot} />
            {t(`crm.task.enums.status.${status}`, status)}
          </span>
        );
      },
    },
    {
      key:'priority',
      title:t('crm.task.fields.priority'),
      sortable:true,
      width:150,
            // render: описывает рендер соответствующего блока UI.
render:(r)=> {
        const bucket = getPriorityBucket(r.priority);
        return (
          <span className={`${s.priorityChip} ${s[`priority_${bucket}`]}`}>
            {t(`crm.task.priorityBuckets.${bucket}`)}
            <span className={s.priorityValue}>{Number(r.priority ?? 50)}</span>
          </span>
        );
      },
    },
    { key:'schedule', title:t('crm.task.fields.schedule'), width:260,     // render : render.
// render: описывает рендер соответствующего блока UI.
render:(r)=>{
        const locale = i18n.language === 'ua' ? 'uk-UA' : i18n.language;
        const start = formatTaskDate(r.startAt, r.plannedStartHasTime, locale);
        const end = formatTaskDate(r.endAt, r.plannedEndHasTime, locale);
        if (!r.startAt && !r.endAt) return '—';
        if (r.startAt && r.endAt) return `${start} — ${end}`;
        return r.startAt ? start : end;
      }
    },
    {
      key: 'counterparty',
      title: t('crm.task.fields.counterparty'),
      width: 220,
            // render: описывает рендер соответствующего блока UI.
render: (r) => {
        const cpId = r.counterparty?.id || r.counterpartyId || null;
        const cpName = r.counterparty?.shortName || r.counterparty?.fullName || null;
        if (!cpId) return '—';
        return (
          <button
            type="button"
            className={s.inlineLink}
            onClick={() => navigate(`/main/counterparties/${cpId}`)}
          >
            {cpName || cpId}
          </button>
        );
      },
    },
    {
      key: 'contacts',
      title: t('crm.task.fields.contacts'),
      width: 280,
            // render: описывает рендер соответствующего блока UI.
render: (r) => {
        const contacts = Array.isArray(r.contacts) ? r.contacts : [];
        if (!contacts.length) return '—';
        const visible = contacts.slice(0, 2);
        return (
          <div className={s.inlineLinksWrap}>
            {visible.map((contact) => {
              const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim()
                || contact.displayName
                || contact.email
                || contact.id;

              return (
                <button
                  key={contact.id}
                  type="button"
                  className={s.inlineLink}
                  onClick={() => navigate(`/main/contacts/${contact.id}`)}
                >
                  {contactName}
                </button>
              );
            })}
            {contacts.length > 2 ? <span className={s.moreHint}>+{contacts.length - 2}</span> : null}
          </div>
        );
      },
    },
    { key:'assignees', title:t('crm.task.fields.assignees'), width:200,     // render : render.
// render: описывает рендер соответствующего блока UI.
render:(r)=>{
        const users = Array.isArray(r.userParticipants) ? r.userParticipants.filter(u=>u?.TaskUserParticipant?.role==='assignee') : [];
        if (!users.length) return '—';
        const names = users
          .map(u=> `${u.firstName||''} ${u.lastName||''}`.trim())
          .filter(Boolean);
        return names.slice(0,2).join(', ') + (names.length>2 ? ` +${names.length-2}` : '');
      }
    },
  ], [t, openDetail, navigate, i18n.language]);

  const requestDelete = useCallback((task) => {
    setDeleteTarget(task);
    setDeleteError('');
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget?.id || deletingTask) return;
    setDeleteError('');
    try {
      await deleteTask(deleteTarget.id).unwrap();
      setDeleteTarget(null);
      listRef.current?.refetch?.();
    } catch (error) {
      setDeleteError(
        error?.data?.message
        || error?.data?.error
        || error?.message
        || t('crm.task.messages.deleteFailed')
      );
    }
  }, [deleteTarget?.id, deleteTask, deletingTask, t]);

  const rowActions = useCallback((row) => (
    <div className={s.rowActions}>
      <button type="button" className={s.actionBtn} onClick={() => openDetail(row.id)}>
        {t('crm.task.actions.open')}
      </button>
      <button
        type="button"
        className={`${s.actionBtn} ${s.dangerBtn}`}
        disabled={deletingTask}
        onClick={() => requestDelete(row)}
      >
        {t('crm.task.actions.delete')}
      </button>
    </div>
  ), [deletingTask, openDetail, requestDelete, t]);

  const actions = useMemo(()=> (
    <AddButton onClick={()=>setOpen(true)} title={t('crm.task.addTask')}>
      {t('crm.task.addTask')}
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
    <div className={w.workspace}>
      <section className={w.header}>
        <div className={w.headerCopy}>
          <span className={w.eyebrow}>{t('crm.task.workspace.eyebrow')}</span>
          <div className={w.titleRow}>
            <h1>{t('crm.task.title')}</h1>
            <span className={w.countBadge}>
              {t('crm.task.workspace.count', { count: tasksData?.total ?? loadedTasks.length })}
            </span>
          </div>
          <p>{t('crm.task.workspace.subtitle')}</p>
        </div>
        <div className={w.headerActions}>
          {actions}
        </div>
      </section>

      <section className={w.kpiGrid} aria-label={t('crm.task.kpi.title')}>
        {kpis.map((item) => (
          <article key={item.key} className={`${w.kpiCard} ${w[`kpi_${item.tone}`]}`}>
            <span className={w.kpiLabel}>{t(`crm.task.kpi.${item.key}`)}</span>
            <strong>{item.value}</strong>
            <span className={w.kpiHint}>{t(`crm.task.kpi.${item.key}Hint`)}</span>
          </article>
        ))}
      </section>

      {tasksError ? (
        <div className={w.errorState}>
          <strong>{t('crm.task.states.errorTitle')}</strong>
          <span>{String(tasksError?.data?.message || tasksError?.data?.error || tasksError?.message || t('crm.task.states.errorText'))}</span>
        </div>
      ) : null}

      <ListPage
        ref={listRef}
        title={t('crm.task.title')}
        source="tasks"
        externalData={filteredTasks}
        externalMeta={{ total: filteredTasks.length, page: query.page || 1, limit: query.limit || defaultQuery.limit }}
        externalLoading={tasksLoading}
        externalError={tasksError}
        onExternalRefetch={refetchTasks}
        query={query}
        onQueryChange={setQuery}
        columns={columns}
        defaultQuery={defaultQuery}
        actions={null}
        className={w.listPage}
        cardClassName={w.listCard}
        toolbarShellClassName={w.toolbarShell}
        tableRegionClassName={w.tableRegion}
        metaBarClassName={w.metaBar}
        emptyStateContent={(
          <div className={w.emptyState}>
            <strong>{t(hasAnyFilter ? 'crm.task.states.emptyFilteredTitle' : 'crm.task.states.emptyTitle')}</strong>
            <span>{t(hasAnyFilter ? 'crm.task.states.emptyFilteredText' : 'crm.task.states.emptyText')}</span>
          </div>
        )}
        columnWidths={colWidths}
        onColumnResize={onColumnResize}
        columnOrder={colOrder}
        onColumnOrderChange={onColumnOrderChange}
        columnVisibility={colVisibility}
        onColumnVisibilityChange={onColumnVisibilityChange}
        savedViews={savedViews}
        activeViewId={activeViewId}
        onSavedViewsChange={onSavedViewsChange}
        onActiveViewChange={onActiveViewChange}
        onResetColumns={resetGridPrefs}
        rowActions={rowActions}
        rowActionsWidth={160}
        toolbarExtra={(
          <button type="button" className={w.resetButton} onClick={resetClientFilters}>
            {t('crm.task.filters.resetClient')}
          </button>
        )}
        ToolbarComponent={(props)=> (
          <FilterToolbar
            {...props}
            controls={[
              { type:'search', key:'search', placeholder: t('crm.task.searchPlaceholder'), debounce:400 },
              { type:'select', key:'status', label:t('crm.task.fields.status'), options:[
                { value:'', label:t('common.selectAll', t('common.all', 'All')) },
                ...TASK_STATUS.map(v=>({ value:v, label:t(`crm.task.enums.status.${v}`) }))
              ]},
              { type:'select', key:'priorityBucket', label:t('crm.task.filters.priority'), options:[
                { value:'', label:t('crm.task.filters.allPriorities') },
                ...['low', 'normal', 'high', 'urgent'].map((value) => ({
                  value,
                  label: t(`crm.task.priorityBuckets.${value}`),
                })),
              ]},
              ...(memberOptions.length > 1 ? [{ type:'select', key:'assigneeId', label:t('crm.task.filters.assignee'), options: memberOptions }] : []),
              { type:'dateRange', key:'range', fromKey:'from', toKey:'to', label:t('crm.task.filters.range') },
              {
                type: 'custom',
                render: ({ query: toolbarQuery, onChange }) => (
                  <div className={w.quickFilters}>
                    <button
                      type="button"
                      className={`${w.filterPill} ${toolbarQuery.overdueOnly ? w.filterPillActive : ''}`}
                      onClick={() => onChange((prev) => ({ ...prev, overdueOnly: prev.overdueOnly ? undefined : true, page: 1 }))}
                    >
                      {t('crm.task.filters.overdueOnly')}
                    </button>
                    <button
                      type="button"
                      className={`${w.filterPill} ${toolbarQuery.dueTodayOnly ? w.filterPillActive : ''}`}
                      onClick={() => onChange((prev) => ({ ...prev, dueTodayOnly: prev.dueTodayOnly ? undefined : true, page: 1 }))}
                    >
                      {t('crm.task.filters.dueToday')}
                    </button>
                    {currentUserId ? (
                      <button
                        type="button"
                        className={`${w.filterPill} ${toolbarQuery.myTasks ? w.filterPillActive : ''}`}
                        onClick={() => onChange((prev) => ({ ...prev, myTasks: prev.myTasks ? undefined : true, page: 1 }))}
                      >
                        {t('crm.task.filters.myTasks')}
                      </button>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
        )}
      />

      <Modal open={open} onClose={()=>setOpen(false)} title={t('crm.task.newTask')} size="xl" footer={footer}>
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
              refetchTasks();
            } finally { setSaving(false); }
          }}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('crm.task.confirm.deleteTitle')}
        text={(
          <>
            <div>{t('crm.task.confirm.deleteText')}</div>
            {deleteError ? <div className={s.deleteError}>{deleteError}</div> : null}
          </>
        )}
        danger
        loading={deletingTask}
        okText={t('common.delete')}
        cancelText={t('common.cancel')}
        onOk={confirmDelete}
        onCancel={() => {
          if (deletingTask) return;
          setDeleteTarget(null);
          setDeleteError('');
        }}
      />
    </div>
  );
}
