import { useNavigate, useParams } from 'react-router-dom';
import { useMemo, useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import EntityDetailPage from '../../../_scaffold/EntityDetailPage';
import { buildTaskSchema, toFormTask, toApiTask } from '../../../../schemas/task.schema';
import { useDeleteTaskMutation, useGetTaskQuery, useUpdateTaskMutation } from '../../../../store/rtk/tasksApi';
import { useListCounterpartiesQuery } from '../../../../store/rtk/counterpartyApi';
import { useGetContactsQuery } from '../../../../store/rtk/contactsApi';
import ConfirmDialog from '../../../../components/dialogs/ConfirmDialog';
import TaskDetailTabs from '../TaskDetailTabs';
import s from './TaskDetailPage.module.css';

/**
 * Детальная страница задачи на базе общего EntityDetailPage:
 * собирает справочники, форму и связывает save/load.
 */
export default function TaskDetailPage(){
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: base, isFetching } = useGetTaskQuery(id);
  const [updateTask, { isLoading: saving }] = useUpdateTaskMutation();
  const [deleteTask, { isLoading: deleting }] = useDeleteTaskMutation();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const members = useSelector((s) => s.bootstrap?.companyUsers || []);
  const currentUserId = useSelector((s) => s.auth?.currentUser?.id || null);
  const { data: counterpartiesData } = useListCounterpartiesQuery(
    { limit: 100, sort: 'shortName', dir: 'ASC' },
    { refetchOnMountOrArgChange: false }
  );
  const { data: contactsData } = useGetContactsQuery(
    { limit: 100, sort: 'createdAt', dir: 'DESC' },
    { refetchOnMountOrArgChange: false }
  );

  const tabs = useMemo(() => [
    { key: 'description', label: t('crm.task.detail.tabs.description') },
    { key: 'notes', label: t('crm.task.detail.tabs.notes') },
  ], [t]);

  // Нормализует контрагентов в единый формат option для form/select.
  const counterpartyOptions = useMemo(() => {
    const items = Array.isArray(counterpartiesData?.items) ? counterpartiesData.items : [];
    return items.map((cp) => ({
      value: cp.id,
      label: cp.shortName || cp.fullName || cp.id,
      secondary: [cp.nip ? `NIP: ${cp.nip}` : null, cp.city || null].filter(Boolean).join(' • ') || null,
      type: cp.type || null,
    }));
  }, [counterpartiesData?.items]);

  // Нормализует контакты в единый формат option для form/select.
  const contactOptions = useMemo(() => {
    const items = Array.isArray(contactsData?.items) ? contactsData.items : [];
    return items.map((contact) => {
      const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
      const linkedCounterpartyName =
        contact.counterparty?.shortName ||
        contact.counterparty?.fullName ||
        null;
      return {
        value: contact.id,
        label: fullName || contact.displayName || contact.email || contact.id,
        secondary: [linkedCounterpartyName || null, contact.position || contact.jobTitle || null, contact.phone || contact.email || null]
          .filter(Boolean)
          .join(' • ') || null,
        counterpartyId: contact.counterpartyId || contact.counterparty?.id || null,
      };
    });
  }, [contactsData?.items]);

  // Гарантирует, что текущий контрагент задачи присутствует в опциях формы.
  const counterpartyOptionsForForm = useMemo(() => {
    const map = new Map(counterpartyOptions.map((opt) => [String(opt.value), opt]));
    if (base?.counterparty?.id) {
      map.set(String(base.counterparty.id), {
        value: base.counterparty.id,
        label: base.counterparty.shortName || base.counterparty.fullName || base.counterparty.id,
        type: base.counterparty.type || null,
      });
    }
    return Array.from(map.values());
  }, [base?.counterparty, counterpartyOptions]);

  // Гарантирует, что связанные контакты задачи присутствуют в опциях формы.
  const contactOptionsForForm = useMemo(() => {
    const map = new Map(contactOptions.map((opt) => [String(opt.value), opt]));
    const counterpartyNameById = new Map(counterpartyOptionsForForm.map((opt) => [String(opt.value), opt.label]));
    const linked = Array.isArray(base?.contacts) ? base.contacts : [];
    linked.forEach((contact) => {
      const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
      const linkedCounterpartyName =
        counterpartyNameById.get(String(contact.counterpartyId || '')) ||
        null;
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

  // Индекс для быстрого доступа к контрагенту по id.
  const counterpartyById = useMemo(() => {
    return new Map(counterpartyOptionsForForm.map((opt) => [String(opt.value), opt]));
  }, [counterpartyOptionsForForm]);

  // Индекс для быстрого доступа к контакту по id.
  const contactById = useMemo(() => {
    return new Map(contactOptionsForForm.map((opt) => [String(opt.value), opt]));
  }, [contactOptionsForForm]);

  // Строит схему левой формы задачи с секциями и переопределениями по колонкам.
  const schemaBuilder = useMemo(() => (i18n) => {
    const baseSchema = buildTaskSchema(i18n, {
      members,
      currentUserId,
      counterpartyOptions: counterpartyOptionsForForm,
      contactOptions: contactOptionsForForm,
    });
        // pick: вспомогательная логика компонента.
const pick = (name, overrides = {}) => {
      const found = baseSchema.find((item) => item?.name === name);
      return found ? { ...found, ...overrides } : null;
    };

    return [
      { kind: 'section', title: 'crm.task.sections.basic' },
      pick('title', { cols: 4 }),
      pick('category', { cols: 2 }),
      pick('status', { cols: 2 }),
      pick('priority', { cols: 2 }),
      pick('creator', { cols: 2, disabled: true }),

      { kind: 'section', title: 'crm.task.sections.schedule' },
      pick('startAt', { cols: 2 }),
      pick('endAt', { cols: 2 }),
      pick('actualStartAt', { cols: 2 }),
      pick('actualEndAt', { cols: 2 }),

      { kind: 'section', title: 'crm.task.sections.participants' },
      pick('assigneeIds', { cols: 2 }),
      pick('watcherIds', { cols: 2 }),
      pick('counterpartyId', { cols: 2, type: 'dropdown-select-search' }),
      pick('contactIds', { cols: 2 }),

      { kind: 'section', title: 'crm.task.sections.links' },
      pick('dealId', { cols: 2 }),

      { kind: 'section', title: 'crm.task.sections.logic' },
      pick('statusAggregate', { cols: 4 }),
    ].filter(Boolean);
  }, [members, currentUserId, counterpartyOptionsForForm, contactOptionsForForm]);

  // Рендерит верхний связанный блок в левой колонке (клиент и контакты).
  const renderLeftTop = useCallback(({ values }) => {
    const counterpartyId = values?.counterpartyId ? String(values.counterpartyId) : '';
    const counterparty = counterpartyId ? counterpartyById.get(counterpartyId) : null;
    const contactIds = Array.isArray(values?.contactIds) ? values.contactIds.map(String) : [];

    return (
      <div className={s.relatedPanel}>
        <div className={s.relatedBlock}>
          <span className={s.relatedLabel}>{t('crm.task.fields.counterparty')}</span>
          {counterpartyId ? (
            <button
              type="button"
              className={s.entityChip}
              onClick={() => navigate(`/main/counterparties/${counterpartyId}`)}
            >
              {counterparty?.label || counterpartyId}
            </button>
          ) : (
            <span className={s.relatedEmpty}>—</span>
          )}
        </div>

        <div className={s.relatedBlock}>
          <span className={s.relatedLabel}>{t('crm.task.fields.contacts')}</span>
          {contactIds.length ? (
            <div className={s.entityChipList}>
              {contactIds.map((contactId) => (
                <button
                  key={contactId}
                  type="button"
                  className={s.entityChip}
                  onClick={() => navigate(`/main/contacts/${contactId}`)}
                >
                  {contactById.get(contactId)?.label || contactId}
                </button>
              ))}
            </div>
          ) : (
            <span className={s.relatedEmpty}>—</span>
          )}
        </div>
      </div>
    );
  }, [contactById, counterpartyById, navigate, t]);

  // Единая функция сохранения для EntityDetailPage.
  const save = async (entityId, payload) => {
    const saved = await updateTask({ id: entityId, payload }).unwrap();
    return saved;
  };

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

  if (!base && isFetching) return null;
  if (!base) return null;

  return (
    <>
      <EntityDetailPage
        id={id}
        tabs={tabs}
        tabsNamespace="crm.task.detail"
        schemaBuilder={schemaBuilder}
        toForm={toFormTask}
        toApi={toApiTask}
        isSaving={saving}
        load={async()=>base}
        save={save}
        storageKeyPrefix="task"
        autosave={{ debounceMs: 500 }}
        saveOnExit
        clearDraftOnUnmount
        leftTop={renderLeftTop}
        leftExtras={(
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
        )}
        RightTabsComponent={TaskDetailTabs}
        layoutClassName={s.layout}
        leftPaneClassName={s.leftPane}
        rightPaneClassName={s.rightPane}
        tabsClassName={s.tabsArea}
        panelClassName={s.panel}
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
