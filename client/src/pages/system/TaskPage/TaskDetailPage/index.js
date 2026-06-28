import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Trash2, ClipboardList, CheckCircle2, CircleDot, OctagonAlert } from 'lucide-react';

import {
  DetailLayout,
  DetailSection,
} from '../../../../components/detail';
import ConfirmDialog from '../../../../components/dialogs/ConfirmDialog';
import EntityNotesSection from '../../../../components/notes/EntityNotesSection';
import {
  CheckboxField,
  DateTimeField,
  MultiSelectField,
  PriorityField,
  SelectField,
  TextField,
  TextareaField,
  VisibilityField,
} from '../../../../components/ui/fields';
import { TASK_STATUS, formatTaskDate, toApiTask, toFormTask } from '../../../../schemas/task.schema';
import {
  PRIORITY_I18N_KEYS,
  PRIORITY_TONES,
  normalizePriority,
} from '../../../../config/priority';
import { useListCounterpartiesQuery } from '../../../../store/rtk/counterpartyApi';
import { useGetContactsQuery } from '../../../../store/rtk/contactsApi';
import { useListDepartmentsQuery } from '../../../../store/rtk/departmentsApi';
import {
  useCreateTaskMutation,
  useDeleteTaskMutation,
  useGetTaskQuery,
  useUpdateMyTaskStatusMutation,
  useUpdateTaskMutation,
} from '../../../../store/rtk/tasksApi';
import { useSignedFileUrl } from '../../../../hooks/useSignedFileUrl';
import DescriptionForm from '../sections/DescriptionForm';
import s from './TaskDetailPage.module.css';

const EMPTY_OPTIONS = [];
const SAVE_DEBOUNCE_MS = 500;
const MEMBER_STATUS_OPTIONS = ['todo', 'in_progress', 'done', 'blocked'];

function memberLabel(member = {}) {
  return member.name
    || [member.firstName, member.lastName].filter(Boolean).join(' ').trim()
    || member.displayName
    || member.email
    || member.id
    || '—';
}

function participantMeta(user = {}) {
  return user.TaskUserParticipant || user.taskUserParticipant || {};
}

function normalizeAvatarRef(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value !== 'object') return null;
  return value.avatarUrl
    || value.photoUrl
    || value.profilePhotoUrl
    || value.url
    || value.path
    || value.location
    || value.id
    || null;
}

function participantAvatarValue(user = {}) {
  return [
    user.avatarUrl,
    user.avatar,
    user.photoUrl,
    user.profilePhoto,
    user.profilePhotoUrl,
    user.image,
    user.imageUrl,
  ].map(normalizeAvatarRef).find(Boolean) || null;
}

function participantInitials(row = {}) {
  const source = String(row.name || row.email || row.id || '?').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function participantRow(user = {}) {
  const meta = participantMeta(user);
  return {
    id: user.id,
    name: memberLabel(user),
    email: user.email || null,
    avatarUrl: participantAvatarValue(user),
    memberStatus: meta.memberStatus || 'todo',
    startedAt: meta.startedAt || null,
    completedAt: meta.completedAt || null,
    completedById: meta.completedById || null,
    statusNote: meta.statusNote || null,
  };
}

function mergeAggregateSummaryRows(task = {}, summary = emptyAggregateSummary()) {
  const participants = Array.isArray(task.userParticipants) ? task.userParticipants : [];
  const participantById = new Map(
    participants
      .map((user) => participantRow(user))
      .filter((row) => row.id)
      .map((row) => [String(row.id), row])
  );
  const mergeRow = (row = {}) => {
    const participant = participantById.get(String(row.id)) || {};
    return {
      ...participant,
      ...row,
      name: row.name || participant.name,
      email: row.email || participant.email || null,
      avatarUrl: participantAvatarValue(row) || participant.avatarUrl || null,
    };
  };
  return {
    ...summary,
    pendingAssignees: (summary.pendingAssignees || []).map(mergeRow),
    completedAssignees: (summary.completedAssignees || []).map(mergeRow),
    blockedAssignees: (summary.blockedAssignees || []).map(mergeRow),
  };
}

function emptyAggregateSummary() {
  return {
    assigneesTotal: 0,
    assigneesDone: 0,
    assigneesPending: 0,
    assigneesBlocked: 0,
    progressPercent: 0,
    pendingAssignees: [],
    completedAssignees: [],
    blockedAssignees: [],
  };
}

function deriveAggregateSummary(task = {}) {
  if (task.aggregateSummary) return mergeAggregateSummaryRows(task, task.aggregateSummary);
  const summary = emptyAggregateSummary();
  const participants = Array.isArray(task.userParticipants) ? task.userParticipants : [];
  participants.forEach((user) => {
    const meta = participantMeta(user);
    if (meta.role !== 'assignee') return;
    const row = participantRow(user);
    summary.assigneesTotal += 1;
    if (row.memberStatus === 'done') {
      summary.assigneesDone += 1;
      summary.completedAssignees.push(row);
    } else if (row.memberStatus === 'blocked') {
      summary.assigneesBlocked += 1;
      summary.blockedAssignees.push(row);
    } else {
      summary.assigneesPending += 1;
      summary.pendingAssignees.push(row);
    }
  });
  summary.progressPercent = summary.assigneesTotal
    ? Math.round((summary.assigneesDone / summary.assigneesTotal) * 100)
    : 0;
  return summary;
}

function allAssigneeRows(task = {}) {
  const summary = deriveAggregateSummary(task);
  return [
    ...(summary.completedAssignees || []),
    ...(summary.pendingAssignees || []),
    ...(summary.blockedAssignees || []),
  ];
}

function getStatusTone(status) {
  if (status === 'done') return 'success';
  if (status === 'blocked' || status === 'canceled') return 'danger';
  if (status === 'in_progress') return 'info';
  return 'neutral';
}

function ParticipantAvatar({ row }) {
  const [imageFailed, setImageFailed] = useState(false);
  const avatarValue = row?.avatarUrl || null;
  const { url: avatarUrl, onError: refreshAvatarUrl } = useSignedFileUrl(avatarValue);

  useEffect(() => {
    setImageFailed(false);
  }, [avatarValue, avatarUrl]);

  const showImage = Boolean(avatarUrl && !imageFailed);

  return (
    <div className={s.memberAvatar} aria-hidden="true">
      {showImage ? (
        <img
          src={avatarUrl}
          alt=""
          onError={() => {
            refreshAvatarUrl?.();
            setImageFailed(true);
          }}
        />
      ) : (
        <span>{participantInitials(row)}</span>
      )}
    </div>
  );
}

function normalizeInitialTask(task) {
  return {
    title: '',
    category: '',
    status: 'todo',
    priority: 50,
    startAt: '',
    endAt: '',
    actualStartAt: '',
    actualEndAt: '',
    plannedStartHasTime: false,
    plannedEndHasTime: false,
    actualStartHasTime: false,
    actualEndHasTime: false,
    timezone: Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || 'Europe/Warsaw',
    assigneeIds: [],
    watcherIds: [],
    contactIds: [],
    counterpartyId: null,
    dealId: null,
    statusAggregate: false,
    visibility: 'company',
    visibilityDepartmentId: null,
    ...toFormTask(task || {}),
  };
}

function getCreatedTaskId(created) {
  return created?.id
    || created?.task?.id
    || created?.data?.id
    || created?.data?.task?.id
    || null;
}

function isDateParam(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

function isTimeParam(value) {
  return /^\d{2}:\d{2}$/.test(String(value || '').trim());
}

function buildCreatePrefill(searchParams) {
  const title = searchParams.get('title') || '';
  const date = searchParams.get('date') || '';
  if (!title && !date) return {};

  const prefill = {};
  if (title) prefill.title = title;

  if (isDateParam(date)) {
    const allDay = searchParams.get('allDay') !== '0';
    const start = searchParams.get('start') || '';
    const end = searchParams.get('end') || '';
    if (!allDay && isTimeParam(start) && isTimeParam(end)) {
      prefill.startAt = `${date}T${start}`;
      prefill.endAt = `${date}T${end}`;
      prefill.plannedStartHasTime = true;
      prefill.plannedEndHasTime = true;
    } else {
      prefill.startAt = date;
      prefill.endAt = date;
      prefill.plannedStartHasTime = false;
      prefill.plannedEndHasTime = false;
    }
  }

  return prefill;
}

export default function TaskDetailPage({ createMode = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const isCreateMode = createMode || id === 'new';
  const createPrefillKey = isCreateMode ? searchParams.toString() : '';
  const { data: base, isFetching } = useGetTaskQuery(id, { skip: isCreateMode });
  const [createTask, { isLoading: creating }] = useCreateTaskMutation();
  const [updateTask, { isLoading: saving }] = useUpdateTaskMutation();
  const [updateMyTaskStatus, { isLoading: updatingMyStatus }] = useUpdateMyTaskStatusMutation();
  const [deleteTask, { isLoading: deleting }] = useDeleteTaskMutation();
  const [values, setValues] = useState(() => normalizeInitialTask(null));
  const [loadedTaskId, setLoadedTaskId] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const [memberStatusError, setMemberStatusError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const members = useSelector((state) => state.bootstrap?.companyUsers || []);
  const currentUserId = useSelector((state) => state.auth?.currentUser?.id || null);

  const { data: counterpartiesData } = useListCounterpartiesQuery(
    { limit: 100, sort: 'shortName', dir: 'ASC' },
    { refetchOnMountOrArgChange: false }
  );
  const { data: contactsData } = useGetContactsQuery(
    { limit: 100, sort: 'createdAt', dir: 'DESC' },
    { refetchOnMountOrArgChange: false }
  );
  const { data: departmentsData } = useListDepartmentsQuery(
    { limit: 100 },
    { refetchOnMountOrArgChange: false }
  );

  useEffect(() => {
    if (!isCreateMode) return;
    const nextLoadedTaskId = `new:${createPrefillKey}`;
    if (loadedTaskId === nextLoadedTaskId) return;
    const prefill = buildCreatePrefill(searchParams);
    setValues({ ...normalizeInitialTask(null), ...prefill });
    setLoadedTaskId(nextLoadedTaskId);
    setDirty(Boolean(Object.keys(prefill).length));
    setSaveError('');
    setSavedAt(null);
    setMemberStatusError('');
  }, [createPrefillKey, isCreateMode, loadedTaskId, searchParams]);

  useEffect(() => {
    if (isCreateMode) return;
    if (!base?.id) return;
    if (loadedTaskId !== base.id || !dirty) {
      setValues(normalizeInitialTask(base));
      setLoadedTaskId(base.id);
      setDirty(false);
      setSaveError('');
    }
  }, [base, dirty, isCreateMode, loadedTaskId]);

  const userOptions = useMemo(() => {
    const list = Array.isArray(members) ? members : [];
    return list
      .map((member) => ({
        value: String(member.userId || member.id || ''),
        label: memberLabel(member),
      }))
      .filter((option) => option.value);
  }, [members]);

  const watcherOptions = useMemo(() => {
    const assigneeSet = new Set((values.assigneeIds || []).map(String));
    return userOptions.filter((option) => !assigneeSet.has(String(option.value)) && (!currentUserId || String(option.value) !== String(currentUserId)));
  }, [currentUserId, userOptions, values.assigneeIds]);

  const counterpartyOptions = useMemo(() => {
    const items = Array.isArray(counterpartiesData?.items) ? counterpartiesData.items : [];
    return items.map((cp) => ({
      value: cp.id,
      label: cp.shortName || cp.fullName || cp.id,
      secondary: [cp.nip ? `NIP: ${cp.nip}` : null, cp.city || null].filter(Boolean).join(' • ') || null,
      type: cp.type || null,
    }));
  }, [counterpartiesData?.items]);

  const contactOptions = useMemo(() => {
    const items = Array.isArray(contactsData?.items) ? contactsData.items : [];
    return items.map((contact) => {
      const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
      const linkedCounterpartyName = contact.counterparty?.shortName || contact.counterparty?.fullName || null;
      return {
        value: contact.id,
        label: fullName || contact.displayName || contact.email || contact.id,
        secondary: [linkedCounterpartyName, contact.position || contact.jobTitle || null, contact.phone || contact.email || null]
          .filter(Boolean)
          .join(' • ') || null,
        counterpartyId: contact.counterpartyId || contact.counterparty?.id || null,
      };
    });
  }, [contactsData?.items]);

  const counterpartyOptionsForForm = useMemo(() => {
    const map = new Map(counterpartyOptions.map((option) => [String(option.value), option]));
    if (base?.counterparty?.id) {
      map.set(String(base.counterparty.id), {
        value: base.counterparty.id,
        label: base.counterparty.shortName || base.counterparty.fullName || base.counterparty.id,
        type: base.counterparty.type || null,
      });
    }
    return Array.from(map.values());
  }, [base?.counterparty, counterpartyOptions]);

  const contactOptionsForForm = useMemo(() => {
    const map = new Map(contactOptions.map((option) => [String(option.value), option]));
    const counterpartyNameById = new Map(counterpartyOptionsForForm.map((option) => [String(option.value), option.label]));
    const linked = Array.isArray(base?.contacts) ? base.contacts : [];
    linked.forEach((contact) => {
      const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
      const linkedCounterpartyName = counterpartyNameById.get(String(contact.counterpartyId || '')) || null;
      map.set(String(contact.id), {
        value: contact.id,
        label: fullName || contact.displayName || contact.email || contact.id,
        secondary: [linkedCounterpartyName, contact.jobTitle || null, contact.phone || contact.email || null]
          .filter(Boolean)
          .join(' • ') || null,
        counterpartyId: contact.counterpartyId || null,
      });
    });
    return Array.from(map.values());
  }, [base?.contacts, contactOptions, counterpartyOptionsForForm]);

  const filteredContactOptions = useMemo(() => {
    const counterpartyId = values.counterpartyId ? String(values.counterpartyId) : '';
    if (!counterpartyId) return contactOptionsForForm;
    return contactOptionsForForm.filter((option) => String(option.counterpartyId || '') === counterpartyId);
  }, [contactOptionsForForm, values.counterpartyId]);

  const counterpartyById = useMemo(
    () => new Map(counterpartyOptionsForForm.map((option) => [String(option.value), option])),
    [counterpartyOptionsForForm]
  );
  const contactById = useMemo(
    () => new Map(contactOptionsForForm.map((option) => [String(option.value), option])),
    [contactOptionsForForm]
  );
  const userById = useMemo(
    () => new Map(userOptions.map((option) => [String(option.value), option])),
    [userOptions]
  );
  const departments = useMemo(
    () => (Array.isArray(departmentsData) ? departmentsData : []),
    [departmentsData]
  );
  const departmentById = useMemo(
    () => new Map(departments.map((department) => [String(department.id), department])),
    [departments]
  );

  const setField = useCallback((name, nextValue) => {
    setValues((previous) => {
      if (previous[name] === nextValue) return previous;
      setDirty(true);
      setSaveError('');
      return { ...previous, [name]: nextValue };
    });
  }, []);

  const setVisibility = useCallback(({ visibility, visibilityDepartmentId }) => {
    setValues((previous) => {
      const nextVisibility = visibility || 'company';
      const nextDepartmentId = nextVisibility === 'department' ? (visibilityDepartmentId || null) : null;
      if (previous.visibility === nextVisibility && (previous.visibilityDepartmentId || null) === nextDepartmentId) {
        return previous;
      }
      setDirty(true);
      setSaveError('');
      return {
        ...previous,
        visibility: nextVisibility,
        visibilityDepartmentId: nextDepartmentId,
      };
    });
  }, []);

  const setDateField = useCallback((fieldName, hasTimeField, nextValue) => {
    setValues((previous) => {
      const normalizedNext = nextValue || '';
      if (String(previous[fieldName] || '') === String(normalizedNext)) return previous;
      setDirty(true);
      setSaveError('');
      return { ...previous, [fieldName]: normalizedNext };
    });
  }, []);

  const setDateHasTime = useCallback((fieldName, hasTimeField, nextHasTime) => {
    setValues((previous) => {
      const normalizedNextHasTime = Boolean(nextHasTime);
      if (Boolean(previous[hasTimeField]) === normalizedNextHasTime) return previous;
      const raw = String(previous[fieldName] || '');
      let nextRaw = raw;
      if (raw) {
        if (normalizedNextHasTime && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          nextRaw = `${raw}T00:00`;
        } else if (!normalizedNextHasTime) {
          nextRaw = raw.slice(0, 10);
        }
      }
      setDirty(true);
      setSaveError('');
      return { ...previous, [fieldName]: nextRaw, [hasTimeField]: normalizedNextHasTime };
    });
  }, []);

  const performSave = useCallback(async (reason = 'autosave') => {
    if (isCreateMode || !id || !dirty || saving) return null;
    if (!String(values.title || '').trim()) {
      setSaveError(t('crm.task.detail.validation.titleRequired'));
      return null;
    }
    if (values.visibility === 'department' && !values.visibilityDepartmentId) {
      setSaveError(t('visibility.departmentRequired'));
      return null;
    }
    try {
      const saved = await updateTask({ id, payload: toApiTask(values) }).unwrap();
      setDirty(false);
      setSaveError('');
      setSavedAt(new Date());
      return saved;
    } catch (error) {
      setSaveError(
        error?.data?.message
        || error?.data?.error
        || error?.message
        || t('crm.task.detail.messages.saveFailed')
      );
      if (reason === 'manual') throw error;
      return null;
    }
  }, [dirty, id, isCreateMode, saving, t, updateTask, values]);

  const handleCreate = useCallback(async () => {
    if (creating) return null;
    if (!String(values.title || '').trim()) {
      setSaveError(t('crm.task.detail.validation.titleRequired'));
      return null;
    }
    if (values.visibility === 'department' && !values.visibilityDepartmentId) {
      setSaveError(t('visibility.departmentRequired'));
      return null;
    }
    try {
      const created = await createTask(toApiTask(values)).unwrap();
      const createdId = getCreatedTaskId(created);
      if (!createdId) {
        throw new Error(t('crm.task.messages.createFailed'));
      }
      setDirty(false);
      setSaveError('');
      navigate(`/main/tasks/${createdId}`, { replace: true });
      return created;
    } catch (error) {
      setSaveError(
        error?.data?.message
        || error?.data?.error
        || error?.message
        || t('crm.task.messages.createFailed')
      );
      return null;
    }
  }, [createTask, creating, navigate, t, values]);

  useEffect(() => {
    if (isCreateMode || !dirty || !id) return undefined;
    const timer = setTimeout(() => {
      performSave('autosave');
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [dirty, id, isCreateMode, performSave, values]);

  const confirmDelete = async () => {
    if (isCreateMode || !id || deleting) return;
    setDeleteError('');
    try {
      await deleteTask(id).unwrap();
      navigate('/main/tasks');
    } catch (error) {
      setDeleteError(
        error?.data?.message
        || error?.data?.error
        || error?.message
        || t('crm.task.messages.deleteFailed')
      );
    }
  };

  const locale = i18n.resolvedLanguage || i18n.language || undefined;
  const statusLabel = t(`crm.task.enums.status.${values.status}`, values.status || '—');
  const priorityValue = normalizePriority(values.priority);
  const priorityLevelLabel = t(PRIORITY_I18N_KEYS[priorityValue]);
  const priorityLabel = `${priorityValue} · ${priorityLevelLabel}`;
  const visibilityValue = values.visibility || 'company';
  const visibilityDepartment = values.visibilityDepartmentId
    ? departmentById.get(String(values.visibilityDepartmentId))
    : null;
  const visibilityLabel = visibilityValue === 'department' && visibilityDepartment
    ? `${t('visibility.department')} · ${visibilityDepartment.name || visibilityDepartment.code || visibilityDepartment.id}`
    : t(`visibility.${visibilityValue}`, t('visibility.company'));
  const taskTitle = values.title || base?.title || t('crm.task.detail.untitled');
  const headerTitle = isCreateMode ? t('crm.task.newTask') : taskTitle;
  const hasActualDates = Boolean(values.actualStartAt || values.actualEndAt);
  const hasRelationValues = Boolean(values.counterpartyId || values.dealId || (values.contactIds || []).length);

  const dateField = (fieldName, hasTimeField, labelKey) => (
    <div className={s.field} key={fieldName}>
      <DateTimeField
        id={`task-detail-${fieldName}`}
        label={t(labelKey)}
        className={s.datePickerField}
        inputClassName={s.dateControl}
        value={values[fieldName] || ''}
        withTime={Boolean(values[hasTimeField])}
        allowTimeToggle
        onWithTimeChange={(nextHasTime) => setDateHasTime(fieldName, hasTimeField, nextHasTime)}
        timeToggleLabel={t('crm.task.fields.withTime')}
        locale={locale}
        onValueChange={(nextValue) => setDateField(fieldName, hasTimeField, nextValue)}
        placeholder={t('crm.task.detail.placeholders.addDate')}
      />
    </div>
  );

  const relations = useMemo(() => {
    const items = [];
    const counterpartyId = values.counterpartyId ? String(values.counterpartyId) : '';
    if (counterpartyId) {
      items.push({
        id: `counterparty-${counterpartyId}`,
        title: counterpartyById.get(counterpartyId)?.label || counterpartyId,
        meta: t('crm.task.fields.counterparty'),
        to: `/main/counterparties/${counterpartyId}`,
      });
    }
    (Array.isArray(values.contactIds) ? values.contactIds : []).forEach((contactId) => {
      const idValue = String(contactId);
      items.push({
        id: `contact-${idValue}`,
        title: contactById.get(idValue)?.label || idValue,
        meta: t('crm.task.fields.contacts'),
        to: `/main/contacts/${idValue}`,
      });
    });
    if (values.dealId) {
      items.push({
        id: `deal-${values.dealId}`,
        title: String(values.dealId),
        meta: t('crm.task.fields.deal'),
      });
    }
    return items;
  }, [contactById, counterpartyById, t, values.contactIds, values.counterpartyId, values.dealId]);

  const aggregateSummary = useMemo(() => deriveAggregateSummary(base || {}), [base]);
  const currentAssignee = useMemo(() => {
    if (!currentUserId || !base) return null;
    return allAssigneeRows(base).find((row) => String(row.id) === String(currentUserId)) || null;
  }, [base, currentUserId]);
  const createAssigneeRows = useMemo(() => (
    (values.assigneeIds || []).map((assigneeId) => {
      const option = userById.get(String(assigneeId));
      return {
        id: String(assigneeId),
        name: option?.label || String(assigneeId),
      };
    })
  ), [userById, values.assigneeIds]);
  const createWatcherRows = useMemo(() => (
    (values.watcherIds || []).map((watcherId) => {
      const option = userById.get(String(watcherId));
      return {
        id: String(watcherId),
        name: option?.label || String(watcherId),
      };
    })
  ), [userById, values.watcherIds]);

  const handleMyStatus = useCallback(async (memberStatus) => {
    if (isCreateMode || !id || updatingMyStatus) return;
    setMemberStatusError('');
    try {
      await updateMyTaskStatus({
        taskId: id,
        payload: { memberStatus },
      }).unwrap();
      setSavedAt(new Date());
    } catch (error) {
      setMemberStatusError(
        error?.data?.message
        || error?.data?.error
        || error?.message
        || t('crm.task.detail.team.statusUpdateFailed')
      );
    }
  }, [id, isCreateMode, t, updateMyTaskStatus, updatingMyStatus]);

  const renderStatusChip = (status) => (
    <span className={`${s.memberStatusChip} ${s[`memberStatus_${status}`] || ''}`}>
      {t(`crm.task.detail.team.memberStatus.${status}`, status || '—')}
    </span>
  );

  const renderMemberActions = (row) => {
    if (!currentUserId || String(row.id) !== String(currentUserId)) {
      return renderStatusChip(row.memberStatus || 'todo');
    }
    const status = row.memberStatus || 'todo';
    const disabled = updatingMyStatus;

    return (
      <div className={s.memberStatusControl}>
        <span className={s.memberStatusLabel}>{t('crm.task.fields.status')}:</span>
        <div className={s.memberStatusSelectWrap}>
          <select
            className={s.memberStatusSelect}
            value={status}
            disabled={disabled}
            aria-label={`${t('crm.task.fields.status')}: ${row.name || row.email || row.id}`}
            onChange={(event) => {
              const nextStatus = event.target.value;
              if (nextStatus !== status) handleMyStatus(nextStatus);
            }}
          >
            {MEMBER_STATUS_OPTIONS.map((nextStatus) => (
              <option key={`${row.id}-${nextStatus}`} value={nextStatus}>
                {t(`crm.task.detail.team.memberStatus.${nextStatus}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  const renderMemberRow = (row, sectionKey) => (
    <div key={`${sectionKey}-${row.id}`} className={s.memberRow}>
      <ParticipantAvatar row={row} />
      <div className={s.memberMain}>
        <strong className={s.memberName}>{row.name || row.email || row.id}</strong>
        {row.email ? <div className={s.memberEmail}>{row.email}</div> : null}
        <div className={s.memberMeta}>
          {row.startedAt ? (
            <span>{t('crm.task.detail.team.startedAt')}: {formatTaskDate(row.startedAt, true, locale)}</span>
          ) : null}
          {row.completedAt ? (
            <span>{t('crm.task.detail.team.completedAt')}: {formatTaskDate(row.completedAt, true, locale)}</span>
          ) : null}
          {!row.startedAt && !row.completedAt ? <span>{t('crm.task.detail.team.noStatusTime')}</span> : null}
        </div>
        {row.statusNote ? <div className={s.memberNote}>{row.statusNote}</div> : null}
      </div>
      {renderMemberActions(row)}
    </div>
  );

  const renderTeamSection = ({ key, title, icon, rows }) => (
    !rows.length ? null : (
    <section className={s.memberSection}>
      <div className={s.memberSectionHeader}>
        {icon}
        <strong>{title}</strong>
        <span>{rows.length}</span>
      </div>
      <div className={s.memberList}>
        {rows.map((row) => renderMemberRow(row, key))}
      </div>
    </section>
    )
  );

  const participantsPanel = (
    <div className={s.tabStack}>
      <DetailSection
        title={t('crm.task.detail.team.assigneesTitle')}
      >
        <div className={s.formStack}>
          {isCreateMode ? (
            <div className={s.createModeHint}>
              <strong>{t('crm.task.detail.create.participantsTitle', 'Участники будут добавлены после создания')}</strong>
              <span>{t('crm.task.detail.create.participantsHint', 'Сохраните задачу, чтобы отслеживать выполнение участников и менять их статусы.')}</span>
              {createAssigneeRows.length || createWatcherRows.length ? (
                <div className={s.createPreviewList}>
                  {createAssigneeRows.length ? (
                    <div>
                      <span>{t('crm.task.fields.assignees')}</span>
                      <strong>{createAssigneeRows.map((row) => row.name).join(', ')}</strong>
                    </div>
                  ) : null}
                  {createWatcherRows.length ? (
                    <div>
                      <span>{t('crm.task.fields.watchers')}</span>
                      <strong>{createWatcherRows.map((row) => row.name).join(', ')}</strong>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : aggregateSummary.assigneesTotal ? (
            <>
              <div className={s.teamProgressCard}>
                <div className={s.teamProgressTop}>
                  <div className={s.teamProgressTrack} aria-hidden="true">
                    <span style={{ width: `${Math.max(0, Math.min(100, aggregateSummary.progressPercent || 0))}%` }} />
                  </div>
                  <span>{aggregateSummary.progressPercent}%</span>
                </div>
                <strong>
                  {t('crm.task.detail.team.progressDetail', {
                    done: aggregateSummary.assigneesDone,
                    total: aggregateSummary.assigneesTotal,
                  })}
                </strong>
                <p>
                  {values.statusAggregate
                    ? t('crm.task.detail.team.aggregateEnabledHint')
                    : t('crm.task.detail.team.aggregateDisabledHint')}
                </p>
              </div>
              {memberStatusError ? <div className={s.memberStatusError}>{memberStatusError}</div> : null}
              {!currentAssignee ? <div className={s.memberSelfHint}>{t('crm.task.detail.team.notAssigneeHint')}</div> : null}
              <div className={s.teamSections}>
                {renderTeamSection({
                  key: 'completed',
                  title: t('crm.task.detail.team.sections.completed'),
                  icon: <CheckCircle2 size={15} aria-hidden="true" />,
                  rows: aggregateSummary.completedAssignees || [],
                })}
                {renderTeamSection({
                  key: 'pending',
                  title: t('crm.task.detail.team.sections.pending'),
                  icon: <CircleDot size={15} aria-hidden="true" />,
                  rows: aggregateSummary.pendingAssignees || [],
                })}
                {renderTeamSection({
                  key: 'blocked',
                  title: t('crm.task.detail.team.sections.blocked'),
                  icon: <OctagonAlert size={15} aria-hidden="true" />,
                  rows: aggregateSummary.blockedAssignees || [],
                })}
              </div>
              {!(aggregateSummary.completedAssignees || []).length &&
                !(aggregateSummary.pendingAssignees || []).length &&
                !(aggregateSummary.blockedAssignees || []).length ? (
                  <div className={s.memberSectionEmpty}>{t('crm.task.detail.team.emptySection')}</div>
                ) : null}
            </>
          ) : (
            <div className={s.teamEmptyState}>
              <strong>{t('crm.task.detail.team.noAssigneesTitle')}</strong>
              <span>{t('crm.task.detail.team.noAssigneesText')}</span>
            </div>
          )}
        </div>
      </DetailSection>
    </div>
  );

  const relationsPanel = (
    <div className={s.tabStack}>
      <DetailSection
        title={t('crm.task.detail.sections.relations')}
        subtitle={hasRelationValues ? t('crm.task.detail.summary.relationsAssigned') : undefined}
      >
        {!hasRelationValues ? (
          <div className={s.emptyInline}>{t('crm.task.detail.empty.relations')}</div>
        ) : null}
        <div className={s.formStack}>
          <div className={s.twoColumn}>
            <SelectField
              id="task-detail-counterparty"
              label={t('crm.task.fields.counterparty')}
              value={values.counterpartyId || ''}
              options={counterpartyOptionsForForm}
              placeholder={t('crm.task.placeholders.counterpartySearch')}
              clearable
              onValueChange={(nextValue) => {
                setValues((previous) => ({
                  ...previous,
                  counterpartyId: nextValue || null,
                  contactIds: nextValue ? previous.contactIds : [],
                }));
                setDirty(true);
                setSaveError('');
              }}
            />
            <TextField
              id="task-detail-deal"
              label={t('crm.task.fields.deal')}
              value={values.dealId || ''}
              onValueChange={(nextValue) => setField('dealId', nextValue || null)}
              placeholder={t('crm.task.placeholders.dealId')}
            />
          </div>
          <MultiSelectField
            id="task-detail-contacts"
            label={t('crm.task.fields.contacts')}
            value={values.contactIds || EMPTY_OPTIONS}
            options={filteredContactOptions}
            placeholder={t('common.noneSelected')}
            disabled={!values.counterpartyId && filteredContactOptions.length === 0}
            onValueChange={(nextValue) => setField('contactIds', nextValue)}
            maxPreview={3}
          />
        </div>
        {relations.length ? (
          <div className={s.relationChips}>
            {relations.map((relation) => (
              relation.to ? (
                <button
                  key={relation.id}
                  type="button"
                  className={s.entityChip}
                  onClick={() => navigate(relation.to)}
                >
                  {relation.title}
                </button>
              ) : (
                <span key={relation.id} className={s.entityChip}>{relation.title}</span>
              )
            ))}
          </div>
        ) : null}
      </DetailSection>
    </div>
  );

  const additionalPanel = (
    <div className={s.tabStack}>
      <DetailSection
        title={t('visibility.label')}
        subtitle={t('visibility.taskHint', 'Who can see this task')}
      >
        <div className={s.visibilityCard}>
          <div className={s.visibilityCopy}>
            <strong
              className={`${s.visibilityChip} ${s[`visibility_${visibilityValue}`] || ''}`}
              title={t(`visibility.tooltip.${visibilityValue}`, '')}
            >
              {visibilityLabel}
            </strong>
          </div>
          <VisibilityField
            className={s.visibilityControl}
            inputClassName={s.visibilitySelect}
            departmentClassName={s.visibilityDepartment}
            departmentInputClassName={s.visibilitySelect}
            label={t('visibility.change', 'Change')}
            value={values.visibility || 'company'}
            departmentId={values.visibilityDepartmentId || ''}
            departments={departments}
            onChange={setVisibility}
            size="sm"
          />
        </div>
      </DetailSection>

      <DetailSection
        title={t('crm.task.detail.sections.meta')}
        subtitle={t('crm.task.detail.sections.advancedSubtitle')}
        collapsible
      >
        <div className={s.metaRows}>
          <span>{t('crm.task.detail.fields.taskId')}</span>
          <strong title={id}>{id}</strong>
          <span>{t('crm.task.fields.creator')}</span>
          <strong>{values.creator || t('common.none')}</strong>
          <span>{t('crm.task.detail.fields.createdAt')}</span>
          <strong>{formatTaskDate(values.createdAt, true, locale)}</strong>
          <span>{t('crm.task.detail.fields.updatedAt')}</span>
          <strong>{formatTaskDate(values.updatedAt, true, locale)}</strong>
        </div>
      </DetailSection>

      <DetailSection
        title={t('crm.task.detail.sections.danger')}
        subtitle={t('crm.task.detail.sections.dangerSubtitle')}
        collapsible
        defaultCollapsed
      >
        <div className={s.dangerZone}>
          <div>
            <strong>{t('crm.task.actions.delete')}</strong>
            <p>{t('crm.task.confirm.deleteText')}</p>
          </div>
          <button
            type="button"
            className={s.deleteButton}
            disabled={deleting}
            onClick={() => {
              setDeleteOpen(true);
              setDeleteError('');
            }}
          >
            {t('crm.task.actions.delete')}
          </button>
        </div>
      </DetailSection>
    </div>
  );

  const descriptionPanel = isCreateMode ? (
    <div className={s.tabStack}>
      <DetailSection
        title={t('crm.task.detail.description.title')}
        subtitle={t('crm.task.detail.create.descriptionHint', 'Описание сохранится вместе с задачей')}
      >
        <TextareaField
          id="task-detail-create-description"
          label={t('crm.task.fields.description')}
          value={values.description || ''}
          onValueChange={(nextValue) => setField('description', nextValue)}
          placeholder={t('crm.task.detail.description.placeholder')}
          rows={10}
          autoResize
          inputClassName={s.descriptionDraftInput}
        />
      </DetailSection>
    </div>
  ) : (
    <div className={s.tabStack}>
      <DescriptionForm
        taskId={id}
        initialHtml={values.description || ''}
        className={s.descriptionSection}
        onSaved={(nextHtml) => {
          setValues((previous) => ({ ...previous, description: nextHtml || '' }));
          setSavedAt(new Date());
        }}
      />
    </div>
  );

  const tabs = [
    {
      key: 'description',
      label: t('crm.task.detail.tabs.description'),
      children: descriptionPanel,
    },
    ...(!isCreateMode ? [{
      key: 'notes',
      label: t('crm.task.detail.tabs.notes'),
      children: (
        <div className={`${s.tabStack} ${s.notesCompact}`}>
          <EntityNotesSection
            ownerType="task"
            ownerId={id}
            title={t('crm.task.detail.notesTitle')}
            limit={8}
            compact
            hideFiltersWhenEmpty
            hidePagerWhenSingle
            emptyTitle={t('crm.task.detail.notes.emptyTitle')}
            emptyText={t('crm.task.detail.notes.emptyText')}
            addNoteLabel={t('crm.task.detail.notes.addFirst')}
            refreshLabel={t('common.refresh')}
          />
        </div>
      ),
    }] : []),
    {
      key: 'participants',
      label: t('crm.task.detail.tabs.participants'),
      children: participantsPanel,
    },
    {
      key: 'relations',
      label: t('crm.task.detail.tabs.relations'),
      children: relationsPanel,
    },
    ...(!isCreateMode ? [{
      key: 'additional',
      label: t('crm.task.detail.tabs.additional'),
      children: additionalPanel,
    }] : []),
  ];

  const sidebar = (
    <div className={s.sidebar}>
      <DetailSection title={t('crm.task.detail.sections.basic')}>
        <div className={s.formStack}>
          <TextField
            id="task-detail-title"
            label={t('crm.task.fields.title')}
            value={values.title || ''}
            onValueChange={(nextValue) => setField('title', nextValue)}
            required
            error={saveError && !String(values.title || '').trim() ? saveError : undefined}
            placeholder={t('crm.task.placeholders.title')}
          />
          <div className={s.twoColumn}>
            <SelectField
              id="task-detail-status"
              label={t('crm.task.fields.status')}
              value={values.status}
              options={TASK_STATUS.map((status) => ({
                value: status,
                label: t(`crm.task.enums.status.${status}`, status),
              }))}
              onValueChange={(nextValue) => setField('status', nextValue)}
              searchable={false}
            />
            <PriorityField
              id="task-detail-priority"
              label={t('crm.task.fields.priority')}
              value={values.priority}
              onValueChange={(nextValue) => setField('priority', nextValue)}
            />
          </div>
          <CheckboxField
            className={s.statusAggregateRow}
            id="task-detail-status-aggregate"
            label={t('crm.task.fields.statusAggregate')}
            checked={Boolean(values.statusAggregate)}
            onValueChange={(nextValue) => setField('statusAggregate', nextValue)}
          />
          <TextField
            id="task-detail-category"
            label={t('crm.task.fields.category')}
            value={values.category || ''}
            onValueChange={(nextValue) => setField('category', nextValue)}
            placeholder={t('crm.task.placeholders.category')}
          />
        </div>
      </DetailSection>

      <DetailSection title={t('crm.task.detail.sections.participants')}>
        <div className={s.formStack}>
          <MultiSelectField
            id="task-detail-assignees"
            label={t('crm.task.detail.fields.assignee')}
            value={values.assigneeIds || EMPTY_OPTIONS}
            options={userOptions}
            placeholder={t('common.noneSelected')}
            onValueChange={(nextValue) => setField('assigneeIds', nextValue)}
            maxPreview={3}
          />
          <MultiSelectField
            id="task-detail-watchers"
            label={t('crm.task.fields.watchers')}
            value={values.watcherIds || EMPTY_OPTIONS}
            options={watcherOptions}
            placeholder={t('common.noneSelected')}
            onValueChange={(nextValue) => setField('watcherIds', nextValue)}
            maxPreview={3}
          />
        </div>
      </DetailSection>

      <DetailSection title={t('crm.task.detail.sections.planning')}>
        <div className={s.formStack}>
          <div className={s.dateGroup}>
            <div className={s.groupLabel}>{t('crm.task.detail.groups.planned')}</div>
            {dateField('startAt', 'plannedStartHasTime', 'crm.task.fields.startAt')}
            {dateField('endAt', 'plannedEndHasTime', 'crm.task.fields.endAt')}
          </div>
          {!isCreateMode ? <details className={s.inlineDetails} open={hasActualDates}>
            <summary>
              <span>{t('crm.task.detail.groups.actual')}</span>
              <em>{hasActualDates ? t('crm.task.detail.summary.hasActualDates') : t('crm.task.detail.summary.noActualDates')}</em>
            </summary>
            <div className={s.twoColumn}>
              {dateField('actualStartAt', 'actualStartHasTime', 'crm.task.fields.actualStartAt')}
              {dateField('actualEndAt', 'actualEndHasTime', 'crm.task.fields.actualEndAt')}
            </div>
          </details> : null}
        </div>
      </DetailSection>

      {isCreateMode ? (
        <DetailSection title={t('visibility.label')}>
          <VisibilityField
            className={s.visibilityControlFull}
            inputClassName={s.visibilitySelect}
            departmentClassName={s.visibilityDepartment}
            departmentInputClassName={s.visibilitySelect}
            label={t('visibility.change', 'Change')}
            value={values.visibility || 'company'}
            departmentId={values.visibilityDepartmentId || ''}
            departments={departments}
            onChange={setVisibility}
            size="sm"
          />
        </DetailSection>
      ) : null}
    </div>
  );

  if (!isCreateMode && !base && isFetching) return null;
  if (!isCreateMode && !base) return null;

  return (
    <>
      <DetailLayout
        mode="entity"
        className={s.detailLayout}
        breadcrumbs={[
          { label: t('crm.task.title', 'Tasks'), to: '/main/tasks' },
          { label: headerTitle },
        ]}
        title={headerTitle}
        subtitle={t('crm.task.detail.subtitle', {
          status: statusLabel,
          assignees: (values.assigneeIds || []).map((assigneeId) => userById.get(String(assigneeId))?.label).filter(Boolean).join(', ') || t('common.none'),
        })}
        icon={<ClipboardList size={18} aria-hidden="true" />}
        status={{ value: values.status, label: statusLabel, tone: getStatusTone(values.status) }}
        priority={{ value: priorityValue, label: priorityLabel, tone: PRIORITY_TONES[priorityValue] || 'info' }}
        actions={[
          {
            key: 'back',
            label: t('crm.task.detail.actions.back'),
            icon: <ArrowLeft size={14} aria-hidden="true" />,
            onClick: async () => {
              if (isCreateMode) {
                navigate('/main/tasks');
                return;
              }
              try {
                if (dirty) await performSave('manual');
                navigate('/main/tasks');
              } catch {
                // Save state in the header already shows the backend error.
              }
            },
          },
        ]}
        primaryAction={isCreateMode ? {
          key: 'create',
          label: t('crm.task.actions.create'),
          disabled: creating,
          onClick: handleCreate,
        } : dirty ? {
          key: 'save',
          label: t('common.save'),
          disabled: saving,
          onClick: () => performSave('manual'),
        } : null}
        overflowActions={isCreateMode ? [] : [
          {
            key: 'delete',
            label: t('crm.task.actions.delete'),
            icon: <Trash2 size={14} aria-hidden="true" />,
            destructive: true,
            disabled: deleting,
            onClick: () => {
              setDeleteOpen(true);
              setDeleteError('');
            },
          },
        ]}
        saveState={{
          saving: isCreateMode ? creating : saving,
          dirty,
          error: saveError,
          label: saveError
            || (isCreateMode
              ? (creating ? t('common.saving') : dirty ? t('common.unsaved') : t('crm.task.detail.create.draft', 'Черновик'))
              : (saving ? t('common.saving') : dirty ? t('common.unsaved') : savedAt ? t('crm.task.detail.messages.saved') : t('common.saved'))),
        }}
        sidebar={sidebar}
        tabs={tabs}
      />
      <ConfirmDialog
        open={deleteOpen}
        title={t('crm.task.confirm.deleteTitle')}
        text={(
          <>
            <div>{t('crm.task.confirm.deleteText')}</div>
            {deleteError ? <div className={s.deleteError}>{deleteError}</div> : null}
          </>
        )}
        danger
        loading={deleting}
        okText={t('common.delete')}
        cancelText={t('common.cancel')}
        onOk={confirmDelete}
        onCancel={() => {
          if (deleting) return;
          setDeleteOpen(false);
          setDeleteError('');
        }}
      />
    </>
  );
}
