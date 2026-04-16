import React, {
  useMemo,
  useRef,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import ListPage from '../../../components/data/ListPage';
import FilterToolbar from '../../../components/filters/FilterToolbar';
import Modal from '../../../components/Modal';
import AddButton from '../../../components/buttons/AddButton/AddButton';
import AutocompleteSelect from '../../../components/shared/AutocompleteSelect';
import ThemedSelect from '../../../components/inputs/RadixSelect';
import useGridPrefs from '../../../hooks/useGridPrefs';
import {
  useCreateNoteMutation,
  useUpdateNoteMutation,
  useDeleteNoteMutation,
  useGetNoteOwnerOptionsQuery,
} from '../../../store/rtk/notesApi';
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

const emptyForm = {
  ownerType: '',
  ownerId: '',
  visibility: 'company',
  pinned: false,
  content: '',
};

// formatDate: форматирует данные для отображения.
function formatDate(value, locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(+date)) return '—';
  return date.toLocaleString(locale || undefined);
}

// getAuthorLabel: возвращает вычисленное значение для UI.
function getAuthorLabel(note) {
  const first = note?.author?.firstName || '';
  const last = note?.author?.lastName || '';
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full || note?.author?.email || '—';
}

// shortId: вспомогательная логика компонента.
function shortId(value) {
  return String(value || '').slice(0, 8);
}

// toOwnerOption: вспомогательная логика компонента.
function toOwnerOption(item) {
  if (!item?.id) return null;
  return {
    id: String(item.id),
    label: String(item.label || item.name || item.id),
    subtitle: item.subtitle || null,
  };
}

// renderNoteContent: описывает рендер соответствующего блока UI.
function renderNoteContent(rawContent, classNames) {
  const text = String(rawContent || '').replace(/\r\n/g, '\n').trim();
  if (!text) return <span className={classNames.muted}>—</span>;

  const lines = text.split('\n');
  const blocks = [];
  let paragraph = [];
  let listType = null;
  let listItems = [];

    // flushParagraph: вспомогательная логика компонента.
const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ type: 'p', lines: paragraph });
    paragraph = [];
  };

    // flushList: вспомогательная логика компонента.
const flushList = () => {
    if (!listType || !listItems.length) return;
    blocks.push({ type: listType, items: listItems });
    listType = null;
    listItems = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    const unorderedMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      listItems.push(unorderedMatch[1]);
      return;
    }

    const orderedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      listItems.push(orderedMatch[1]);
      return;
    }

    flushList();
    paragraph.push(line);
  });

  flushParagraph();
  flushList();

  return (
    <div className={classNames.contentRich}>
      {blocks.map((block, index) => {
        if (block.type === 'p') {
          return (
            <p key={`p-${index}`} className={classNames.contentParagraph}>
              {block.lines.join('\n')}
            </p>
          );
        }

        const ListTag = block.type === 'ol' ? 'ol' : 'ul';
        return (
          <ListTag
            key={`${block.type}-${index}`}
            className={`${classNames.contentList} ${block.type === 'ol' ? classNames.contentListOrdered : classNames.contentListUnordered}`}
          >
            {block.items.map((item, itemIndex) => (
              <li key={`${block.type}-${index}-${itemIndex}`} className={classNames.contentListItem}>
                {item}
              </li>
            ))}
          </ListTag>
        );
      })}
    </div>
  );
}

// Компонент NoteForm: отвечает за отображение UI и обработку взаимодействий пользователя.
function NoteForm({
  t,
  values,
  ownerTypeOptions,
  ownerSearch,
  ownerOptions,
  ownerLoading,
  selectedOwner,
  onOwnerSearchChange,
  onOwnerSelect,
  onChange,
  onSubmit,
  error,
}) {
  return (
    <form id="notes-form" className={s.form} onSubmit={onSubmit}>
      <div className={s.row2}>
        <label className={s.field}>
          <span className={s.label}>{t('notes.fields.ownerType')}</span>
          <ThemedSelect
            className={s.select}
            value={values.ownerType}
            onChange={(value) => onChange('ownerType', value)}
            options={[
              { value: '', label: t('notes.placeholders.ownerType') },
              ...ownerTypeOptions,
            ]}
            placeholder={t('notes.placeholders.ownerType')}
            size="md"
          />
        </label>

        <label className={s.field}>
          <span className={s.label}>{t('notes.fields.owner')}</span>
          <AutocompleteSelect
            value={selectedOwner}
            inputValue={ownerSearch}
            onInputChange={onOwnerSearchChange}
            options={ownerOptions}
            onSelect={onOwnerSelect}
            placeholder={t('notes.placeholders.ownerSearch')}
            hint={t('notes.messages.typeToSearch')}
            searchingLabel={t('notes.messages.searching')}
            emptyLabel={t('notes.messages.emptyOwners')}
            loading={ownerLoading}
            disabled={!values.ownerType}
            getOptionPrimary={(opt) => opt?.label || String(opt?.id || '')}
            getOptionSecondary={(opt) => opt?.subtitle || opt?.id || null}
            inputClassName={`${s.input} ${s.ownerInputOpaque}`}
            menuClassName={s.ownerMenuOpaque}
            opaque
          />
          {selectedOwner?.label ? (
            <span className={s.ownerIdHint}>
              {selectedOwner.label}
              {selectedOwner.subtitle ? ` · ${selectedOwner.subtitle}` : ''}
            </span>
          ) : values.ownerId ? (
            <span className={s.ownerIdHint}>
              {t('notes.fields.selectedId')}: {values.ownerId}
            </span>
          ) : null}
        </label>
      </div>

      <div className={s.row2}>
        <label className={s.field}>
          <span className={s.label}>{t('notes.fields.visibility')}</span>
          <ThemedSelect
            className={s.select}
            value={values.visibility}
            onChange={(value) => onChange('visibility', value)}
            options={[
              { value: 'company', label: t('notes.visibility.company') },
              { value: 'private', label: t('notes.visibility.private') },
            ]}
            placeholder={t('notes.fields.visibility')}
            size="md"
          />
        </label>

        <label className={s.checkboxField}>
          <input
            type="checkbox"
            checked={Boolean(values.pinned)}
            onChange={(e) => onChange('pinned', e.target.checked)}
          />
          <span>{t('notes.fields.pinned')}</span>
        </label>
      </div>

      <label className={s.field}>
        <span className={s.label}>{t('notes.fields.content')}</span>
        <textarea
          className={s.textarea}
          value={values.content}
          onChange={(e) => onChange('content', e.target.value)}
          rows={8}
          placeholder={t('notes.placeholders.content')}
        />
      </label>

      {error && <div className={s.error}>{error}</div>}
    </form>
  );
}

// Компонент NotesPage: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function NotesPage() {
  const { t, i18n } = useTranslation();
  const listRef = useRef(null);
  const currentUserId = useSelector((state) => state.auth?.currentUser?.id || null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const [ownerSearch, setOwnerSearch] = useState('');
  const [ownerSearchDebounced, setOwnerSearchDebounced] = useState('');
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [toolbarOwnerType, setToolbarOwnerType] = useState('');
  const [toolbarOwnerSearch, setToolbarOwnerSearch] = useState('');
  const [toolbarOwnerSearchDebounced, setToolbarOwnerSearchDebounced] = useState('');
  const [toolbarSelectedOwner, setToolbarSelectedOwner] = useState(null);
  const [quickEditId, setQuickEditId] = useState(null);
  const [quickEditValue, setQuickEditValue] = useState('');
  const [quickEditError, setQuickEditError] = useState('');
  const [quickEditSaving, setQuickEditSaving] = useState(false);

  const [createNote, { isLoading: creating }] = useCreateNoteMutation();
  const [updateNote, { isLoading: updating }] = useUpdateNoteMutation();
  const [deleteNote, { isLoading: deleting }] = useDeleteNoteMutation();
  const {
    colWidths,
    colOrder,
    colVisibility,
    savedViews,
    activeViewId,
    onColumnResize,
    onColumnOrderChange,
    onColumnVisibilityChange,
    onSavedViewsChange,
    onActiveViewChange,
    resetGridPrefs,
  } = useGridPrefs('crm.notes');

  const saving = creating || updating;

  useEffect(() => {
    const timer = setTimeout(() => {
      setOwnerSearchDebounced(String(ownerSearch || '').trim());
    }, 320);
    return () => clearTimeout(timer);
  }, [ownerSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setToolbarOwnerSearchDebounced(String(toolbarOwnerSearch || '').trim());
    }, 320);
    return () => clearTimeout(timer);
  }, [toolbarOwnerSearch]);

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
      { value: '', label: t('notes.filters.allVisibility') },
      { value: 'company', label: t('notes.visibility.company') },
      { value: 'private', label: t('notes.visibility.private') },
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
      ownerType: form.ownerType,
      search: ownerSearchDebounced,
      limit: 20,
    },
    { skip: !open || !form.ownerType }
  );
  const { data: toolbarOwnerLookupData, isFetching: toolbarOwnerLookupLoading } = useGetNoteOwnerOptionsQuery(
    {
      ownerType: toolbarOwnerType,
      search: toolbarOwnerSearchDebounced,
      limit: 20,
    },
    { skip: !toolbarOwnerType }
  );

  const ownerOptions = useMemo(() => {
    const base = Array.isArray(ownerLookupData?.items)
      ? ownerLookupData.items.map(toOwnerOption).filter(Boolean)
      : [];

    if (
      selectedOwner?.id
      && !base.some((item) => String(item.id) === String(selectedOwner.id))
    ) {
      return [selectedOwner, ...base];
    }

    return base;
  }, [ownerLookupData?.items, selectedOwner]);

  const toolbarOwnerOptions = useMemo(() => {
    const base = Array.isArray(toolbarOwnerLookupData?.items)
      ? toolbarOwnerLookupData.items.map(toOwnerOption).filter(Boolean)
      : [];

    if (
      toolbarSelectedOwner?.id
      && !base.some((item) => String(item.id) === String(toolbarSelectedOwner.id))
    ) {
      return [toolbarSelectedOwner, ...base];
    }

    return base;
  }, [toolbarOwnerLookupData?.items, toolbarSelectedOwner]);

  const canManage = useCallback(
    (note) => String(note?.author?.id || '') === String(currentUserId || ''),
    [currentUserId]
  );

  const resetFormState = useCallback(() => {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setOwnerSearch('');
    setOwnerSearchDebounced('');
    setSelectedOwner(null);
  }, []);

  const openCreate = useCallback(() => {
    setQuickEditId(null);
    setQuickEditValue('');
    setQuickEditError('');
    resetFormState();
    setOpen(true);
  }, [resetFormState]);

  const openEdit = useCallback((note) => {
    setQuickEditId(null);
    setQuickEditValue('');
    setQuickEditError('');
    const ownerType = note?.ownerType || '';
    const ownerId = note?.ownerId || '';
    const ownerTypeLabel = ownerTypeLabelMap[ownerType] || ownerType;
    const fallbackOwnerLabel = note?.ownerLabel || `${ownerTypeLabel} #${shortId(ownerId)}`;

    setEditing(note);
    setForm({
      ownerType,
      ownerId,
      visibility: note?.visibility || 'company',
      pinned: Boolean(note?.pinned),
      content: note?.content || '',
    });
    setSelectedOwner(
      ownerId
        ? {
          id: ownerId,
          label: fallbackOwnerLabel,
          subtitle: note?.ownerSubtitle || ownerId,
        }
        : null
    );
    setOwnerSearch(ownerId ? fallbackOwnerLabel : '');
    setOwnerSearchDebounced('');
    setFormError('');
    setOpen(true);
  }, [ownerTypeLabelMap]);

  const closeModal = useCallback(() => {
    setOpen(false);
    resetFormState();
  }, [resetFormState]);

  const handleOwnerTypeChange = useCallback((value) => {
    setForm((prev) => ({
      ...prev,
      ownerType: value,
      ownerId: '',
    }));
    setSelectedOwner(null);
    setOwnerSearch('');
    setOwnerSearchDebounced('');
  }, []);

  const handleOwnerInputChange = useCallback((value) => {
    setOwnerSearch(value);

    if (!selectedOwner) return;

    const selectedLabel = String(selectedOwner.label || '').trim();
    if (String(value || '').trim() !== selectedLabel) {
      setSelectedOwner(null);
      setForm((prev) => ({ ...prev, ownerId: '' }));
    }
  }, [selectedOwner]);

  const handleOwnerSelect = useCallback((option) => {
    if (!option?.id) return;

    const normalized = toOwnerOption(option);
    setSelectedOwner(normalized);
    setOwnerSearch(normalized?.label || '');
    setOwnerSearchDebounced(String(normalized?.label || '').trim());
    setForm((prev) => ({ ...prev, ownerId: String(option.id) }));
  }, []);

    // handleSubmit: обработчик пользовательского действия.
const handleSubmit = async (event) => {
    event?.preventDefault();
    setFormError('');

    const payload = {
      ownerType: String(form.ownerType || '').trim(),
      ownerId: String(form.ownerId || '').trim(),
      visibility: form.visibility || 'company',
      pinned: Boolean(form.pinned),
      content: String(form.content || '').trim(),
    };

    if (!payload.ownerType) {
      setFormError(t('notes.validation.ownerTypeRequired'));
      return;
    }
    if (!payload.ownerId) {
      setFormError(t('notes.validation.ownerRequired'));
      return;
    }
    if (!payload.content) {
      setFormError(t('notes.validation.contentRequired'));
      return;
    }

    try {
      if (editing?.id) {
        await updateNote({ id: editing.id, payload }).unwrap();
      } else {
        await createNote(payload).unwrap();
      }
      closeModal();
      listRef.current?.refetch?.();
    } catch (e) {
      setFormError(
        e?.data?.error
        || e?.data?.message
        || e?.message
        || t('notes.validation.saveFailed')
      );
    }
  };

  const onDelete = useCallback(async (note) => {
    if (!note?.id) return;
    if (!window.confirm(t('notes.messages.deleteConfirm'))) return;

    try {
      await deleteNote(note.id).unwrap();
      listRef.current?.refetch?.();
    } catch {
      // noop
    }
  }, [deleteNote, t]);

  const onTogglePin = useCallback(async (note) => {
    if (!note?.id) return;
    try {
      await updateNote({ id: note.id, payload: { pinned: !note.pinned } }).unwrap();
      listRef.current?.refetch?.();
    } catch {
      // noop
    }
  }, [updateNote]);

  const startQuickEdit = useCallback((note) => {
    if (!note?.id) return;
    setQuickEditId(note.id);
    setQuickEditValue(String(note?.content || ''));
    setQuickEditError('');
  }, []);

  const cancelQuickEdit = useCallback(() => {
    setQuickEditId(null);
    setQuickEditValue('');
    setQuickEditError('');
  }, []);

  const saveQuickEdit = useCallback(async () => {
    const id = quickEditId;
    if (!id) return;

    const content = String(quickEditValue || '').trim();
    if (!content) {
      setQuickEditError(t('notes.validation.contentRequired'));
      return;
    }

    setQuickEditSaving(true);
    setQuickEditError('');
    try {
      await updateNote({ id, payload: { content } }).unwrap();
      cancelQuickEdit();
      listRef.current?.refetch?.();
    } catch (e) {
      setQuickEditError(
        e?.data?.error
        || e?.data?.message
        || e?.message
        || t('notes.validation.saveFailed')
      );
    } finally {
      setQuickEditSaving(false);
    }
  }, [quickEditId, quickEditValue, t, updateNote, cancelQuickEdit]);

  const columns = useMemo(
    () => [
      {
        key: 'content',
        title: t('notes.table.content'),
        width: 500,
                // render: описывает рендер соответствующего блока UI.
render: (row) => {
          const ownerTypeLabel = ownerTypeLabelMap[row.ownerType] || row.ownerType;
          const ownerLabel = row?.ownerLabel || `${ownerTypeLabel} #${shortId(row.ownerId)}`;
          const ownerSubtitle = row?.ownerSubtitle || null;
          const isQuickEditing = quickEditId === row.id && canManage(row);

          return (
            <div className={s.contentCell}>
              <div className={s.contentSurface}>
                {isQuickEditing ? (
                  <div className={s.quickEditWrap}>
                    <textarea
                      className={s.quickEditTextarea}
                      value={quickEditValue}
                      rows={5}
                      onChange={(e) => setQuickEditValue(e.target.value)}
                    />
                    {quickEditError ? <div className={s.quickEditError}>{quickEditError}</div> : null}
                    <div className={s.quickEditActions}>
                      <button
                        type="button"
                        className={s.quickEditSave}
                        disabled={quickEditSaving}
                        onClick={saveQuickEdit}
                      >
                        {quickEditSaving ? t('common.saving') : t('common.save')}
                      </button>
                      <button
                        type="button"
                        className={s.quickEditCancel}
                        disabled={quickEditSaving}
                        onClick={cancelQuickEdit}
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div onDoubleClick={() => canManage(row) && startQuickEdit(row)}>
                    {renderNoteContent(row.content, s)}
                  </div>
                )}
              </div>
              <div className={s.contentSubRow}>
                <span className={`${s.badge} ${s.ownerBadge}`}>{ownerTypeLabel}</span>
                <span className={s.ownerName}>{ownerLabel}</span>
                {ownerSubtitle ? <span className={s.ownerId}>{ownerSubtitle}</span> : null}
                {row.pinned ? <span className={`${s.badge} ${s.badgePinned}`}>{t('notes.fields.pinned')}</span> : null}
              </div>
            </div>
          );
        },
      },
      {
        key: 'visibility',
        title: t('notes.table.visibility'),
        width: 130,
                // render: описывает рендер соответствующего блока UI.
render: (row) => (
          <span className={`${s.badge} ${row.visibility === 'private' ? s.badgePrivate : s.badgeCompany}`}>
            {row.visibility === 'private' ? t('notes.visibility.private') : t('notes.visibility.company')}
          </span>
        ),
      },
      {
        key: 'pinned',
        title: t('notes.table.pinned'),
        sortable: true,
        width: 110,
                // render: описывает рендер соответствующего блока UI.
render: (row) => (
          <span className={row.pinned ? s.pinYes : s.pinNo}>
            {row.pinned ? t('notes.values.yes') : t('notes.values.no')}
          </span>
        ),
      },
      {
        key: 'author',
        title: t('notes.table.author'),
        width: 180,
                // render: описывает рендер соответствующего блока UI.
render: (row) => getAuthorLabel(row),
      },
      {
        key: 'createdAt',
        title: t('notes.table.createdAt'),
        sortable: true,
        width: 180,
                // render: описывает рендер соответствующего блока UI.
render: (row) => formatDate(row.createdAt, i18n.language),
      },
      {
        key: 'updatedAt',
        title: t('notes.table.updatedAt'),
        sortable: true,
        width: 180,
                // render: описывает рендер соответствующего блока UI.
render: (row) => formatDate(row.updatedAt, i18n.language),
      },
    ],
    [
      t,
      i18n.language,
      ownerTypeLabelMap,
      quickEditId,
      quickEditValue,
      quickEditError,
      quickEditSaving,
      canManage,
      saveQuickEdit,
      cancelQuickEdit,
      startQuickEdit,
    ]
  );

  const rowActions = useCallback(
    (row) => {
      if (!canManage(row)) return <span className={s.muted}>—</span>;
      return (
        <div className={s.rowActions}>
          <button
            type="button"
            className={s.rowLink}
            disabled={quickEditSaving}
            onClick={() => (quickEditId === row.id ? cancelQuickEdit() : startQuickEdit(row))}
          >
            {quickEditId === row.id ? t('common.cancel') : t('notes.actions.quickEdit')}
          </button>
          <span className={s.sep}>•</span>
          <button type="button" className={s.rowLink} onClick={() => onTogglePin(row)}>
            {row.pinned ? t('notes.actions.unpin') : t('notes.actions.pin')}
          </button>
          <span className={s.sep}>•</span>
          <button type="button" className={s.rowLink} onClick={() => openEdit(row)}>
            {t('notes.actions.edit')}
          </button>
          <span className={s.sep}>•</span>
          <button
            type="button"
            className={s.rowDanger}
            disabled={deleting || quickEditSaving}
            onClick={() => onDelete(row)}
          >
            {t('notes.actions.delete')}
          </button>
        </div>
      );
    },
    [
      canManage,
      quickEditId,
      quickEditSaving,
      cancelQuickEdit,
      startQuickEdit,
      deleting,
      onDelete,
      onTogglePin,
      openEdit,
      t,
    ]
  );

  const actions = useMemo(
    () => (
      <AddButton onClick={openCreate} title={t('notes.actions.add')}>
        {t('notes.actions.add')}
      </AddButton>
    ),
    [openCreate, t]
  );

  const footer = useMemo(
    () => (
      <>
        <Modal.Button onClick={closeModal}>{t('common.cancel')}</Modal.Button>
        <Modal.Button variant="primary" type="submit" form="notes-form" disabled={saving}>
          {saving
            ? t('common.saving')
            : editing
              ? t('notes.actions.save')
              : t('notes.actions.create')}
        </Modal.Button>
      </>
    ),
    [saving, editing, closeModal, t]
  );

  const defaultQuery = useMemo(
    () => ({
      sort: 'createdAt',
      dir: 'DESC',
      limit: 25,
    }),
    []
  );

  return (
    <>
      <ListPage
        ref={listRef}
        source="notes"
        title={t('notes.title')}
        columns={columns}
        defaultQuery={defaultQuery}
        actions={actions}
        rowActions={rowActions}
        columnWidths={colWidths}
        onColumnResize={onColumnResize}
        columnOrder={colOrder}
        onColumnOrderChange={onColumnOrderChange}
        columnVisibility={colVisibility}
        onColumnVisibilityChange={onColumnVisibilityChange}
        savedViews={savedViews}
        activeViewId={activeViewId}
        onSavedViewsChange={onSavedViewsChange}
        onActiveViewChange={onActiveViewChange}
        onResetColumns={resetGridPrefs}
        ToolbarComponent={(props) => (
          <FilterToolbar
            {...props}
            controls={[
              {
                type: 'search',
                key: 'search',
                placeholder: t('notes.placeholders.search'),
                debounce: 400,
              },
              {
                type: 'custom',
                                // render: описывает рендер соответствующего блока UI.
render: ({ query, onChange }) => (
                  <ThemedSelect
                    className={s.toolbarSelect}
                    value={query.ownerType || ''}
                    options={ownerTypeFilterOptions}
                    placeholder={t('notes.fields.ownerType')}
                    size="sm"
                    onChange={(value) => {
                      const nextType = String(value || '');
                      setToolbarOwnerType(nextType);
                      setToolbarSelectedOwner(null);
                      setToolbarOwnerSearch('');
                      setToolbarOwnerSearchDebounced('');
                      onChange((prev) => ({
                        ...prev,
                        ownerType: nextType || undefined,
                        ownerId: undefined,
                        page: 1,
                      }));
                    }}
                  />
                ),
              },
              {
                type: 'custom',
                                // render: описывает рендер соответствующего блока UI.
render: ({ onChange }) => (
                  <AutocompleteSelect
                    className={s.toolbarOwner}
                    value={toolbarSelectedOwner}
                    inputValue={toolbarOwnerSearch}
                    onInputChange={(value) => {
                      setToolbarOwnerSearch(value);
                      if (!toolbarSelectedOwner) return;

                      const selectedLabel = String(toolbarSelectedOwner.label || '').trim();
                      if (String(value || '').trim() !== selectedLabel) {
                        setToolbarSelectedOwner(null);
                        onChange((prev) => ({
                          ...prev,
                          ownerId: undefined,
                          page: 1,
                        }));
                      }
                    }}
                    options={toolbarOwnerOptions}
                    onSelect={(option) => {
                      if (!option?.id) return;
                      const normalized = toOwnerOption(option);
                      setToolbarSelectedOwner(normalized);
                      setToolbarOwnerSearch(normalized?.label || '');
                      setToolbarOwnerSearchDebounced(String(normalized?.label || '').trim());
                      onChange((prev) => ({
                        ...prev,
                        ownerId: String(option.id),
                        page: 1,
                      }));
                    }}
                    placeholder={t('notes.placeholders.ownerFilterSearch')}
                    hint={toolbarOwnerType ? t('notes.messages.typeToSearch') : t('notes.messages.selectOwnerTypeFirst')}
                    searchingLabel={t('notes.messages.searching')}
                    emptyLabel={t('notes.messages.emptyOwners')}
                    loading={toolbarOwnerLookupLoading}
                    disabled={!toolbarOwnerType}
                    getOptionPrimary={(opt) => opt?.label || String(opt?.id || '')}
                    getOptionSecondary={(opt) => opt?.subtitle || opt?.id || null}
                    inputClassName={`${s.toolbarInput} ${s.ownerInputOpaque}`}
                    menuClassName={s.ownerMenuOpaque}
                    opaque
                  />
                ),
              },
              {
                type: 'select',
                key: 'visibility',
                label: t('notes.fields.visibility'),
                options: visibilityFilterOptions,
              },
              {
                type: 'select',
                key: 'pinned',
                label: t('notes.fields.pinned'),
                options: pinnedFilterOptions,
              },
            ]}
          />
        )}
      />

      <Modal
        open={open}
        onClose={closeModal}
        title={editing ? t('notes.modal.editTitle') : t('notes.modal.createTitle')}
        size="lg"
        footer={footer}
      >
        <NoteForm
          t={t}
          values={form}
          ownerTypeOptions={ownerTypeOptions}
          ownerSearch={ownerSearch}
          ownerOptions={ownerOptions}
          ownerLoading={ownerLookupLoading}
          selectedOwner={selectedOwner}
          onOwnerSearchChange={handleOwnerInputChange}
          onOwnerSelect={handleOwnerSelect}
          onChange={(key, value) => {
            if (key === 'ownerType') {
              handleOwnerTypeChange(value);
              return;
            }
            setForm((prev) => ({ ...prev, [key]: value }));
          }}
          onSubmit={handleSubmit}
          error={formError}
        />
      </Modal>
    </>
  );
}

