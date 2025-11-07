// src/schemas/task.schema.js

// минимально необходимое
export const TASK_STATUS = ['todo', 'in_progress', 'done', 'blocked', 'canceled'];

// helper: достать участников компании из localStorage и превратить в options
function getCompanyMemberOptions() {
  const raw = localStorage.getItem('companyMembers');
  const members = raw ? JSON.parse(raw) : [];
  return members.map((m) => ({
    value: m.userId || m.id,
    label:
      m.name ||
      `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() ||
      m.email ||
      '—',
  }));
}

// helpers для дат
function toLocalInputDT(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputDT(s) {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function toFormTask(d = {}) {
  const assigneeIds = Array.isArray(d.userParticipants)
    ? d.userParticipants
        .filter((u) => u?.TaskUserParticipant?.role === 'assignee')
        .map((u) => u.id)
    : Array.isArray(d.assigneeIds)
    ? d.assigneeIds
    : [];

  const watcherIds = Array.isArray(d.userParticipants)
    ? d.userParticipants
        .filter((u) => u?.TaskUserParticipant?.role === 'watcher')
        .map((u) => u.id)
    : Array.isArray(d.watcherIds)
    ? d.watcherIds
    : [];

  const departmentIds = Array.isArray(d.departmentParticipants)
    ? d.departmentParticipants.map((x) => x.id)
    : Array.isArray(d.departmentIds)
    ? d.departmentIds
    : [];

  const contactIds = Array.isArray(d.contacts)
    ? d.contacts.map((c) => c.id)
    : Array.isArray(d.contactIds)
    ? d.contactIds
    : [];

  return {
    id: d.id ?? null,
    title: d.title ?? '',
    category: d.category ?? '',
    description: d.description ?? '',
    status: d.status ?? 'todo',
    priority: Number.isFinite(d.priority) ? d.priority : 50,

    startAt: toLocalInputDT(d.startAt),
    endAt: toLocalInputDT(d.endAt),
    timezone:
      d.timezone ??
      Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone ??
      'Europe/Warsaw',

    assigneeIds,
    watcherIds,
    departmentIds,
    contactIds,

    counterpartyId: d.counterpartyId ?? d.counterparty?.id ?? null,
    dealId: d.dealId ?? d.deal?.id ?? null,

    statusAggregate: !!d.statusAggregate,
  };
}

export function toApiTask(values = {}) {
  const hasAssignees =
    Array.isArray(values.assigneeIds) && values.assigneeIds.length > 0;
  const hasDepartments =
    Array.isArray(values.departmentIds) && values.departmentIds.length > 0;
  const hasWatchers =
    Array.isArray(values.watcherIds) && values.watcherIds.length > 0;

  return {
    title: (values.title || '').trim(),
    category: values.category?.trim() || null,
    description: values.description?.trim() || null,
    status: TASK_STATUS.includes(values.status) ? values.status : 'todo',
    priority: Math.max(
      0,
      Math.min(100, parseInt(values.priority ?? 50, 10) || 0)
    ),

    startAt: fromLocalInputDT(values.startAt),
    endAt: fromLocalInputDT(values.endAt),
    timezone: values.timezone || null,

    participantMode: hasAssignees || hasDepartments ? 'lists' : 'none',
    watcherMode: hasWatchers ? 'lists' : 'none',

    assigneeIds: Array.isArray(values.assigneeIds)
      ? values.assigneeIds
      : [],
    departmentIds: Array.isArray(values.departmentIds)
      ? values.departmentIds
      : [],
    watcherIds: Array.isArray(values.watcherIds)
      ? values.watcherIds
      : [],
    contactIds: Array.isArray(values.contactIds)
      ? values.contactIds
      : [],

    counterpartyId: values.counterpartyId || null,
    dealId: values.dealId || null,
    statusAggregate: !!values.statusAggregate,
  };
}

export function buildTaskSchema(i18n) {
  const t = i18n?.t?.bind(i18n) ?? ((x) => x);
  const memberOptions = getCompanyMemberOptions();
  const statusOptions = TASK_STATUS.map((v) => ({
    value: v,
    labelKey: `crm.task.enums.status.${v}`,
  }));

  return [
    { kind: 'section', title: 'crm.task.sections.basic' },
    {
      name: 'title',
      label: 'crm.task.fields.title',
      type: 'text',
      float: true,
      max: 300,
      full: true,
      placeholder: 'crm.task.placeholders.title',
    },
    {
      name: 'category',
      label: 'crm.task.fields.category',
      type: 'text',
      float: true,
      max: 64,
    },
    {
      name: 'status',
      label: 'crm.task.fields.status',
      type: 'select',
      float: true,
      options: statusOptions.map((o) => ({
        value: o.value,
        labelKey: o.labelKey,
      })),
    },
    {
      name: 'priority',
      label: 'crm.task.fields.priority',
      type: 'text',
      float: true,
      inputMode: 'numeric',
    },

    { kind: 'section', title: 'crm.task.sections.schedule' },
    {
      name: 'startAt',
      label: 'crm.task.fields.startAt',
      type: 'datetime',
      float: true,
    },
    {
      name: 'endAt',
      label: 'crm.task.fields.endAt',
      type: 'datetime',
      float: true,
    },

    { kind: 'section', title: 'crm.task.sections.description' },
    {
      name: 'description',
      label: 'crm.task.fields.description',
      type: 'textarea',
      float: true,
      rows: 4,
      max: 4000,
      full: true,
    },

    { kind: 'section', title: 'crm.task.sections.participants' },
    {
      name: 'assigneeIds',
      type: 'dropdown-multiselect',
      label: 'crm.task.fields.assignees',
      options: () => memberOptions,
      placeholder: 'common.noneSelected',
      selectAllLabel: 'common.selectAll',
      clearLabel: 'common.clear',
      maxPreview: 3,
      full: true,
    },
    {
      name: 'watcherIds',
      type: 'dropdown-multiselect',
      label: 'crm.task.fields.watchers',
      options: (values) => {
        const me = JSON.parse(localStorage.getItem('user') || 'null')?.id;
        const ass = new Set(values?.assigneeIds || []);
        return memberOptions.filter(
          (o) => !ass.has(o.value) && o.value !== me
        );
      },
      placeholder: 'common.noneSelected',
      selectAllLabel: 'common.selectAll',
      clearLabel: 'common.clear',
      maxPreview: 3,
      full: true,
    },

    { kind: 'section', title: 'crm.task.sections.links' },
    {
      name: 'counterpartyId',
      label: 'crm.task.fields.counterparty',
      type: 'select',
      float: true,
      options: [],
    },
    {
      name: 'dealId',
      label: 'crm.task.fields.deal',
      type: 'select',
      float: true,
      options: [],
    },

    { kind: 'section', title: 'crm.task.sections.contacts' },
    {
      name: 'contactIds',
      label: 'crm.task.fields.contacts',
      type: 'dropdown-multiselect',
      options: () => [],
      full: true,
    },

    { kind: 'section', title: 'crm.task.sections.logic' },
    {
      name: 'statusAggregate',
      label: 'crm.task.fields.statusAggregate',
      type: 'checkbox',
      hint: 'crm.task.hints.statusAggregate',
    },
  ];
}