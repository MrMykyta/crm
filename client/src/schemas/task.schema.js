export const TASK_STATUS = ['todo', 'in_progress', 'done', 'blocked', 'canceled'];
export const TASK_VISIBILITY = ['private', 'company', 'department'];

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

// getCompanyMemberOptions: описывает схему валидации и преобразования данных.
function getCompanyMemberOptions(members = []) {
  const list = Array.isArray(members) ? members : [];
  return list.map((m) => ({
    value: m.userId || m.id,
    label: m.name || `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || m.email || '—',
  }));
}

// pad: описывает схему валидации и преобразования данных.
function pad(num) {
  return String(num).padStart(2, '0');
}

// toLocalInputDT: описывает схему валидации и преобразования данных.
function toLocalInputDT(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// toUtcDateInput: описывает схему валидации и преобразования данных.
function toUtcDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

// inferHasTime: описывает схему валидации и преобразования данных.
function inferHasTime(raw) {
  if (!raw) return false;
  if (typeof raw === 'string' && DATE_ONLY_RE.test(raw.trim())) return false;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return false;
  return Boolean(
    date.getUTCHours() ||
    date.getUTCMinutes() ||
    date.getUTCSeconds() ||
    date.getUTCMilliseconds()
  );
}

// normalizeHasTime: описывает схему валидации и преобразования данных.
function normalizeHasTime(rawFlag, fallbackValue) {
  if (typeof rawFlag === 'boolean') return rawFlag;
  return inferHasTime(fallbackValue);
}

// toFormDateValue: описывает схему валидации и преобразования данных.
function toFormDateValue(rawValue, hasTime) {
  if (!rawValue) return '';
  return hasTime ? toLocalInputDT(rawValue) : toUtcDateInput(rawValue);
}

// toApiDateValue: описывает схему валидации и преобразования данных.
function toApiDateValue(value, hasTime) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  if (hasTime) {
    if (DATE_ONLY_RE.test(raw)) {
      const parsed = new Date(`${raw}T00:00`);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  if (DATE_ONLY_RE.test(raw)) return raw;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

// formatTaskDate: описывает схему валидации и преобразования данных.
export function formatTaskDate(value, hasTime, locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  if (!hasTime) {
    return date.toLocaleDateString(locale || undefined, { timeZone: 'UTC' });
  }
  return date.toLocaleString(locale || undefined);
}

// displayUser: описывает схему валидации и преобразования данных.
function displayUser(user = {}) {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return full || user.displayName || user.email || '—';
}

// displayContact: описывает схему валидации и преобразования данных.
function displayContact(contact = {}) {
  const full = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
  return contact.displayName || full || contact.jobTitle || contact.email || contact.id || '—';
}

// toFormTask: описывает схему валидации и преобразования данных.
export function toFormTask(data = {}) {
  const assigneeIds = Array.isArray(data.userParticipants)
    ? data.userParticipants
        .filter((user) => user?.TaskUserParticipant?.role === 'assignee')
        .map((user) => user.id)
    : Array.isArray(data.assigneeIds)
      ? data.assigneeIds
      : [];

  const watcherIds = Array.isArray(data.userParticipants)
    ? data.userParticipants
        .filter((user) => user?.TaskUserParticipant?.role === 'watcher')
        .map((user) => user.id)
    : Array.isArray(data.watcherIds)
      ? data.watcherIds
      : [];

  const departmentIds = Array.isArray(data.departmentParticipants)
    ? data.departmentParticipants.map((dep) => dep.id)
    : Array.isArray(data.departmentIds)
      ? data.departmentIds
      : [];

  const contactIds = Array.isArray(data.contacts)
    ? data.contacts.map((contact) => contact.id)
    : Array.isArray(data.contactIds)
      ? data.contactIds
      : [];

  const plannedStartRaw = data.plannedStartAt ?? data.startAt ?? null;
  const plannedEndRaw = data.plannedEndAt ?? data.endAt ?? null;
  const actualStartRaw = data.actualStartAt ?? data.startedAt ?? null;
  const actualEndRaw = data.actualEndAt ?? data.finishedAt ?? null;

  const plannedStartHasTime = normalizeHasTime(data.plannedStartHasTime, plannedStartRaw);
  const plannedEndHasTime = normalizeHasTime(data.plannedEndHasTime, plannedEndRaw);
  const actualStartHasTime = normalizeHasTime(data.actualStartHasTime, actualStartRaw);
  const actualEndHasTime = normalizeHasTime(data.actualEndHasTime, actualEndRaw);

  return {
    id: data.id ?? null,
    title: data.title ?? '',
    category: data.category ?? '',
    description: data.description ?? '',
    creator: data.creator ? displayUser(data.creator) : '',
    status: data.status ?? 'todo',
    priority: Number.isFinite(data.priority) ? data.priority : 50,

    startAt: toFormDateValue(plannedStartRaw, plannedStartHasTime),
    endAt: toFormDateValue(plannedEndRaw, plannedEndHasTime),
    actualStartAt: toFormDateValue(actualStartRaw, actualStartHasTime),
    actualEndAt: toFormDateValue(actualEndRaw, actualEndHasTime),

    plannedStartHasTime,
    plannedEndHasTime,
    actualStartHasTime,
    actualEndHasTime,

    timezone: data.timezone ?? Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone ?? 'Europe/Warsaw',
    assigneeIds,
    watcherIds,
    departmentIds,
    contactIds,
    contacts: Array.isArray(data.contacts) ? data.contacts : [],

    counterpartyId: data.counterpartyId ?? data.counterparty?.id ?? null,
    counterpartyName: data.counterparty?.shortName || data.counterparty?.fullName || '',
    counterpartyType: data.counterparty?.type || null,
    dealId: data.dealId ?? data.deal?.id ?? null,

    contactsLabel: Array.isArray(data.contacts)
      ? data.contacts.map(displayContact).filter(Boolean).join(', ')
      : '',

    statusAggregate: !!data.statusAggregate,
    visibility: TASK_VISIBILITY.includes(data.visibility) ? data.visibility : 'company',
    visibilityDepartmentId: data.visibilityDepartmentId ?? data.visibility_department_id ?? null,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
}

// toApiTask: описывает схему валидации и преобразования данных.
export function toApiTask(values = {}) {
  const hasAssignees = Array.isArray(values.assigneeIds) && values.assigneeIds.length > 0;
  const hasDepartments = Array.isArray(values.departmentIds) && values.departmentIds.length > 0;
  const hasWatchers = Array.isArray(values.watcherIds) && values.watcherIds.length > 0;

  const plannedStartAt = toApiDateValue(values.startAt, !!values.plannedStartHasTime);
  const plannedEndAt = toApiDateValue(values.endAt, !!values.plannedEndHasTime);
  const actualStartAt = toApiDateValue(values.actualStartAt, !!values.actualStartHasTime);
  const actualEndAt = toApiDateValue(values.actualEndAt, !!values.actualEndHasTime);

  return {
    title: (values.title || '').trim(),
    category: values.category?.trim() || null,
    description: values.description?.trim() || null,
    status: TASK_STATUS.includes(values.status) ? values.status : 'todo',
    priority: Math.max(0, Math.min(100, parseInt(values.priority ?? 50, 10) || 0)),

    startAt: plannedStartAt,
    endAt: plannedEndAt,
    plannedStartAt,
    plannedEndAt,
    actualStartAt,
    actualEndAt,

    plannedStartHasTime: !!values.plannedStartHasTime,
    plannedEndHasTime: !!values.plannedEndHasTime,
    actualStartHasTime: !!values.actualStartHasTime,
    actualEndHasTime: !!values.actualEndHasTime,

    timezone: values.timezone || null,
    participantMode: hasAssignees || hasDepartments ? 'lists' : 'none',
    watcherMode: hasWatchers ? 'lists' : 'none',
    assigneeIds: Array.isArray(values.assigneeIds) ? values.assigneeIds : [],
    departmentIds: Array.isArray(values.departmentIds) ? values.departmentIds : [],
    watcherIds: Array.isArray(values.watcherIds) ? values.watcherIds : [],
    contactIds: Array.isArray(values.contactIds) ? values.contactIds : [],
    counterpartyId: values.counterpartyId || null,
    dealId: values.dealId || null,
    statusAggregate: !!values.statusAggregate,
    visibility: TASK_VISIBILITY.includes(values.visibility) ? values.visibility : 'company',
    visibilityDepartmentId: values.visibility === 'department' ? (values.visibilityDepartmentId || null) : null,
  };
}

// buildTaskSchema: описывает схему валидации и преобразования данных.
export function buildTaskSchema(i18n, {
  members = [],
  currentUserId,
  counterpartyOptions = [],
  contactOptions = [],
  dealOptions = [],
} = {}) {
  const memberOptions = getCompanyMemberOptions(members);
  const statusOptions = TASK_STATUS.map((value) => ({ value, labelKey: `crm.task.enums.status.${value}` }));

  return [
    { kind: 'section', title: 'crm.task.sections.basic' },

    { name: 'title', label: 'crm.task.fields.title', type: 'text', float: true, max: 300, placeholder: 'crm.task.placeholders.title', cols: 4 },
    { name: 'category', label: 'crm.task.fields.category', type: 'text', float: true, max: 64, cols: 2 },
    {
      name: 'status',
      label: 'crm.task.fields.status',
      type: 'select',
      float: true,
      options: statusOptions.map((item) => ({ value: item.value, labelKey: item.labelKey })),
      cols: 2,
    },
    { name: 'priority', label: 'crm.task.fields.priority', type: 'text', float: true, inputMode: 'numeric', cols: 2 },
    { name: 'creator', label: 'crm.task.fields.creator', type: 'text', float: true, cols: 2 },

    { kind: 'section', title: 'crm.task.sections.schedule' },

    {
      name: 'startAt',
      label: 'crm.task.fields.startAt',
      type: 'date-or-datetime',
      hasTimeField: 'plannedStartHasTime',
      cols: 2,
      float: true,
    },
    {
      name: 'endAt',
      label: 'crm.task.fields.endAt',
      type: 'date-or-datetime',
      hasTimeField: 'plannedEndHasTime',
      cols: 2,
      float: true,
    },
    {
      name: 'actualStartAt',
      label: 'crm.task.fields.actualStartAt',
      type: 'date-or-datetime',
      hasTimeField: 'actualStartHasTime',
      cols: 2,
      float: true,
    },
    {
      name: 'actualEndAt',
      label: 'crm.task.fields.actualEndAt',
      type: 'date-or-datetime',
      hasTimeField: 'actualEndHasTime',
      cols: 2,
      float: true,
    },

    { kind: 'section', title: 'crm.task.sections.participants' },

    {
      name: 'assigneeIds',
      type: 'dropdown-multiselect',
      float: true,
      cols: 2,
      label: 'crm.task.fields.assignees',
            // options: описывает схему валидации и преобразования данных.
options: () => memberOptions,
      placeholder: 'common.noneSelected',
      selectAllLabel: 'common.selectAll',
      clearLabel: 'common.clear',
      maxPreview: 3,
    },
    {
      name: 'watcherIds',
      type: 'dropdown-multiselect',
      float: true,
      cols: 2,
      label: 'crm.task.fields.watchers',
            // options: описывает схему валидации и преобразования данных.
options: (vals) => {
        const me = currentUserId || null;
        const assigneeSet = new Set(vals?.assigneeIds || []);
        return memberOptions.filter((opt) => !assigneeSet.has(opt.value) && opt.value !== me);
      },
      placeholder: 'common.noneSelected',
      selectAllLabel: 'common.selectAll',
      clearLabel: 'common.clear',
      maxPreview: 3,
    },
    {
      name: 'counterpartyId',
      label: 'crm.task.fields.counterparty',
      type: 'autocomplete-select',
      float: true,
      cols: 2,
            // options: описывает схему валидации и преобразования данных.
options: () => counterpartyOptions,
      placeholder: 'crm.task.placeholders.counterpartySearch',
    },
    {
      name: 'contactIds',
      label: 'crm.task.fields.contacts',
      type: 'dropdown-multiselect',
      float: true,
      cols: 2,
            // options: описывает схему валидации и преобразования данных.
options: (vals) => {
        const cpId = vals?.counterpartyId ? String(vals.counterpartyId) : '';
        if (!cpId) return contactOptions;
        return contactOptions.filter((opt) => String(opt.counterpartyId || '') === cpId);
      },
      placeholder: 'common.noneSelected',
      selectAllLabel: 'common.selectAll',
      clearLabel: 'common.clear',
      maxPreview: 3,
    },

    { kind: 'section', title: 'crm.task.sections.links' },
    { name: 'dealId', label: 'crm.task.fields.deal', type: 'select', float: true,     // options : options.
// options: описывает схему валидации и преобразования данных.
options: () => dealOptions, cols: 2 },

    { kind: 'section', title: 'crm.task.sections.logic' },
    {
      name: 'statusAggregate',
      label: 'crm.task.fields.statusAggregate',
      type: 'checkbox',
      hint: 'crm.task.hints.statusAggregate',
      cols: 4,
    },
  ];
}

