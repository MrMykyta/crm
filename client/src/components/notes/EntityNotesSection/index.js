import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import AddButton from '../../buttons/AddButton/AddButton';
import { CheckboxField, SearchField, SelectField, TextareaField, TextField } from '../../ui/fields';
import {
  useGetNotesQuery,
  useCreateNoteMutation,
  useUpdateNoteMutation,
  useDeleteNoteMutation,
} from '../../../store/rtk/notesApi';
import s from './EntityNotesSection.module.css';

const OWNER_TYPE_OPTIONS = [
  { value: '', label: 'Все типы' },
  { value: 'counterparty', label: 'Контрагент' },
  { value: 'deal', label: 'Сделка' },
  { value: 'task', label: 'Задача' },
  { value: 'contact', label: 'Контакт' },
  { value: 'company', label: 'Компания' },
  { value: 'department', label: 'Отдел' },
  { value: 'user', label: 'Пользователь' },
  { value: 'order', label: 'Заказ' },
  { value: 'offer', label: 'Оффер' },
  { value: 'product', label: 'Продукт' },
];

const VISIBILITY_OPTIONS = [
  { value: '', label: 'Любая видимость' },
  { value: 'company', label: 'Company' },
  { value: 'private', label: 'Private' },
];

const PINNED_OPTIONS = [
  { value: '', label: 'Любой пин' },
  { value: 'true', label: 'Только pinned' },
  { value: 'false', label: 'Только not pinned' },
];

// getAuthorLabel: возвращает вычисленное значение для UI.
function getAuthorLabel(note) {
  const first = note?.author?.firstName || '';
  const last = note?.author?.lastName || '';
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full || note?.author?.email || '—';
}

// formatDate: форматирует данные для отображения.
function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(+d)) return '—';
  return d.toLocaleString();
}

// initialDraft: вспомогательная логика компонента.
function initialDraft({ fixedOwnerType, fixedOwnerId, ownerType, ownerId }) {
  return {
    ownerType: fixedOwnerType || ownerType || '',
    ownerId: fixedOwnerId || ownerId || '',
    visibility: 'company',
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
}) {
  const currentUserId = useSelector((state) => state.auth?.currentUser?.id || null);
  const fixedOwner = Boolean(fixedOwnerType && fixedOwnerId);

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
  const totalPages = Math.max(1, Math.ceil(total / (query.limit || 1)));

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
      setFormError('Введите текст заметки.');
      return;
    }

    const payload = {
      ownerType,
      ownerId,
      visibility: draft.visibility || 'company',
      pinned: Boolean(draft.pinned),
      content,
    };

    try {
      if (editing?.id) {
        await updateNote({ id: editing.id, payload }).unwrap();
      } else {
        await createNote(payload).unwrap();
      }
      closeComposer();
    } catch (e) {
      setFormError(e?.data?.error || e?.data?.message || e?.message || 'Не удалось сохранить заметку.');
    }
  };

    // onDelete: вспомогательная логика компонента.
const onDelete = async (note) => {
    if (!note?.id) return;
    const ok = window.confirm('Удалить заметку?');
    if (!ok) return;

    try {
      await deleteNote(note.id).unwrap();
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

  return (
    <section className={`${s.wrap} ${className}`.trim()}>
      <div className={s.headerRow}>
        <h3 className={s.title}>{title}</h3>
        <div className={s.headerActions}>
          <button type="button" className={s.btn} onClick={() => refetch()}>
            Обновить
          </button>
          <AddButton onClick={openCreate}>
            {composerOpen && !editing ? 'Скрыть форму' : 'Добавить заметку'}
          </AddButton>
        </div>
      </div>

      <div className={s.filters}>
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
              options={OWNER_TYPE_OPTIONS}
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
          options={VISIBILITY_OPTIONS}
        />

        <SelectField
          inputClassName={s.select}
          value={query.pinned}
          onValueChange={(value) => setQuery((prev) => ({ ...prev, page: 1, pinned: value }))}
          options={PINNED_OPTIONS}
        />
      </div>

      {errorText && <div className={s.error}>{String(errorText)}</div>}

      <div className={s.list}>
        {isFetching ? (
          <div className={s.empty}>Загрузка…</div>
        ) : items.length === 0 ? (
          <div className={s.empty}>Заметок не найдено.</div>
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
                    <span className={s.badge}>{note.visibility}</span>
                    {note.pinned && <span className={s.badgePinned}>Pinned</span>}
                  </div>

                  {editable && (
                    <div className={s.rowActions}>
                      <button type="button" className={s.link} onClick={() => onTogglePin(note)}>
                        {note.pinned ? 'Unpin' : 'Pin'}
                      </button>
                      <button type="button" className={s.link} onClick={() => openEdit(note)}>
                        Редактировать
                      </button>
                      <button
                        type="button"
                        className={s.linkDanger}
                        disabled={isDeleting}
                        onClick={() => onDelete(note)}
                      >
                        Удалить
                      </button>
                    </div>
                  )}
                </div>

                <div className={s.content}>{note.content}</div>

                <div className={s.meta}>
                  <span>Автор: {getAuthorLabel(note)}</span>
                  <span>Создано: {formatDate(note.createdAt)}</span>
                  <span>Обновлено: {formatDate(note.updatedAt)}</span>
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className={s.pager}>
        <span className={s.count}>
          {total > 0 ? `${(query.page - 1) * query.limit + 1}-${Math.min(query.page * query.limit, total)} из ${total}` : '0 из 0'}
        </span>
        <div className={s.pagerActions}>
          <button
            type="button"
            className={s.btn}
            disabled={query.page <= 1}
            onClick={() => setQuery((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
          >
            Назад
          </button>
          <span className={s.pageBadge}>{query.page} / {totalPages}</span>
          <button
            type="button"
            className={s.btn}
            disabled={query.page >= totalPages}
            onClick={() => setQuery((prev) => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
          >
            Вперёд
          </button>
        </div>
      </div>

      {composerOpen ? (
        <form className={`${s.form} ${s.composerCard}`} onSubmit={submit}>
          <div className={s.composerTitle}>
            {editing ? 'Редактирование заметки' : 'Новая заметка'}
          </div>

          {!fixedOwner && (
            <div className={s.row2}>
              <label className={s.field}>
                <span className={s.label}>ownerType</span>
                <SelectField
                  inputClassName={s.select}
                  value={draft.ownerType}
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, ownerType: value }))}
                  options={OWNER_TYPE_OPTIONS.filter((opt) => opt.value)}
                />
              </label>

              <label className={s.field}>
                <span className={s.label}>ownerId</span>
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

          {!fixedOwner && (
            <div className={s.row2}>
              <label className={s.field}>
                <span className={s.label}>visibility</span>
                <SelectField
                  inputClassName={s.select}
                  value={draft.visibility}
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, visibility: value }))}
                  options={[
                    { value: 'company', label: 'Company' },
                    { value: 'private', label: 'Private' },
                  ]}
                />
              </label>

              <CheckboxField
                className={s.checkboxRow}
                checked={Boolean(draft.pinned)}
                onValueChange={(checked) => setDraft((prev) => ({ ...prev, pinned: checked }))}
                label="Pinned"
              />
            </div>
          )}

          <label className={s.field}>
            <span className={s.label}>Текст заметки</span>
            <TextareaField
              inputClassName={s.textarea}
              rows={fixedOwner ? 5 : 8}
              value={draft.content}
              onValueChange={(value) => setDraft((prev) => ({ ...prev, content: value }))}
              placeholder="Введите текст заметки"
            />
          </label>

          {formError && <div className={s.error}>{formError}</div>}

          <div className={s.composerActions}>
            <button type="button" className={s.btn} onClick={closeComposer} disabled={saving}>
              Отмена
            </button>
            <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
