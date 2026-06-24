import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AutocompleteField,
  CheckboxField,
  DateTimeField,
  MultiSelectField,
  PriorityField,
  SelectField,
  TextField,
  TextareaField,
} from '../../../../components/ui/fields';
import { useGetCounterpartyLookupQuery } from '../../../../store/rtk/counterpartyApi';
import { useGetContactsQuery } from '../../../../store/rtk/contactsApi';
import { toApiTask, toFormTask } from '../../../../schemas/task.schema';
import st from './TaskForm.module.css';

const TASK_STATUS = ['todo', 'in_progress', 'done', 'blocked', 'canceled'];
const MAX = { title: 300, category: 64, description: 4000 };
const EMPTY_OPTIONS = [];
const EMPTY_INITIAL = {};

// toBaseValues: вспомогательная логика компонента.
function toBaseValues(initial = {}) {
  const normalized = toFormTask(initial || {});
  return {
    title: '',
    description: '',
    category: '',
    status: 'todo',
    priority: 50,
    startAt: '',
    endAt: '',
    actualStartAt: '',
    actualEndAt: '',
    plannedStartHasTime: true,
    plannedEndHasTime: true,
    actualStartHasTime: true,
    actualEndHasTime: true,
    timezone: Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || 'Europe/Warsaw',
    statusAggregate: false,
    assigneeIds: [],
    watcherIds: [],
    counterpartyId: null,
    counterpartyName: '',
    contactIds: [],
    contacts: [],
    ...normalized,
  };
}

// contactLabel: вспомогательная логика компонента.
function contactLabel(contact = {}) {
  const full = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
  return full || contact.displayName || contact.email || contact.id;
}

// contactSecondary: вспомогательная логика компонента.
function contactSecondary(contact = {}) {
  const linkedCounterpartyName =
    contact.counterparty?.shortName ||
    contact.counterparty?.fullName ||
    contact.counterpartyName ||
    null;

  return [linkedCounterpartyName, contact.position || contact.jobTitle || contact.department || null, contact.phone || contact.email || null]
    .filter(Boolean)
    .join(' • ');
}

// Компонент TaskForm: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function TaskForm({
  id,
  initial = EMPTY_INITIAL,
  onSubmit,
  onCancel,
  loading = false,
  withButtons = true,
  lookups = {},
  currentUserId,
}) {
  const { t, i18n } = useTranslation();
  const formId = id || 'task-form';

  const userOptions = lookups.userOptions ?? EMPTY_OPTIONS;
  const [values, setValues] = useState(() => toBaseValues(initial));

  const [counterpartySearch, setCounterpartySearch] = useState('');
  const [counterpartySearchDebounced, setCounterpartySearchDebounced] = useState('');
  const [selectedCounterparty, setSelectedCounterparty] = useState(null);

  const [contactSearch, setContactSearch] = useState('');
  const [contactSearchDebounced, setContactSearchDebounced] = useState('');
  const [selectedContacts, setSelectedContacts] = useState([]);

  useEffect(() => {
    setValues(toBaseValues(initial));
  }, [initial]);

  useEffect(() => {
    const normalized = toFormTask(initial || {});
    const cpName = normalized.counterpartyName || '';
    setCounterpartySearch(cpName);
    setSelectedCounterparty(
      normalized.counterpartyId
        ? { id: normalized.counterpartyId, name: cpName || String(normalized.counterpartyId) }
        : null
    );
    const initialContacts = Array.isArray(initial?.contacts) ? initial.contacts : [];
    setSelectedContacts(
      initialContacts
        .filter((contact) => contact?.id)
        .map((contact) => ({
          id: contact.id,
          name: contactLabel(contact),
          secondary: contactSecondary(contact),
          counterpartyId: contact.counterpartyId || null,
        }))
    );
  }, [initial]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCounterpartySearchDebounced(String(counterpartySearch || '').trim());
    }, 320);
    return () => clearTimeout(timer);
  }, [counterpartySearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setContactSearchDebounced(String(contactSearch || '').trim());
    }, 280);
    return () => clearTimeout(timer);
  }, [contactSearch]);

  const { data: counterpartyLookup = [], isFetching: counterpartyLookupLoading } =
    useGetCounterpartyLookupQuery(
      { term: counterpartySearchDebounced, limit: 12 },
      { skip: counterpartySearchDebounced.length < 1 }
    );

  const contactQueryArgs = useMemo(() => ({
    limit: 20,
    page: 1,
    search: contactSearchDebounced || undefined,
    counterpartyId: values.counterpartyId || undefined,
    sortBy: 'firstName',
    sortOrder: 'ASC',
  }), [contactSearchDebounced, values.counterpartyId]);

  const { data: contactLookupData, isFetching: contactsLookupLoading } = useGetContactsQuery(contactQueryArgs, {
    skip: !values.counterpartyId && contactSearchDebounced.length < 1,
  });

  const contactLookupItems = useMemo(() => {
    const items = Array.isArray(contactLookupData?.items) ? contactLookupData.items : [];
    const selectedSet = new Set((values.contactIds || []).map(String));
    return items
      .filter((contact) => contact?.id && !selectedSet.has(String(contact.id)))
      .map((contact) => ({
        id: contact.id,
        name: contactLabel(contact),
        secondary: contactSecondary(contact),
        counterpartyId: contact.counterpartyId || null,
      }));
  }, [contactLookupData?.items, values.contactIds]);

  const watcherOptions = useMemo(() => {
    const ass = new Set(values.assigneeIds || []);
    return userOptions.filter((u) => !ass.has(u.value) && (!currentUserId || u.value !== currentUserId));
  }, [userOptions, values.assigneeIds, currentUserId]);

    // set: обновляет состояние компонента.
const set = (name, value) => setValues((prev) => ({ ...prev, [name]: value }));

    // handleSubmit: обработчик пользовательского действия.
const handleSubmit = async (e) => {
    e.preventDefault();
    await onSubmit(toApiTask(values));
  };

    // counter: вспомогательная логика компонента.
const counter = (name) => {
    const max = MAX[name];
    if (!max) return null;
    const val = values[name] ? String(values[name]) : '';
    return <span className={st.counter}>{val.length} / {max}</span>;
  };

    // renderDateField: описывает рендер соответствующего блока UI.
const renderDateField = (fieldName, hasTimeField, label) => {
    const hasTime = Boolean(values[hasTimeField]);
    const raw = String(values[fieldName] || '');
    const locale = i18n?.language || 'ru-RU';

        // handleWithTimeToggle: обработчик пользовательского действия.
const handleWithTimeToggle = (nextHasTime) => {
      set(hasTimeField, nextHasTime);
      if (!raw) return;

      if (nextHasTime) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          set(fieldName, `${raw}T00:00`);
        }
        return;
      }
      set(fieldName, raw.slice(0, 10));
    };

    return (
      <div className={`${st.field} ${st.span6}`}>
        <div className={st.labelRow}>
          <label className={st.label} htmlFor={`${formId}-${fieldName}`}>
            {label}
          </label>
        </div>
        <DateTimeField
          id={`${formId}-${fieldName}`}
          inputClassName={st.control}
          value={raw}
          withTime={hasTime}
          allowTimeToggle
          onWithTimeChange={handleWithTimeToggle}
          timeToggleLabel={t('crm.task.fields.withTime', 'With time')}
          locale={locale}
          onValueChange={(nextValue) => set(fieldName, nextValue)}
          placeholder={hasTime ? 'yyyy-mm-dd hh:mm' : 'yyyy-mm-dd'}
        />
      </div>
    );
  };

  return (
    <form id={formId} className={st.form} onSubmit={handleSubmit} noValidate>
      <div className={st.grid}>
        <div className={`${st.field} ${st.span12}`}>
          <div className={st.labelRow}>
            <label className={st.label} htmlFor={`${formId}-title`}>
              {t('crm.task.fields.title', 'Title')}*
            </label>
            {counter('title')}
          </div>
          <TextField
            id={`${formId}-title`}
            inputClassName={st.control}
            value={values.title}
            onValueChange={(v) => set('title', v)}
            maxLength={MAX.title}
            placeholder={t('crm.task.placeholders.title', 'Example: Call the client back')}
            required
          />
        </div>

        <div className={`${st.field} ${st.span12}`}>
          <div className={st.labelRow}>
            <label className={st.label} htmlFor={`${formId}-description`}>
              {t('crm.task.fields.description', 'Description')}
            </label>
            {counter('description')}
          </div>
          <TextareaField
            id={`${formId}-description`}
            inputClassName={`${st.control} ${st.textarea}`}
            rows={7}
            value={values.description || ''}
            onValueChange={(v) => set('description', v)}
            maxLength={MAX.description}
            placeholder={t('crm.task.placeholders.description', 'Briefly describe the task')}
          />
        </div>

        <div className={`${st.field} ${st.span6}`}>
          <label className={st.label} htmlFor={`${formId}-category`}>
            {t('crm.task.fields.category', 'Category')}
          </label>
          <TextField
            id={`${formId}-category`}
            inputClassName={st.control}
            value={values.category || ''}
            onValueChange={(v) => set('category', v)}
            maxLength={MAX.category}
            placeholder={t('crm.task.placeholders.category', 'E.g. call, meeting')}
          />
        </div>

        <div className={`${st.field} ${st.span3}`}>
          <label className={st.label}>{t('crm.task.fields.status', 'Status')}</label>
          <SelectField
            inputClassName={st.control}
            value={values.status || undefined}
            onValueChange={(val) => set('status', val)}
            options={TASK_STATUS.map((v) => ({
              value: v,
              label: t(`crm.task.enums.status.${v}`, v),
            }))}
            placeholder={t('common.select', 'Select…')}
          />
        </div>

        <div className={`${st.field} ${st.span3}`}>
          <label className={st.label}>{t('crm.task.fields.priority', 'Priority')}</label>
          <PriorityField
            inputClassName={st.priorityControl}
            value={values.priority}
            onValueChange={(n) => set('priority', n)}
          />
        </div>

        {renderDateField('startAt', 'plannedStartHasTime', t('crm.task.fields.startAt', 'Planned start'))}
        {renderDateField('endAt', 'plannedEndHasTime', t('crm.task.fields.endAt', 'Planned end'))}
        {renderDateField('actualStartAt', 'actualStartHasTime', t('crm.task.fields.actualStartAt', 'Actual start'))}
        {renderDateField('actualEndAt', 'actualEndHasTime', t('crm.task.fields.actualEndAt', 'Actual end'))}

        <div className={`${st.field} ${st.span6}`}>
          <label className={st.label}>{t('crm.task.fields.assignees', 'Assignees')}</label>
          <MultiSelectField
            inputClassName={st.control}
            options={userOptions}
            value={Array.isArray(values.assigneeIds) ? values.assigneeIds : []}
            onValueChange={(next) => set('assigneeIds', next)}
            placeholder={t('common.noneSelected', 'None selected')}
          />
        </div>

        <div className={`${st.field} ${st.span6}`}>
          <label className={st.label}>{t('crm.task.fields.watchers', 'Watchers')}</label>
          <MultiSelectField
            inputClassName={st.control}
            options={watcherOptions}
            value={Array.isArray(values.watcherIds) ? values.watcherIds : []}
            onValueChange={(next) => set('watcherIds', next)}
            placeholder={t('common.noneSelected', 'None selected')}
          />
        </div>

        <div className={`${st.field} ${st.span12}`}>
          <label className={st.label}>{t('crm.task.fields.counterparty', 'Client')}</label>
          <AutocompleteField
            value={selectedCounterparty}
            inputValue={counterpartySearch}
            onInputChange={(text) => {
              setCounterpartySearch(text);
              if (selectedCounterparty && text.trim() !== selectedCounterparty.name) {
                setSelectedCounterparty(null);
                set('counterpartyId', null);
                set('counterpartyName', '');
              }
            }}
            options={counterpartyLookup}
            onSelect={(opt) => {
              if (!opt) return;
              const nextId = String(opt.id);
              const changed = String(values.counterpartyId || '') !== nextId;
              setSelectedCounterparty(opt);
              setCounterpartySearch(opt.name || '');
              set('counterpartyId', nextId);
              set('counterpartyName', opt.name || '');
              if (changed) {
                setSelectedContacts([]);
                set('contactIds', []);
              }
            }}
            placeholder={t('crm.task.placeholders.counterpartySearch', 'Start typing a client name...')}
            hint={t('crm.task.messages.typeToSearch', 'Start typing a name')}
            searchingLabel={t('crm.task.messages.searching', 'Searching...')}
            emptyLabel={t('crm.task.messages.empty', 'Nothing found')}
            loading={Boolean(counterpartySearchDebounced) && counterpartyLookupLoading}
            getOptionPrimary={(opt) => opt?.name || String(opt?.id || '')}
            getOptionSecondary={(opt) =>
              [opt?.nip ? `NIP: ${opt.nip}` : null, opt?.email || null, opt?.city || null].filter(Boolean).join(' • ')
            }
            inputClassName={st.control}
            opaque
          />
        </div>

        <div className={`${st.field} ${st.span12}`}>
          <label className={st.label}>{t('crm.task.fields.contacts', 'Contacts')}</label>
          <AutocompleteField
            value={null}
            inputValue={contactSearch}
            onInputChange={setContactSearch}
            options={contactLookupItems}
            onSelect={(opt) => {
              if (!opt?.id) return;
              const idText = String(opt.id);
              const selected = new Set((values.contactIds || []).map(String));
              if (selected.has(idText)) return;
              const next = [...selected, idText];
              set('contactIds', next);
              setSelectedContacts((prev) => [...prev.filter((c) => String(c.id) !== idText), opt]);
              setContactSearch('');
              setContactSearchDebounced('');
            }}
            placeholder={t('crm.task.placeholders.contactSearch', 'Start typing a name, email, or phone...')}
            hint={
              values.counterpartyId
                ? t('crm.task.messages.typeToSearch', 'Start typing a name')
                : t('crm.task.messages.selectCounterpartyFirst', 'Select a client first or enter a search')
            }
            searchingLabel={t('crm.task.messages.searching', 'Searching...')}
            emptyLabel={t('crm.task.messages.emptyContacts', 'No contacts found')}
            loading={contactsLookupLoading}
            getOptionPrimary={(opt) => opt?.name || String(opt?.id || '')}
            getOptionSecondary={(opt) => opt?.secondary || ''}
            inputClassName={st.control}
            opaque
          />

          {values.contactIds?.length ? (
            <div className={st.selectedContacts}>
              {values.contactIds.map((contactId) => {
                const selected =
                  selectedContacts.find((item) => String(item.id) === String(contactId)) ||
                  contactLookupItems.find((item) => String(item.id) === String(contactId));

                return (
                  <span key={contactId} className={st.contactChip}>
                    <span className={st.contactChipText}>{selected?.name || contactId}</span>
                    <button
                      type="button"
                      className={st.contactChipRemove}
                      onClick={() => {
                        set('contactIds', values.contactIds.filter((idText) => String(idText) !== String(contactId)));
                        setSelectedContacts((prev) => prev.filter((item) => String(item.id) !== String(contactId)));
                      }}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className={`${st.field} ${st.span12}`}>
          <label className={st.switchLine}>
            <CheckboxField
              checked={!!values.statusAggregate}
              onValueChange={(v) => set('statusAggregate', v)}
              fullWidth={false}
            />
            <span>{t('crm.task.fields.statusAggregate', 'Calculate overall status from assignees')}</span>
          </label>
        </div>
      </div>

      {withButtons && (
        <div className={st.actions}>
          <button type="button" className={st.btn} onClick={onCancel}>
            {t('common.cancel', 'Cancel')}
          </button>
          <button type="submit" className={st.primary} disabled={loading}>
            {loading ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
          </button>
        </div>
      )}
    </form>
  );
}
