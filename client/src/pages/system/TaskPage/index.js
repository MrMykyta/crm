// src/pages/crm/tasks/index.jsx
import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

import {
  Workspace,
  useWorkspaceData,
} from '../../../components/workspace';
import AddButton from '../../../components/buttons/AddButton/AddButton';
import ConfirmDialog from '../../../components/dialogs/ConfirmDialog';
import LinkCell from '../../../components/cells/LinkCell';
import { SearchField, SelectField } from '../../../components/ui/fields';
import useOpenAsModal from '../../../hooks/useOpenAsModal';

import { TASK_STATUS, formatTaskDate } from '../../../schemas/task.schema';
import {
  PRIORITY_I18N_KEYS,
  PRIORITY_OPTIONS,
  PRIORITY_TONES,
  normalizePriority,
} from '../../../config/priority';

import { useDeleteTaskMutation, useListTasksQuery } from '../../../store/rtk/tasksApi';
import s from './TaskListCells.module.css';
import w from './TaskWorkspace.module.css';

const CLIENT_FILTER_KEYS = new Set(['priority', 'overdueOnly', 'dueTodayOnly', 'myTasks', 'assigneeId']);
const CLOSED_STATUSES = new Set(['done', 'canceled', 'cancelled']);
const TASK_VIEW_ALL = 'all';
const TASK_VIEW_MY = 'my';
const TASK_VIEW_OVERDUE = 'overdue';
const TASK_VIEW_TODAY = 'today';
const TASK_VIEW_IN_PROGRESS = 'inProgress';
const TASK_VIEW_COMPLETED = 'completed';

const TASK_VIEW_OPTIONS = [
  { value: TASK_VIEW_ALL, labelKey: 'crm.task.views.all', queryView: '' },
  { value: TASK_VIEW_MY, labelKey: 'crm.task.views.my', queryView: 'my' },
  { value: TASK_VIEW_OVERDUE, labelKey: 'crm.task.views.overdue', queryView: 'overdue' },
  { value: TASK_VIEW_TODAY, labelKey: 'crm.task.views.today', queryView: 'today' },
  { value: TASK_VIEW_IN_PROGRESS, labelKey: 'crm.task.views.inProgress', queryView: 'in-progress' },
  { value: TASK_VIEW_COMPLETED, labelKey: 'crm.task.views.completed', queryView: 'completed' },
];

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

const getParticipantMeta = (user = {}) => user.TaskUserParticipant || user.taskUserParticipant || {};

const buildTaskProgressSummary = (task = {}) => {
  const summary = task.aggregateSummary;
  const total = Number(summary?.assigneesTotal ?? 0);
  if (total > 0) {
    const done = Math.max(0, Number(summary?.assigneesDone ?? 0));
    const percent = Number.isFinite(Number(summary?.progressPercent))
      ? Number(summary.progressPercent)
      : Math.round((done / total) * 100);
    return {
      total,
      done: Math.min(done, total),
      percent: Math.max(0, Math.min(100, percent)),
    };
  }

  const participants = Array.isArray(task.userParticipants) ? task.userParticipants : [];
  const assignees = participants.filter((user) => getParticipantMeta(user).role === 'assignee');
  if (!assignees.length) return null;
  const fallbackTotal = assignees.length;
  const fallbackDone = assignees.filter((user) => getParticipantMeta(user).memberStatus === 'done').length;
  return {
    total: fallbackTotal,
    done: fallbackDone,
    percent: Math.round((fallbackDone / fallbackTotal) * 100),
  };
};

const sanitizeTasksQuery = (query = {}) => Object.fromEntries(
  Object.entries(query).filter(([key, value]) => !CLIENT_FILTER_KEYS.has(key) && value !== undefined && value !== '')
);

const getTaskViewFromSearch = (search = '') => {
  const view = new URLSearchParams(search).get('view');
  if (view === 'my') return TASK_VIEW_MY;
  if (view === 'overdue') return TASK_VIEW_OVERDUE;
  if (view === 'today') return TASK_VIEW_TODAY;
  if (view === 'in-progress') return TASK_VIEW_IN_PROGRESS;
  if (view === 'completed') return TASK_VIEW_COMPLETED;
  return TASK_VIEW_ALL;
};

// Компонент TasksPage: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function TasksPage(){
  const listRef = useRef(null);
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const openAsModal = useOpenAsModal();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const defaultQuery = useMemo(()=>({ sort:'createdAt', dir:'DESC', limit:25 }), []);
  const [query, setQuery] = useState(defaultQuery);

  // lookups (users/departments/contacts/counterparties/deals) и текущий пользователь
  const members = useSelector((s) => s.bootstrap?.companyUsers || []);
  const currentUserId = useSelector((s) => s.auth?.currentUser?.id ? String(s.auth.currentUser.id) : '');
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

  const activeTaskView = useMemo(() => getTaskViewFromSearch(location.search), [location.search]);

  useEffect(() => {
    setQuery((prev) => {
      const next = {
        ...prev,
        page: 1,
        overdueOnly: undefined,
        dueTodayOnly: undefined,
        myTasks: undefined,
      };

      if (prev.status === 'in_progress' || prev.status === 'done') {
        next.status = undefined;
      }

      if (activeTaskView === TASK_VIEW_MY && currentUserId) next.myTasks = true;
      if (activeTaskView === TASK_VIEW_OVERDUE) next.overdueOnly = true;
      if (activeTaskView === TASK_VIEW_TODAY) next.dueTodayOnly = true;
      if (activeTaskView === TASK_VIEW_IN_PROGRESS) next.status = 'in_progress';
      if (activeTaskView === TASK_VIEW_COMPLETED) next.status = 'done';

      return next;
    });
  }, [activeTaskView, currentUserId]);

  const hasClientFilter = Boolean(
    query.priority
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
      if (query.priority && normalizePriority(task.priority) !== Number(query.priority)) return false;
      if (query.overdueOnly && !isTaskOverdue(task, now)) return false;
      if (query.dueTodayOnly && !isTaskDueToday(task, now)) return false;
      if (query.myTasks && currentUserId && !getTaskAssigneeIds(task).includes(currentUserId)) return false;
      if (query.assigneeId && !getTaskAssigneeIds(task).includes(String(query.assigneeId))) return false;
      return true;
    });
  }, [currentUserId, loadedTasks, query.assigneeId, query.dueTodayOnly, query.myTasks, query.overdueOnly, query.priority]);

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
    || query.priority
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

  const resetAllFilters = useCallback(() => {
    setQuery(defaultQuery);
    if (location.search) navigate('/main/tasks', { replace: true });
  }, [defaultQuery, location.search, navigate]);

  const selectTaskView = useCallback((view) => {
    const option = TASK_VIEW_OPTIONS.find((item) => item.value === view) || TASK_VIEW_OPTIONS[0];
    navigate(option.queryView ? `/main/tasks?view=${option.queryView}` : '/main/tasks');
  }, [navigate]);

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
      key: 'progress',
      title: t('crm.task.fields.progress'),
      width: 132,
      render: (r) => {
        const progress = buildTaskProgressSummary(r);
        if (!progress || !progress.total) return '—';
        return (
          <div
            className={s.progressCell}
            title={`${progress.done} / ${progress.total} · ${progress.percent}%`}
          >
            <div className={s.progressCellTop}>
              <strong>{progress.done} / {progress.total}</strong>
              <span>{progress.percent}%</span>
            </div>
            <div className={s.progressMiniTrack} aria-hidden="true">
              <span style={{ width: `${progress.percent}%` }} />
            </div>
          </div>
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
        const value = normalizePriority(r.priority);
        const tone = PRIORITY_TONES[value] || 'info';
        return (
          <span className={`${s.priorityChip} ${s[`priority_${tone}`] || ''}`}>
            <span className={s.priorityNumber}>{value}</span>
            <span className={s.priorityValue}>{t(PRIORITY_I18N_KEYS[value])}</span>
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
      key: 'priority',
      label: t('crm.task.filters.priority'),
      control: (
        <SelectField
          value={query.priority || ''}
          onValueChange={(value) => updateFilter('priority', value)}
          options={[
            { value: '', label: t('priority.all') },
            ...PRIORITY_OPTIONS.map((option) => ({
              value: String(option.value),
              label: `${option.value} · ${t(option.labelKey)}`,
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
      key: 'taskView',
      label: t('crm.task.views.label'),
      control: (
        <SelectField
          value={activeTaskView}
          onValueChange={selectTaskView}
          options={TASK_VIEW_OPTIONS.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
          size="sm"
          fullWidth={false}
        />
      ),
    },
  ], [
    activeTaskView,
    memberOptions,
    query.assigneeId,
    query.priority,
    query.search,
    query.status,
    query.visibility,
    selectTaskView,
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
    <AddButton onClick={()=>navigate('/main/tasks/new')} title={t('crm.task.addTask')}>
      {t('crm.task.addTask')}
    </AddButton>
  ), [navigate, t]);

  const handleWorkspaceClickCapture = useCallback((event) => {
    const button = event.target?.closest?.('button');
    if (!button || typeof button.className !== 'string') return;
    if (!button.className.includes('resetColumnsButton') || button.className.includes('columnsButton')) return;
    resetAllFilters();
  }, [resetAllFilters]);

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

      <div onClickCapture={handleWorkspaceClickCapture}>
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
      </div>

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
