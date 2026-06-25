// src/pages/crm/tasks/index.jsx
import React, { useMemo, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

import {
  Workspace,
  useWorkspaceData,
} from '../../../components/workspace';
import Modal from '../../../components/Modal';
import AddButton from '../../../components/buttons/AddButton/AddButton';
import ConfirmDialog from '../../../components/dialogs/ConfirmDialog';
import LinkCell from '../../../components/cells/LinkCell';
import { SearchField, SelectField } from '../../../components/ui/fields';
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

const getVisibilityValue = (value) => {
  const normalized = String(value || 'company').trim().toLowerCase();
  return ['private', 'company', 'department'].includes(normalized) ? normalized : 'company';
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
  const defaultQuery = useMemo(()=>({ sort:'createdAt', dir:'DESC', limit:25 }), []);
  const [query, setQuery] = useState(defaultQuery);

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

  const hasClientFilter = Boolean(
    query.priorityBucket
    || query.overdueOnly
    || query.dueTodayOnly
    || query.myTasks
    || query.assigneeId
  );

  const apiQuery = useMemo(() => ({
    ...sanitizeTasksQuery(query),
    ...(hasClientFilter ? { page: 1, limit: 100 } : {}),
  }), [hasClientFilter, query]);
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
    || query.visibility
    || query.from
    || query.to
    || query.priorityBucket
    || query.overdueOnly
    || query.dueTodayOnly
    || query.myTasks
    || query.assigneeId
  );

  const serverTotal = Number(tasksData?.total ?? loadedTasks.length ?? 0);
  const workspaceRows = hasClientFilter ? filteredTasks : loadedTasks;
  const workspaceTotal = hasClientFilter ? filteredTasks.length : serverTotal;
  const workspaceBadge = hasAnyFilter && workspaceTotal !== serverTotal
    ? t('crm.task.workspace.filteredCount', { count: workspaceTotal, total: serverTotal })
    : t('crm.task.workspace.count', { count: workspaceTotal });

  const workspaceData = useWorkspaceData({
    externalData: workspaceRows,
    externalMeta: {
      total: workspaceTotal,
      page: query.page || defaultQuery.page || 1,
      limit: query.limit || defaultQuery.limit,
    },
    externalLoading: tasksLoading,
    externalError: tasksError,
    onExternalRefetch: refetchTasks,
    query,
    onQueryChange: setQuery,
    defaultQuery,
    clientPaginate: hasClientFilter,
  });

  const updateFilter = useCallback((key, value) => {
    setQuery((prev) => ({
      ...prev,
      [key]: value || undefined,
      page: 1,
    }));
  }, []);

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
    {
      key: 'visibility',
      title: t('visibility.label'),
      sortable: true,
      width: 170,
      defaultVisible: false,
      category: 'technical',
      render: (r) => {
        const visibility = getVisibilityValue(r.visibility);
        const departmentName = r.visibilityDepartment?.name
          || r.department?.name
          || r.visibilityDepartmentName
          || r.visibility_department_name
          || r.visibilityDepartmentId
          || r.visibility_department_id
          || '';
        const label = visibility === 'department' && departmentName
          ? `${t('visibility.department')} · ${departmentName}`
          : t(`visibility.${visibility}`, t('visibility.company'));
        return (
          <span
            className={`${s.visibilityChip} ${s[`visibility_${visibility}`]}`}
            title={t(`visibility.tooltip.${visibility}`)}
          >
            {label}
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

  const workspaceColumns = useMemo(() => [
    ...columns.map((column) => ({
      ...column,
      fallbackLabel: column.title,
      minWidth: Math.max(110, Math.min(Number(column.width) || 180, 180)),
      maxWidth: 560,
      category: column.category || 'core',
      required: column.key === 'title',
    })),
    {
      key: 'actions',
      fallbackLabel: t('common.actions', 'Actions'),
      width: 170,
      minWidth: 150,
      maxWidth: 220,
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
      key: 'search',
      kind: 'search',
      label: t('common.search', 'Search'),
      control: (
        <SearchField
          value={query.search || ''}
          onValueChange={(value) => updateFilter('search', value)}
          placeholder={t('crm.task.searchPlaceholder')}
          size="sm"
          clearable
          fullWidth={false}
        />
      ),
    },
    {
      key: 'status',
      label: t('crm.task.fields.status'),
      control: (
        <SelectField
          value={query.status || ''}
          onValueChange={(value) => updateFilter('status', value)}
          options={[
            { value: '', label: t('crm.allStatuses', 'All statuses') },
            ...TASK_STATUS.map((value) => ({ value, label: t(`crm.task.enums.status.${value}`) })),
          ]}
          size="sm"
          fullWidth={false}
        />
      ),
    },
    {
      key: 'visibility',
      label: t('visibility.filterLabel'),
      control: (
        <SelectField
          value={query.visibility || ''}
          onValueChange={(value) => updateFilter('visibility', value)}
          options={[
            { value: '', label: t('visibility.all') },
            { value: 'private', label: t('visibility.private') },
            { value: 'company', label: t('visibility.company') },
            { value: 'department', label: t('visibility.department') },
          ]}
          size="sm"
          fullWidth={false}
        />
      ),
    },
    {
      key: 'priorityBucket',
      label: t('crm.task.filters.priority'),
      control: (
        <SelectField
          value={query.priorityBucket || ''}
          onValueChange={(value) => updateFilter('priorityBucket', value)}
          options={[
            { value: '', label: t('crm.task.filters.allPriorities') },
            ...['low', 'normal', 'high', 'urgent'].map((value) => ({
              value,
              label: t(`crm.task.priorityBuckets.${value}`),
            })),
          ]}
          size="sm"
          fullWidth={false}
        />
      ),
    },
    ...(memberOptions.length > 1 ? [{
      key: 'assigneeId',
      label: t('crm.task.filters.assignee'),
      control: (
        <SelectField
          value={query.assigneeId || ''}
          onValueChange={(value) => updateFilter('assigneeId', value)}
          options={memberOptions}
          size="sm"
          fullWidth={false}
        />
      ),
    }] : []),
    {
      key: 'quickFilters',
      kind: 'quick',
      control: (
        <div className={w.quickFilters}>
          <button
            type="button"
            className={`${w.filterPill} ${query.overdueOnly ? w.filterPillActive : ''}`}
            onClick={() => updateFilter('overdueOnly', query.overdueOnly ? undefined : true)}
            title={t('crm.task.filters.overdueOnly')}
          >
            {t('crm.task.filters.overdueShort', 'Просроченные')}
          </button>
          <button
            type="button"
            className={`${w.filterPill} ${query.dueTodayOnly ? w.filterPillActive : ''}`}
            onClick={() => updateFilter('dueTodayOnly', query.dueTodayOnly ? undefined : true)}
            title={t('crm.task.filters.dueToday')}
          >
            {t('crm.task.filters.todayShort', 'Сегодня')}
          </button>
          {currentUserId ? (
            <button
              type="button"
              className={`${w.filterPill} ${query.myTasks ? w.filterPillActive : ''}`}
              onClick={() => updateFilter('myTasks', query.myTasks ? undefined : true)}
              title={t('crm.task.filters.myTasks')}
            >
              {t('crm.task.filters.myShort', 'Мои')}
            </button>
          ) : null}
          <button
            type="button"
            className={w.resetButton}
            onClick={resetClientFilters}
            title={t('crm.task.filters.resetClient')}
          >
            {t('common.reset', 'Сбросить')}
          </button>
        </div>
      ),
    },
  ], [
    currentUserId,
    memberOptions,
    query.assigneeId,
    query.dueTodayOnly,
    query.myTasks,
    query.overdueOnly,
    query.priorityBucket,
    query.search,
    query.status,
    query.visibility,
    resetClientFilters,
    t,
    updateFilter,
  ]);

  const workspaceLabels = useMemo(() => ({
    loading: t('common.loading', 'Loading'),
    errorTitle: t('crm.task.states.errorTitle'),
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
      <section className={w.kpiGrid} aria-label={t('crm.task.kpi.title')}>
        {kpis.map((item) => (
          <article key={item.key} className={`${w.kpiCard} ${w[`kpi_${item.tone}`]}`}>
            <span className={w.kpiLabel}>{t(`crm.task.kpi.${item.key}`)}</span>
            <strong>{item.value}</strong>
            <span className={w.kpiHint}>{t(`crm.task.kpi.${item.key}Hint`)}</span>
          </article>
        ))}
      </section>

      <Workspace
        ref={listRef}
        title={t('crm.task.title')}
        subtitle={t('crm.task.workspace.subtitle')}
        badge={workspaceBadge}
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
        storageKey="workspace:crm.tasks.columns.v1"
        sortKey={workspaceData.query.sort}
        sortDir={workspaceData.query.dir}
        onSort={workspaceData.setSort}
        emptyState={{
          title: t(hasAnyFilter ? 'crm.task.states.emptyFilteredTitle' : 'crm.task.states.emptyTitle'),
          description: t(hasAnyFilter ? 'crm.task.states.emptyFilteredText' : 'crm.task.states.emptyText'),
        }}
        errorState={{
          title: t('crm.task.states.errorTitle'),
          description: String(tasksError?.data?.message || tasksError?.data?.error || tasksError?.message || t('crm.task.states.errorText')),
          retryLabel: t('list.refresh', 'Refresh'),
        }}
        labels={workspaceLabels}
        pagination={workspaceData.pagination}
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
