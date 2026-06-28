import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import AddButton from '../../../components/buttons/AddButton/AddButton';
import ConfirmDialog from '../../../components/dialogs/ConfirmDialog';
import {
  AutocompleteField,
  SelectField,
} from '../../../components/ui/fields';
import {
  useDeleteNoteMutation,
  useGetNoteOwnerOptionsQuery,
  useGetNotesQuery,
  useUpdateNoteMutation,
} from '../../../store/rtk/notesApi';
import { useListDepartmentsQuery } from '../../../store/rtk/departmentsApi';
import s from './NotesPage.module.css';

const OWNER_TYPES = [
  'counterparty',
  'deal',
  'task',
  'contact',
  'company',
  'department',
  'user',
  'order',
  'offer',
  'product',
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100].map((value) => ({
  value: String(value),
  label: String(value),
}));

function formatDate(value, locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(+date)) return '—';
  return date.toLocaleString(locale || undefined);
}

function getAuthorLabel(note) {
  const first = note?.author?.firstName || '';
  const last = note?.author?.lastName || '';
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full || note?.author?.email || '—';
}

function shortId(value) {
  return String(value || '').slice(0, 8);
}

function toOwnerOption(item) {
  if (!item?.id) return null;
  return {
    id: String(item.id),
    label: String(item.label || item.name || item.id),
    subtitle: item.subtitle || null,
  };
}

function getNoteLines(content) {
  return String(content || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function getDerivedNoteTitle(content, fallback) {
  return getNoteLines(content)[0] || fallback;
}

function getNotePreview(content) {
  const lines = getNoteLines(content);
  if (lines.length <= 1) return '';
  return lines.slice(1, 4).join('\n');
}

function getVisibilityLabel(note, t, departmentById) {
  if (note?.visibility === 'department') {
    const departmentId = note.visibilityDepartmentId || note.visibility_department_id || '';
    const department = note.visibilityDepartment || note.department || departmentById.get(String(departmentId));
    const name = department?.name || department?.code || departmentId;
    return `${t('visibility.department')}${name ? ` · ${name}` : ''}`;
  }
  return t(`visibility.${note?.visibility || 'company'}`, t('visibility.company'));
}

export default function NotesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const currentUserId = useSelector((state) => state.auth?.currentUser?.id || null);

  const [query, setQuery] = useState({
    search: '',
    ownerType: '',
    ownerId: '',
    visibility: '',
    pinned: '',
    page: 1,
    limit: 25,
  });
  const [searchInput, setSearchInput] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [ownerSearch, setOwnerSearch] = useState('');
  const [ownerSearchDebounced, setOwnerSearchDebounced] = useState('');
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  const [updateNote, { isLoading: updating }] = useUpdateNoteMutation();
  const [deleteNote, { isLoading: deleting }] = useDeleteNoteMutation();
  const { data: departmentsData } = useListDepartmentsQuery({ limit: 100 });

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(String(searchInput || '').trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setQuery((prev) => {
      if ((prev.search || '') === searchDebounced) return prev;
      return { ...prev, search: searchDebounced, page: 1 };
    });
  }, [searchDebounced]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOwnerSearchDebounced(String(ownerSearch || '').trim());
    }, 320);
    return () => clearTimeout(timer);
  }, [ownerSearch]);

  const departments = useMemo(
    () => (Array.isArray(departmentsData) ? departmentsData : []),
    [departmentsData]
  );
  const departmentById = useMemo(
    () => new Map(departments.map((department) => [String(department.id), department])),
    [departments]
  );

  const ownerTypeOptions = useMemo(
    () => OWNER_TYPES.map((value) => ({
      value,
      label: t(`notes.ownerTypes.${value}`, value),
    })),
    [t]
  );
  const ownerTypeLabelMap = useMemo(
    () => ownerTypeOptions.reduce((acc, item) => ({ ...acc, [item.value]: item.label }), {}),
    [ownerTypeOptions]
  );
  const ownerTypeFilterOptions = useMemo(
    () => [{ value: '', label: t('notes.filters.allOwnerTypes') }, ...ownerTypeOptions],
    [ownerTypeOptions, t]
  );
  const visibilityFilterOptions = useMemo(
    () => [
      { value: '', label: t('visibility.all') },
      { value: 'company', label: t('visibility.company') },
      { value: 'private', label: t('visibility.private') },
      { value: 'department', label: t('visibility.department') },
    ],
    [t]
  );
  const pinnedFilterOptions = useMemo(
    () => [
      { value: '', label: t('notes.filters.allPinned') },
      { value: 'true', label: t('notes.filters.onlyPinned') },
      { value: 'false', label: t('notes.filters.onlyUnpinned') },
    ],
    [t]
  );

  const { data: ownerLookupData, isFetching: ownerLookupLoading } = useGetNoteOwnerOptionsQuery(
    {
      ownerType: query.ownerType,
      search: ownerSearchDebounced,
      limit: 20,
    },
    { skip: !query.ownerType }
  );
  const ownerOptions = useMemo(() => {
    const base = Array.isArray(ownerLookupData?.items)
      ? ownerLookupData.items.map(toOwnerOption).filter(Boolean)
      : [];
    if (selectedOwner?.id && !base.some((item) => String(item.id) === String(selectedOwner.id))) {
      return [selectedOwner, ...base];
    }
    return base;
  }, [ownerLookupData?.items, selectedOwner]);

  const listQuery = useMemo(() => ({
    search: query.search || undefined,
    ownerType: query.ownerType || undefined,
    ownerId: query.ownerId || undefined,
    visibility: query.visibility || undefined,
    pinned: query.pinned || undefined,
    sort: 'createdAt',
    dir: 'DESC',
    page: query.page,
    limit: query.limit,
  }), [query]);
  const { data, isFetching, refetch } = useGetNotesQuery(listQuery);
  const notes = Array.isArray(data?.items) ? data.items : [];
  const total = Number(data?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / Number(query.limit || 25)));
  const from = total === 0 ? 0 : ((query.page - 1) * query.limit) + 1;
  const to = Math.min(total, query.page * query.limit);

  const canManage = useCallback(
    (note) => String(note?.author?.id || '') === String(currentUserId || ''),
    [currentUserId]
  );

  const updateQuery = useCallback((patch) => {
    setQuery((prev) => ({ ...prev, ...patch }));
  }, []);

  const openCreate = useCallback(() => {
    navigate('/main/notes/new');
  }, [navigate]);

  const openDetail = useCallback((note) => {
    if (!note?.id) return;
    navigate(`/main/notes/${note.id}`);
  }, [navigate]);

  const onCardKeyDown = useCallback((event, note) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openDetail(note);
  }, [openDetail]);

  const onTogglePin = useCallback(async (note) => {
    if (!note?.id) return;
    try {
      await updateNote({ id: note.id, payload: { pinned: !note.pinned } }).unwrap();
      refetch();
    } catch {
      // keep list interaction quiet; detail page will show full errors on save.
    }
  }, [refetch, updateNote]);

  const onDelete = useCallback((note) => {
    if (!note?.id) return;
    setDeleteTarget(note);
    setDeleteError('');
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget?.id || deleting) return;
    setDeleteError('');
    try {
      await deleteNote(deleteTarget.id).unwrap();
      setDeleteTarget(null);
      refetch();
    } catch (error) {
      setDeleteError(
        error?.data?.message
        || error?.data?.error
        || error?.message
        || t('notes.validation.saveFailed')
      );
    }
  }, [deleteNote, deleteTarget?.id, deleting, refetch, t]);

  return (
    <main className={s.notesPage}>
      <section className={s.listSurface}>
        <header className={s.listHeader}>
          <div>
            <h1 className={s.listTitle}>{t('notes.title')}</h1>
            <div className={s.listSubtitle}>
              {total ? `${from}-${to} / ${total}` : '0 / 0'}
            </div>
          </div>
          <AddButton onClick={openCreate} title={t('notes.actions.add')}>
            {t('notes.actions.add')}
          </AddButton>
        </header>

        <div className={s.listToolbar}>
          <input
            className={`${s.input} ${s.toolbarSearch}`}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('notes.placeholders.search')}
            type="search"
          />

          <SelectField
            className={s.toolbarSelect}
            inputClassName={s.select}
            value={query.ownerType}
            options={ownerTypeFilterOptions}
            placeholder={t('notes.fields.relatedType')}
            size="sm"
            onValueChange={(value) => {
              const nextType = String(value || '');
              setSelectedOwner(null);
              setOwnerSearch('');
              setOwnerSearchDebounced('');
              updateQuery({
                ownerType: nextType,
                ownerId: '',
                page: 1,
              });
            }}
          />

          <AutocompleteField
            className={s.toolbarOwner}
            value={selectedOwner}
            inputValue={ownerSearch}
            onInputChange={(value) => {
              setOwnerSearch(value);
              if (!selectedOwner) return;

              const selectedLabel = String(selectedOwner.label || '').trim();
              if (String(value || '').trim() !== selectedLabel) {
                setSelectedOwner(null);
                updateQuery({ ownerId: '', page: 1 });
              }
            }}
            options={ownerOptions}
            onSelect={(option) => {
              if (!option?.id) return;
              const normalized = toOwnerOption(option);
              setSelectedOwner(normalized);
              setOwnerSearch(normalized?.label || '');
              setOwnerSearchDebounced(String(normalized?.label || '').trim());
              updateQuery({ ownerId: String(option.id), page: 1 });
            }}
            placeholder={t('notes.placeholders.ownerFilterSearch')}
            hint={query.ownerType ? t('notes.messages.typeToSearch') : t('notes.messages.selectOwnerTypeFirst')}
            searchingLabel={t('notes.messages.searching')}
            emptyLabel={t('notes.messages.emptyOwners')}
            loading={ownerLookupLoading}
            disabled={!query.ownerType}
            getOptionPrimary={(opt) => opt?.label || String(opt?.id || '')}
            getOptionSecondary={(opt) => opt?.subtitle || opt?.id || null}
            inputClassName={`${s.toolbarInput} ${s.ownerInputOpaque}`}
            menuClassName={s.ownerMenuOpaque}
            opaque
          />

          <SelectField
            className={s.toolbarSelect}
            inputClassName={s.select}
            value={query.visibility}
            options={visibilityFilterOptions}
            placeholder={t('visibility.filterLabel')}
            size="sm"
            onValueChange={(value) => updateQuery({ visibility: String(value || ''), page: 1 })}
          />

          <SelectField
            className={s.toolbarSelect}
            inputClassName={s.select}
            value={query.pinned}
            options={pinnedFilterOptions}
            placeholder={t('notes.fields.pinned')}
            size="sm"
            onValueChange={(value) => updateQuery({ pinned: String(value || ''), page: 1 })}
          />

          <SelectField
            className={s.pageSizeSelect}
            inputClassName={s.select}
            value={String(query.limit)}
            options={PAGE_SIZE_OPTIONS}
            placeholder={t('pagination.perPage', 'На странице')}
            size="sm"
            onValueChange={(value) => updateQuery({ limit: Number(value) || 25, page: 1 })}
          />
        </div>

        <div className={s.cardList} aria-busy={isFetching ? 'true' : undefined}>
          {notes.length ? notes.map((note) => {
            const title = getDerivedNoteTitle(note.content, t('notes.detail.newTitle'));
            const preview = getNotePreview(note.content);
            const ownerTypeLabel = ownerTypeLabelMap[note.ownerType] || note.ownerType || '—';
            const ownerLabel = note?.ownerLabel || `${ownerTypeLabel} #${shortId(note.ownerId)}`;
            const ownerSubtitle = note?.ownerSubtitle || null;
            const manageable = canManage(note);
            const noteDate = formatDate(note.updatedAt || note.createdAt, i18n.language);

            return (
              <article
                key={note.id}
                role="link"
                tabIndex={0}
                aria-label={title}
                className={`${s.noteCard} ${note.pinned ? s.noteCardPinned : ''}`}
                onClick={() => openDetail(note)}
                onKeyDown={(event) => onCardKeyDown(event, note)}
              >
                <div className={s.noteCardTop}>
                  <div
                    className={s.noteTitleButton}
                  >
                    <h2 className={s.noteCardTitle}>{title}</h2>
                  </div>

                  <div className={s.noteCardTopMeta}>
                    {note.pinned ? <span className={`${s.badge} ${s.badgePinned}`}>{t('notes.fields.pinned')}</span> : null}
                    <time className={s.noteDate}>{noteDate}</time>
                    {manageable ? (
                      <div className={s.cardActions}>
                        <button
                          type="button"
                          className={s.iconAction}
                          title={t('notes.actions.edit')}
                          aria-label={t('notes.actions.edit')}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openDetail(note);
                          }}
                        >
                          <Pencil size={15} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className={s.iconAction}
                          title={note.pinned ? t('notes.actions.unpin') : t('notes.actions.pin')}
                          aria-label={note.pinned ? t('notes.actions.unpin') : t('notes.actions.pin')}
                          disabled={updating}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onTogglePin(note);
                          }}
                        >
                          {note.pinned ? <PinOff size={15} aria-hidden="true" /> : <Pin size={15} aria-hidden="true" />}
                        </button>
                        <button
                          type="button"
                          className={`${s.iconAction} ${s.iconActionDanger}`}
                          title={t('notes.actions.delete')}
                          aria-label={t('notes.actions.delete')}
                          disabled={deleting || updating}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onDelete(note);
                          }}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className={s.noteCardMain}>
                  {preview ? <p className={s.notePreview}>{preview}</p> : null}

                  <div className={s.noteMetaLine}>
                    <span className={`${s.badge} ${s.ownerBadge}`}>{ownerTypeLabel}</span>
                    <span className={s.ownerName}>{ownerLabel}</span>
                    {ownerSubtitle ? <span className={s.ownerId}>{ownerSubtitle}</span> : null}
                    <span className={`${s.badge} ${note.visibility === 'private' ? s.badgePrivate : note.visibility === 'department' ? s.badgeDepartment : s.badgeCompany}`}>
                      {getVisibilityLabel(note, t, departmentById)}
                    </span>
                    <span>{getAuthorLabel(note)}</span>
                  </div>
                </div>
              </article>
            );
          }) : (
            <div className={s.emptyCards}>
              {isFetching ? (
                t('common.loading')
              ) : (
                <>
                  <h2>{t('notes.messages.emptyTitle')}</h2>
                  <p>{t('notes.messages.emptyText')}</p>
                  <AddButton onClick={openCreate} title={t('notes.actions.add')}>
                    {t('notes.actions.add')}
                  </AddButton>
                </>
              )}
            </div>
          )}
        </div>

        <footer className={s.cardPagination}>
          <span>{total ? `${from}-${to} / ${total}` : '0 / 0'}</span>
          <div className={s.paginationButtons}>
            <button
              type="button"
              className={s.detailGhostButton}
              disabled={query.page <= 1}
              onClick={() => updateQuery({ page: Math.max(1, query.page - 1) })}
            >
              {t('common.previous', 'Назад')}
            </button>
            <span>{query.page} / {totalPages}</span>
            <button
              type="button"
              className={s.detailGhostButton}
              disabled={query.page >= totalPages}
              onClick={() => updateQuery({ page: Math.min(totalPages, query.page + 1) })}
            >
              {t('common.next', 'Вперёд')}
            </button>
          </div>
        </footer>
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('notes.confirm.deleteTitle')}
        text={(
          <>
            <div>{t('notes.messages.deleteConfirm')}</div>
            {deleteError ? <div className={s.confirmError}>{deleteError}</div> : null}
          </>
        )}
        danger
        loading={deleting}
        okText={t('common.delete')}
        cancelText={t('common.cancel')}
        onOk={confirmDelete}
        onCancel={() => {
          if (deleting) return;
          setDeleteTarget(null);
          setDeleteError('');
        }}
      />
    </main>
  );
}
