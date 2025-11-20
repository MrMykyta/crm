// src/pages/.../TaskForm/index.jsx
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MultiSelectDropdown from '../../../../components/inputs/MultiSelectDropdown';
import PriorityInput from '../../../../components/inputs/PriorityInput';
import ThemedSelect from '../../../../components/inputs/RadixSelect';

import st from './TaskForm.module.css';

const TASK_STATUS = ['todo', 'in_progress', 'done', 'blocked', 'canceled'];
const MAX = { title: 300, category: 64, description: 4000 };

const trimOrNull = (v) => (v == null ? null : String(v).trim() || null);
const clampPriority = (x) => {
  const n = parseInt(x, 10);
  return Number.isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
};
const toInputDT = (v) => {
  if (!v) return '';
  const d = new Date(v);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fromInputDT = (s) => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export default function TaskForm({
  id,
  initial = {},
  onSubmit,
  onCancel,
  loading = false,
  withButtons = true,
  lookups = {},
  currentUserId,
}) {
  const { t } = useTranslation();

  const userOptions = lookups.userOptions || [];
  const contactOptions = lookups.contactOptions || [];
  const counterpartyOptions = lookups.counterpartyOptions || [];

  const [values, setValues] = useState({
    title: '',
    description: '',
    category: '',
    status: 'todo',
    priority: 50,
    startAt: null,
    endAt: null,
    timezone: Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || 'Europe/Warsaw',
    statusAggregate: false,
    remindOnStart: false,
    remindOnEnd: false,
    assigneeIds: [],
    watcherIds: [],
    counterpartyId: null,
    contactIds: [],
    ...initial,
  });

  const watcherOptions = useMemo(() => {
    const ass = new Set(values.assigneeIds || []);
    return userOptions.filter(
      (u) => !ass.has(u.value) && (!currentUserId || u.value !== currentUserId)
    );
  }, [userOptions, values.assigneeIds, currentUserId]);

  const set = (name, value) => setValues((v) => ({ ...v, [name]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSubmit(values);
  };

  const counter = (name) => {
    const max = MAX[name];
    if (!max) return null;
    const val = values[name] ? String(values[name]) : '';
    return <span className={st.counter}>{val.length} / {max}</span>;
  };

  return (
    <form id={id} className={st.form} onSubmit={handleSubmit}>
      <div className={st.grid}>
        {/* Название */}
        <div className={st.full}>
          <div className={st.field}>
            <label className={st.label}>
              {t('crm.task.fields.title', 'Название')}* {counter('title')}
            </label>
            <input
              className={st.input}
              value={values.title}
              onChange={(e) => set('title', e.target.value)}
              maxLength={MAX.title}
              placeholder={t('crm.task.placeholders.title', 'Например: Перезвонить клиенту')}
              required
            />
          </div>
        </div>

        {/* Описание */}
        <div className={st.full}>
          <div className={st.field}>
            <label className={st.label}>
              {t('crm.task.fields.description', 'Описание')} {counter('description')}
            </label>
            <textarea
              className={st.input}
              rows={6}
              value={values.description || ''}
              onChange={(e) => set('description', e.target.value)}
              maxLength={MAX.description}
            />
          </div>
        </div>

        {/* Категория + Статус */}
        <div className={st.row2}>
          <div className={st.field}>
            <label className={st.label}>{t('crm.task.fields.category', 'Категория')}</label>
            <input
              className={st.input}
              value={values.category || ''}
              onChange={(e) => set('category', e.target.value)}
              placeholder={t('crm.task.placeholders.category', 'Напр.: Звонок, Встреча')}
            />
          </div>

          <div className={st.field}>
            <label className={st.label}>{t('crm.task.fields.status', 'Статус')}</label>
            <div className={st.rel}>
              <ThemedSelect
                className={`${st.input} ${st.padForDot}`}
                value={values.status || undefined}
                onChange={(val) => set('status', val)}
                options={TASK_STATUS.map((v) => ({
                  value: v,
                  label: t(`crm.task.enums.status.${v}`, v),
                }))}
                placeholder={t('common.select', 'Выбрать…')}
              />
              <button
                type="button"
                className={`${st.dotSwitch} ${st.dotGreen} ${st.absDot}`}
                data-on={values.statusAggregate ? '1' : '0'}
                onClick={() => set('statusAggregate', !values.statusAggregate)}
              >
                <span className={st.dotInner} />
              </button>
            </div>
          </div>
        </div>

        {/* Начало + Окончание + Приоритет */}
        <div className={st.row3}>
          <div className={st.field}>
            <label className={st.label}>{t('crm.task.fields.startAt', 'Начало')}</label>
            <div className={st.rel}>
              <input
                type="datetime-local"
                className={`${st.input} ${st.padForDot}`}
                value={toInputDT(values.startAt)}
                onChange={(e) => set('startAt', fromInputDT(e.target.value))}
              />
              <button
                type="button"
                className={`${st.dotSwitch} ${st.dotRed} ${st.absDot}`}
                data-on={values.remindOnStart ? '1' : '0'}
                onClick={() => set('remindOnStart', !values.remindOnStart)}
              >
                <span className={st.dotInner} />
              </button>
            </div>
          </div>

          <div className={st.field}>
            <label className={st.label}>{t('crm.task.fields.endAt', 'Окончание')}</label>
            <div className={st.rel}>
              <input
                type="datetime-local"
                className={`${st.input} ${st.padForDot}`}
                value={toInputDT(values.endAt)}
                onChange={(e) => set('endAt', fromInputDT(e.target.value))}
              />
              <button
                type="button"
                className={`${st.dotSwitch} ${st.dotRed} ${st.absDot}`}
                data-on={values.remindOnEnd ? '1' : '0'}
                onClick={() => set('remindOnEnd', !values.remindOnEnd)}
              >
                <span className={st.dotInner} />
              </button>
            </div>
          </div>

          <div className={st.field}>
            <label className={st.label}>{t('crm.task.fields.priority', 'Приоритет')}</label>
            <PriorityInput
              value={values.priority}
              onChange={(n) => set('priority', n)}
            />
          </div>
        </div>

        {/* Назначенные + Наблюдатели */}
        <div className={st.row2}>
          <div className={st.field}>
            <label className={st.label}>{t('crm.task.fields.assignees', 'Назначенные работники')}</label>
            <MultiSelectDropdown
              options={userOptions}
              value={values.assigneeIds}
              onChange={(next) => set('assigneeIds', next)}
              placeholder={t('common.noneSelected', 'Не выбрано')}
              searchable
              showSelectAll
            />
          </div>

          <div className={st.field}>
            <label className={st.label}>{t('crm.task.fields.watchers', 'Наблюдатели')}</label>
            <MultiSelectDropdown
              options={watcherOptions}
              value={values.watcherIds}
              onChange={(next) => set('watcherIds', next)}
              placeholder={t('common.noneSelected', 'Не выбрано')}
              searchable
              showSelectAll
            />
          </div>
        </div>

        {/* Клиент + Контактные лица */}
        <div className={st.row2}>
          <div className={st.field}>
            <label className={st.label}>{t('crm.task.fields.counterparty', 'Клиент')}</label>
            <ThemedSelect
              className={st.input}
              value={values.counterpartyId || undefined}
              onChange={(val) => set('counterpartyId', val || null)}
              options={counterpartyOptions}
              placeholder={t('common.none', '—')}
              searchable
              clearable
            />
          </div>

          <div className={st.field}>
            <label className={st.label}>{t('crm.task.fields.contacts', 'Контактные лица')}</label>
            <MultiSelectDropdown
              options={contactOptions}
              value={values.contactIds}
              onChange={(next) => set('contactIds', next)}
              placeholder={t('common.noneSelected', 'Не выбрано')}
              searchable
              showSelectAll
            />
          </div>
        </div>
      </div>

      {withButtons && (
        <div className={st.actions}>
          <button type="button" className={st.btn} onClick={onCancel}>
            {t('common.cancel', 'Отмена')}
          </button>
          <button type="submit" className={st.primary} disabled={loading}>
            {loading ? t('common.saving', 'Сохранение…') : t('common.save', 'Сохранить')}
          </button>
        </div>
      )}
    </form>
  );
}