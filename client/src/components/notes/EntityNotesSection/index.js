import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import AddButton from '../../buttons/AddButton/AddButton';
import ConfirmDialog from '../../dialogs/ConfirmDialog';
import { CheckboxField, SearchField, SelectField, TextareaField, TextField, VisibilityField } from '../../ui/fields';
import {
  useGetNotesQuery,
  useCreateNoteMutation,
  useUpdateNoteMutation,
  useDeleteNoteMutation,
} from '../../../store/rtk/notesApi';
import { useListDepartmentsQuery } from '../../../store/rtk/departmentsApi';
import s from './EntityNotesSection.module.css';

const OWNER_TYPES = ['counterparty', 'deal', 'task', 'contact', 'company', 'department', 'user', 'order', 'offer', 'product'];

// getAuthorLabel: возвращает вычисленное значение для UI.
function getAuthorLabel(note) {
  const first = note?.author?.firstName || '';
  const last = note?.author?.lastName || '';
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full || note?.author?.email || '—';
}

// formatDate: форматирует данные для отображения.
function formatDate(value, locale) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(+d)) return '—';
  return d.toLocaleString(locale || undefined);
}

// initialDraft: вспомогательная логика компонента.
function initialDraft({ fixedOwnerType, fixedOwnerId, ownerType, ownerId }) {
  return {
    ownerType: fixedOwnerType || ownerType || '',
    ownerId: fixedOwnerId || ownerId || '',
    visibility: 'company',
    visibilityDepartmentId: '',
    pinned: false,
    content: '',
  };
}

// Компонент EntityNotesSection: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function EntityNotesSection({
  ownerType: fixedOwnerType,
  ownerId: fixedOwnerId,
  title = 'Заметки',
  limit = 20,
  className = '',
  compact = false,
  hideFiltersWhenEmpty = false,
  hidePagerWhenSingle = false,
  emptyTitle = 'Заметок не найдено.',
  emptyText = '',
  addNoteLabel = 'Добавить заметку',
  refreshLabel = 'Обновить',
}) {
  const { t, i18n } = useTranslation();
  const currentUserId = useSelector((state) => state.auth?.currentUser?.id || null);
  const fixedOwner = Boolean(fixedOwnerType && fixedOwnerId);
  const { data: departmentsData } = useListDepartmentsQuery({ limit: 100 });

  const [query, setQuery] = useState({
    page: 1,
    limit,
    ownerType: fixedOwnerType || '',
    ownerId: fixedOwnerId || '',
    visibility: '',
    pinned: '',
    search: '',
  });

  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formError, setFormError] = useState('');
  const [draft, setDraft] = useState(() =>
    initialDraft({
      fixedOwnerType,
      fixedOwnerId,
      ownerType: '',
      ownerId: '',
    })
  );

  const [createNote, { isLoading: isCreating }] = useCreateNoteMutation();
  const [updateNote, { isLoading: isUpdating }] = useUpdateNoteMutation();
  const [deleteNote, { isLoading: isDeleting }] = useDeleteNoteMutation();
  const departments = useMemo(
    () => (Array.isArray(departmentsData) ? departmentsData : []),
    [departmentsData]
  );
  const departmentById = useMemo(
    () => new Map(departments.map((department) => [String(department.id), department])),
    [departments]
  );
  const ownerTypeOptions = useMemo(
    () => [
      { value: '', label: t('notes.filters.allOwnerTypes', 'All types') },
      ...OWNER_TYPES.map((value) => ({ value, label: t(`notes.ownerTypes.${value}`, value) })),
    ],
    [t]
  );
  const visibilityOptions = useMemo(
    () => [
      { value: '', label: t('visibility.all') },
      { value: 'company', label: t('visibility.company') },
      { value: 'private', label: t('visibility.private') },
      { value: 'department', label: t('visibility.department') },
    ],
    [t]
  );
  const pinnedOptions = useMemo(
    () => [
      { value: '', label: t('notes.filters.allPinned', 'Any pin') },
      { value: 'true', label: t('notes.filters.onlyPinned', 'Pinned only') },
      { value: 'false', label: t('notes.filters.onlyUnpinned', 'Unpinned only') },
    ],
    [t]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(String(query.search || '').trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [query.search]);

  useEffect(() => {
    if (!fixedOwner) return;
    setQuery((prev) => ({
      ...prev,
      page: 1,
      ownerType: fixedOwnerType,
      ownerId: fixedOwnerId,
    }));
  }, [fixedOwner, fixedOwnerType, fixedOwnerId]);

  const listArgs = useMemo(() => {
    const args = {
      page: query.page,
      limit: query.limit,
      sort: 'createdAt',
      dir: 'DESC',
    };

    const ownerType = fixedOwner ? fixedOwnerType : String(query.ownerType || '').trim();
    const ownerId = fixedOwner ? fixedOwnerId : String(query.ownerId || '').trim();

    if (ownerType) args.ownerType = ownerType;
    if (ownerId) args.ownerId = ownerId;
    if (query.visibility) args.visibility = query.visibility;
    if (query.pinned) args.pinned = query.pinned === 'true';
    if (debouncedSearch) args.search = debouncedSearch;

    return args;
  }, [
    query.page,
    query.limit,
    query.visibility,
    query.pinned,
    query.ownerType,
    query.ownerId,
    fixedOwner,
    fixedOwnerType,
    fixedOwnerId,
    debouncedSearch,
  ]);

  const { data, isFetching, error, refetch } = useGetNotesQuery(listArgs);

  const items = data?.items || [];
  const total = Number(data?.total || 0);
  const visibleCount = Math.max(total, items.length);
  const totalPages = Math.max(1, Math.ceil(total / (query.limit || 1)));
  const hasActiveFilters = Boolean(
    query.search
    || query.visibility
    || query.pinned
    || (!fixedOwner && (query.ownerType || query.ownerId))
  );
  const showFilters = compact
    ? hasActiveFilters || visibleCount > 5
    : !(hideFiltersWhenEmpty && !isFetching && items.length === 0 && !hasActiveFilters);
  const showPager = !(hidePagerWhenSingle && totalPages <= 1);

  const saving = isCreating || isUpdating;

    // resetForm: вспомогательная логика компонента.
const resetForm = () => {
    setDraft(
      initialDraft({
        fixedOwnerType,
        fixedOwnerId,
        ownerType: query.ownerType,
        ownerId: query.ownerId,
      })
    );
    setEditing(null);
    setFormError('');
  };

    // openCreate: открывает связанный UI-элемент.
const openCreate = () => {
    resetForm();
    setComposerOpen((prev) => !prev);
  };

    // openEdit: открывает связанный UI-элемент.
const openEdit = (note) => {
    setEditing(note);
    setDraft({
      ownerType: note?.ownerType || fixedOwnerType || query.ownerType || '',
      ownerId: note?.ownerId || fixedOwnerId || query.ownerId || '',
      visibility: note?.visibility || 'company',
      visibilityDepartmentId: note?.visibilityDepartmentId || note?.visibility_department_id || '',
      pinned: Boolean(note?.pinned),
      content: note?.content || '',
    });
    setFormError('');
    setComposerOpen(true);
  };

    // closeComposer: закрывает связанный UI-элемент.
const closeComposer = () => {
    setComposerOpen(false);
    resetForm();
  };

    // submit: вспомогательная логика компонента.
const submit = async (event) => {
    event?.preventDefault();
    setFormError('');

    const ownerType = fixedOwner ? fixedOwnerType : String(draft.ownerType || '').trim();
    const ownerId = fixedOwner ? fixedOwnerId : String(draft.ownerId || '').trim();
    const content = String(draft.content || '').trim();

    if (!ownerType) {
      setFormError('Выберите ownerType.');
      return;
    }
    if (!ownerId) {
      setFormError('Укажите ownerId.');
      return;
    }
    if (!content) {
      setFormError(t('notes.validation.contentRequired', 'Note content is required.'));
      return;
    }
    if (draft.visibility === 'department' && !draft.visibilityDepartmentId) {
      setFormError(t('visibility.departmentRequired'));
      return;
    }

    const payload = {
      ownerType,
      ownerId,
      visibility: draft.visibility || 'company',
      pinned: Boolean(draft.pinned),
      content,
    };
    if (draft.visibility === 'department') {
      payload.visibilityDepartmentId = draft.visibilityDepartmentId || null;
    } else {
      payload.visibilityDepartmentId = null;
    }

    try {
      if (editing?.id) {
        await updateNote({ id: editing.id, payload }).unwrap();
      } else {
        await createNote(payload).unwrap();
      }
      closeComposer();
    } catch (e) {
      setFormError(e?.data?.error || e?.data?.message || e?.message || t('notes.validation.saveFailed', 'Failed to save note.'));
    }
  };

    // onDelete: вспомогательная логика компонента.
const onDelete = async (note) => {
    if (!note?.id) return;
    setDeleteTarget(note);
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return;

    try {
      await deleteNote(deleteTarget.id).unwrap();
      setDeleteTarget(null);
    } catch {
      // fallback handled by refetch + error state
    }
  };

    // onTogglePin: вспомогательная логика компонента.
const onTogglePin = async (note) => {
    if (!note?.id) return;
    try {
      await updateNote({ id: note.id, payload: { pinned: !note.pinned } }).unwrap();
    } catch {
      // noop
    }
  };

    // canManage: проверяет, доступно ли действие в текущем UI-состоянии.
const canManage = (note) => String(note?.author?.id || '') === String(currentUserId || '');

  const errorText =
    error?.data?.error || error?.data?.message || error?.error || error?.message || '';
  const getVisibilityLabel = (note) => {
    const visibility = note?.visibility || 'company';
    if (visibility !== 'department') return t(`visibility.${visibility}`, t('visibility.company'));
    const departmentId = note?.visibilityDepartmentId || note?.visibility_department_id || '';
    const department = note?.visibilityDepartment || note?.department || departmentById.get(String(departmentId));
    const name = department?.name || department?.code || departmentId;
    return name ? `${t('visibility.department')} · ${name}` : t('visibility.department');
  };

  const composerForm = (
    <form className={`${s.form} ${compact ? s.modalCard : s.composerCard}`} onSubmit={submit}>
      <div className={s.composerHeader}>
        <div>
          <div className={s.composerTitle}>
            {editing ? t('notes.modal.editTitle', 'Edit note') : t('notes.modal.createTitle', 'New note')}
          </div>
          <p>{t('notes.modal.subtitle', 'Keep task context visible for the team.')}</p>
        </div>
      </div>

      {!fixedOwner && (
        <div className={s.row2}>
          <label className={s.field}>
            <span className={s.label}>{t('notes.fields.ownerType', 'Entity type')}</span>
            <SelectField
              inputClassName={s.select}
              value={draft.ownerType}
              onValueChange={(value) => setDraft((prev) => ({ ...prev, ownerType: value }))}
              options={ownerTypeOptions.filter((opt) => opt.value)}
            />
          </label>

          <label className={s.field}>
            <span className={s.label}>{t('notes.fields.selectedId', 'ID')}</span>
            <TextField
              inputClassName={s.input}
              value={draft.ownerId}
              onValueChange={(value) =>
                setDraft((prev) => ({ ...prev, ownerId: String(value || '').trim() }))
              }
            />
          </label>
        </div>
      )}

      <div className={s.row2}>
        <VisibilityField
          className={s.field}
          inputClassName={s.select}
          value={draft.visibility}
          departmentId={draft.visibilityDepartmentId}
          departments={departments}
          onChange={({ visibility, visibilityDepartmentId }) =>
            setDraft((prev) => ({ ...prev, visibility, visibilityDepartmentId }))
          }
        />

        <CheckboxField
          className={s.checkboxRow}
          checked={Boolean(draft.pinned)}
          onValueChange={(checked) => setDraft((prev) => ({ ...prev, pinned: checked }))}
          label={t('notes.fields.pinned', 'Pinned')}
        />
      </div>

      <label className={s.field}>
        <span className={s.label}>{t('notes.fields.content', 'Note text')}</span>
        <TextareaField
          inputClassName={s.textarea}
          rows={fixedOwner ? 5 : 8}
          value={draft.content}
          onValueChange={(value) => setDraft((prev) => ({ ...prev, content: value }))}
          placeholder={t('notes.placeholders.content', 'Enter note text')}
        />
      </label>

      {formError && <div className={s.error}>{formError}</div>}

      <div className={s.composerActions}>
        <button type="button" className={s.btn} onClick={closeComposer} disabled={saving}>
          {t('common.cancel')}
        </button>
        <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={saving}>
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </form>
  );

  return (
    <>
    <section className={`${s.wrap} ${compact ? s.compact : ''} ${className}`.trim()}>
      <div className={s.headerRow}>
        <h3 className={s.title}>{title}</h3>
        <div className={s.headerActions}>
          <button type="button" className={s.btn} onClick={() => refetch()}>
            {refreshLabel}
          </button>
          <AddButton onClick={openCreate}>
            {composerOpen && !editing ? t('common.hide', 'Hide form') : addNoteLabel}
          </AddButton>
        </div>
      </div>

      {showFilters ? (
        <div className={`${s.filters} ${compact ? s.compactFilters : ''}`.trim()}>
          <SearchField
            inputClassName={s.input}
            value={query.search}
            placeholder="Поиск по тексту"
            onValueChange={(value) => setQuery((prev) => ({ ...prev, page: 1, search: value }))}
          />

          {!fixedOwner && (
            <>
              <SelectField
                inputClassName={s.select}
                value={query.ownerType}
                onValueChange={(value) =>
                  setQuery((prev) => ({ ...prev, page: 1, ownerType: value, ownerId: '' }))
                }
                options={ownerTypeOptions}
              />

              <TextField
                inputClassName={s.input}
                value={query.ownerId}
                placeholder="ownerId"
                onValueChange={(value) =>
                  setQuery((prev) => ({ ...prev, page: 1, ownerId: String(value || '').trim() }))
                }
              />
            </>
          )}

          <SelectField
            inputClassName={s.select}
            value={query.visibility}
            onValueChange={(value) => setQuery((prev) => ({ ...prev, page: 1, visibility: value }))}
            options={visibilityOptions}
          />

          <SelectField
            inputClassName={s.select}
            value={query.pinned}
            onValueChange={(value) => setQuery((prev) => ({ ...prev, page: 1, pinned: value }))}
            options={pinnedOptions}
          />
        </div>
      ) : null}

      {errorText && <div className={s.error}>{String(errorText)}</div>}

      <div className={s.list}>
        {isFetching ? (
          <div className={s.empty}>Загрузка…</div>
        ) : items.length === 0 ? (
          <div className={s.empty}>
            <strong>{emptyTitle}</strong>
            {emptyText ? <span>{emptyText}</span> : null}
            {compact ? (
              <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={openCreate}>
                {addNoteLabel}
              </button>
            ) : null}
          </div>
        ) : (
          items.map((note) => {
            const editable = canManage(note);
            return (
              <article key={note.id} className={s.card}>
                <div className={s.cardTop}>
                  <div className={s.badges}>
                    {!fixedOwner ? (
                      <span className={s.badge}>{note.ownerType}:{note.ownerId}</span>
                    ) : null}
                    <span
                      className={`${s.badge} ${note.visibility === 'private' ? s.badgePrivate : note.visibility === 'department' ? s.badgeDepartment : s.badgeCompany}`}
                      title={t(`visibility.tooltip.${note.visibility || 'company'}`, '')}
                    >
                      {getVisibilityLabel(note)}
                    </span>
                    {note.pinned && <span className={s.badgePinned}>{t('notes.fields.pinned', 'Pinned')}</span>}
                  </div>

                  {editable && (
                    <div className={s.rowActions}>
                      <button type="button" className={s.link} onClick={() => onTogglePin(note)}>
                        {note.pinned ? t('notes.actions.unpin', 'Unpin') : t('notes.actions.pin', 'Pin')}
                      </button>
                      <button type="button" className={s.link} onClick={() => openEdit(note)}>
                        {t('notes.actions.edit', 'Edit')}
                      </button>
                      <button
                        type="button"
                        className={s.linkDanger}
                        disabled={isDeleting}
                        onClick={() => onDelete(note)}
                      >
                        {t('notes.actions.delete', 'Delete')}
                      </button>
                    </div>
                  )}
                </div>

                <div className={s.content}>{note.content}</div>

                <div className={s.meta}>
                  <span>{t('notes.table.author', 'Author')}: {getAuthorLabel(note)}</span>
                  <span>{t('notes.table.createdAt', 'Created')}: {formatDate(note.createdAt, i18n.language)}</span>
                  <span>{t('notes.table.updatedAt', 'Updated')}: {formatDate(note.updatedAt, i18n.language)}</span>
                </div>
              </article>
            );
          })
        )}
      </div>

      {showPager ? (
        <div className={s.pager}>
          <span className={s.count}>
            {total > 0
              ? t('common.rangeOfTotal', { start: (query.page - 1) * query.limit + 1, end: Math.min(query.page * query.limit, total), total, defaultValue: `${(query.page - 1) * query.limit + 1}-${Math.min(query.page * query.limit, total)} / ${total}` })
              : t('common.zeroOfTotal', '0 / 0')}
          </span>
          <div className={s.pagerActions}>
            <button
              type="button"
              className={s.btn}
              disabled={query.page <= 1}
              onClick={() => setQuery((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            >
              {t('common.back', 'Back')}
            </button>
            <span className={s.pageBadge}>{query.page} / {totalPages}</span>
            <button
              type="button"
              className={s.btn}
              disabled={query.page >= totalPages}
              onClick={() => setQuery((prev) => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
            >
              {t('common.next', 'Next')}
            </button>
          </div>
        </div>
      ) : null}

      {composerOpen ? (
        compact ? (
          <div className={s.modalOverlay} role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeComposer();
          }}>
            {composerForm}
          </div>
        ) : composerForm
      ) : null}
    </section>
    <ConfirmDialog
      open={Boolean(deleteTarget)}
      title={t('notes.confirm.deleteTitle', 'Delete note?')}
      text={t('notes.confirm.deleteText', 'This action cannot be undone.')}
      danger
      loading={isDeleting}
      okText={t('common.delete')}
      cancelText={t('common.cancel')}
      onOk={confirmDelete}
      onCancel={() => {
        if (!isDeleting) setDeleteTarget(null);
      }}
    />
    </>
  );
}
