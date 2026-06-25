import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Trash2, ClipboardList } from 'lucide-react';

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
  VisibilityField,
} from '../../../../components/ui/fields';
import { TASK_STATUS, formatTaskDate, toApiTask, toFormTask } from '../../../../schemas/task.schema';
import { useListCounterpartiesQuery } from '../../../../store/rtk/counterpartyApi';
import { useGetContactsQuery } from '../../../../store/rtk/contactsApi';
import { useListDepartmentsQuery } from '../../../../store/rtk/departmentsApi';
import { useDeleteTaskMutation, useGetTaskQuery, useUpdateTaskMutation } from '../../../../store/rtk/tasksApi';
import DescriptionForm from '../sections/DescriptionForm';
import s from './TaskDetailPage.module.css';

const EMPTY_OPTIONS = [];
const SAVE_DEBOUNCE_MS = 500;

function memberLabel(member = {}) {
  return member.name
    || [member.firstName, member.lastName].filter(Boolean).join(' ').trim()
    || member.displayName
    || member.email
    || member.id
    || '—';
}

function getPriorityTone(priority) {
  const value = Number(priority || 0);
  if (value >= 75) return 'danger';
  if (value >= 50) return 'warning';
  if (value >= 25) return 'info';
  return 'muted';
}

function getStatusTone(status) {
  if (status === 'done') return 'success';
  if (status === 'blocked' || status === 'canceled') return 'danger';
  if (status === 'in_progress') return 'info';
  return 'neutral';
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

export default function TaskDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { data: base, isFetching } = useGetTaskQuery(id);
  const [updateTask, { isLoading: saving }] = useUpdateTaskMutation();
  const [deleteTask, { isLoading: deleting }] = useDeleteTaskMutation();
  const [values, setValues] = useState(() => normalizeInitialTask(null));
  const [loadedTaskId, setLoadedTaskId] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedAt, setSavedAt] = useState(null);
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
    if (!base?.id) return;
    if (loadedTaskId !== base.id || !dirty) {
      setValues(normalizeInitialTask(base));
      setLoadedTaskId(base.id);
      setDirty(false);
      setSaveError('');
    }
  }, [base, dirty, loadedTaskId]);

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
    if (!id || !dirty || saving) return null;
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
  }, [dirty, id, saving, t, updateTask, values]);

  useEffect(() => {
    if (!dirty || !id) return undefined;
    const timer = setTimeout(() => {
      performSave('autosave');
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [dirty, id, performSave, values]);

  const confirmDelete = async () => {
    if (!id || deleting) return;
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
  const priorityLabel = t('crm.task.detail.priorityValue', { value: values.priority ?? 0 });
  const visibilityValue = values.visibility || 'company';
  const visibilityDepartment = values.visibilityDepartmentId
    ? departmentById.get(String(values.visibilityDepartmentId))
    : null;
  const visibilityLabel = visibilityValue === 'department' && visibilityDepartment
    ? `${t('visibility.department')} · ${visibilityDepartment.name || visibilityDepartment.code || visibilityDepartment.id}`
    : t(`visibility.${visibilityValue}`, t('visibility.company'));
  const taskTitle = values.title || base?.title || t('crm.task.detail.untitled');
  const hasParticipants = Boolean((values.assigneeIds || []).length || (values.watcherIds || []).length);
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

  const participantsPanel = (
    <div className={s.tabStack}>
      <DetailSection
        title={t('crm.task.detail.sections.participants')}
        subtitle={hasParticipants ? t('crm.task.detail.summary.participantsAssigned') : undefined}
      >
        <div className={s.formStack}>
          {!hasParticipants ? (
            <div className={s.compactSummary}>
              <span>{t('crm.task.detail.fields.assignee')}</span>
              <strong>{t('crm.task.detail.summary.unassigned')}</strong>
              <span>{t('crm.task.fields.watchers')}</span>
              <strong>{t('crm.task.detail.summary.noWatchers')}</strong>
            </div>
          ) : null}
          <div className={s.twoColumn}>
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

  const tabs = [
    {
      key: 'description',
      label: t('crm.task.detail.tabs.description'),
      children: (
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
      ),
    },
    {
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
    },
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
    {
      key: 'additional',
      label: t('crm.task.detail.tabs.additional'),
      children: additionalPanel,
    },
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
              min={0}
              max={100}
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

      <DetailSection title={t('crm.task.detail.sections.planning')}>
        <div className={s.formStack}>
          <div className={s.dateGroup}>
            <div className={s.groupLabel}>{t('crm.task.detail.groups.planned')}</div>
            {dateField('startAt', 'plannedStartHasTime', 'crm.task.fields.startAt')}
            {dateField('endAt', 'plannedEndHasTime', 'crm.task.fields.endAt')}
          </div>
          <details className={s.inlineDetails} open={hasActualDates}>
            <summary>
              <span>{t('crm.task.detail.groups.actual')}</span>
              <em>{hasActualDates ? t('crm.task.detail.summary.hasActualDates') : t('crm.task.detail.summary.noActualDates')}</em>
            </summary>
            <div className={s.twoColumn}>
              {dateField('actualStartAt', 'actualStartHasTime', 'crm.task.fields.actualStartAt')}
              {dateField('actualEndAt', 'actualEndHasTime', 'crm.task.fields.actualEndAt')}
            </div>
          </details>
        </div>
      </DetailSection>
    </div>
  );

  if (!base && isFetching) return null;
  if (!base) return null;

  return (
    <>
      <DetailLayout
        mode="entity"
        className={s.detailLayout}
        breadcrumbs={[
          { label: t('crm.task.title', 'Tasks'), to: '/main/tasks' },
          { label: taskTitle },
        ]}
        title={taskTitle}
        subtitle={t('crm.task.detail.subtitle', {
          status: statusLabel,
          assignees: (values.assigneeIds || []).map((assigneeId) => userById.get(String(assigneeId))?.label).filter(Boolean).join(', ') || t('common.none'),
        })}
        icon={<ClipboardList size={18} aria-hidden="true" />}
        status={{ value: values.status, label: statusLabel, tone: getStatusTone(values.status) }}
        priority={{ value: values.priority, label: priorityLabel, tone: getPriorityTone(values.priority) }}
        actions={[
          {
            key: 'back',
            label: t('crm.task.detail.actions.back'),
            icon: <ArrowLeft size={14} aria-hidden="true" />,
            onClick: async () => {
              try {
                if (dirty) await performSave('manual');
                navigate('/main/tasks');
              } catch {
                // Save state in the header already shows the backend error.
              }
            },
          },
        ]}
        primaryAction={dirty ? {
          key: 'save',
          label: t('common.save'),
          disabled: saving,
          onClick: () => performSave('manual'),
        } : null}
        overflowActions={[
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
          saving,
          dirty,
          error: saveError,
          label: saveError
            || (saving ? t('common.saving') : dirty ? t('common.unsaved') : savedAt ? t('crm.task.detail.messages.saved') : t('common.saved')),
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
