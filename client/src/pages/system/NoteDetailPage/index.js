import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../../../components/dialogs/ConfirmDialog';
import {
  AutocompleteField,
  CheckboxField,
  SelectField,
  TextareaField,
  VisibilityField,
} from '../../../components/ui/fields';
import {
  useCreateNoteMutation,
  useDeleteNoteMutation,
  useGetNoteByIdQuery,
  useGetNotesQuery,
  useGetNoteOwnerOptionsQuery,
  useUpdateNoteMutation,
} from '../../../store/rtk/notesApi';
import { useListDepartmentsQuery } from '../../../store/rtk/departmentsApi';
import s from '../NotesPage/NotesPage.module.css';

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
  visibility: 'private',
  visibilityDepartmentId: '',
  pinned: false,
  content: '',
};

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

function getDerivedNoteTitle(content) {
  return String(content || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) || '';
}

function normalizeForm(form) {
  const payload = {
    visibility: form.visibility || 'company',
    pinned: Boolean(form.pinned),
    content: String(form.content || '').trim(),
  };

  const ownerType = String(form.ownerType || '').trim();
  const ownerId = String(form.ownerId || '').trim();
  if (ownerType && ownerId) {
    payload.ownerType = ownerType;
    payload.ownerId = ownerId;
  }

  if (payload.visibility === 'department') {
    payload.visibilityDepartmentId = form.visibilityDepartmentId || null;
  } else {
    payload.visibilityDepartmentId = null;
  }

  return payload;
}

function buildFormFromNote(note) {
  if (!note?.id) return emptyForm;
  return {
    ownerType: note.ownerType || note.owner_type || '',
    ownerId: note.ownerId || note.owner_id || '',
    visibility: note.visibility || 'private',
    visibilityDepartmentId: note.visibilityDepartmentId || note.visibility_department_id || '',
    pinned: Boolean(note.pinned),
    content: note.content || '',
  };
}

export default function NoteDetailPage({ createMode = false }) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const isCreate = createMode || !id;
  const noteId = isCreate ? null : id;

  const { data: note, isFetching, isError } = useGetNoteByIdQuery(noteId, { skip: isCreate });
  const { data: notesFallbackData } = useGetNotesQuery(
    { limit: 200, sort: 'createdAt', dir: 'DESC' },
    { skip: isCreate || !noteId }
  );
  const { data: departmentsData } = useListDepartmentsQuery({ limit: 100 });
  const [createNote, { isLoading: creating }] = useCreateNoteMutation();
  const [updateNote, { isLoading: updating }] = useUpdateNoteMutation();
  const [deleteNote, { isLoading: deleting }] = useDeleteNoteMutation();

  const [form, setForm] = useState(() => ({
    ...emptyForm,
    ownerType: searchParams.get('ownerType') || '',
    ownerId: searchParams.get('ownerId') || '',
  }));
  const [baseline, setBaseline] = useState(() => normalizeForm(form));
  const [ownerSearch, setOwnerSearch] = useState('');
  const [ownerSearchDebounced, setOwnerSearchDebounced] = useState('');
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [formError, setFormError] = useState('');
  const [saveState, setSaveState] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const saving = creating || updating;
  const departments = useMemo(
    () => (Array.isArray(departmentsData) ? departmentsData : []),
    [departmentsData]
  );
  const fallbackNote = useMemo(
    () => (Array.isArray(notesFallbackData?.items)
      ? notesFallbackData.items.find((item) => String(item.id) === String(noteId))
      : null),
    [noteId, notesFallbackData?.items]
  );
  const resolvedNote = useMemo(() => {
    if (!note && !fallbackNote) return null;
    return {
      ...(fallbackNote || {}),
      ...(note || {}),
      ownerType: note?.ownerType || note?.owner_type || fallbackNote?.ownerType || fallbackNote?.owner_type,
      ownerId: note?.ownerId || note?.owner_id || fallbackNote?.ownerId || fallbackNote?.owner_id,
      ownerLabel: note?.ownerLabel || fallbackNote?.ownerLabel,
      ownerSubtitle: note?.ownerSubtitle || fallbackNote?.ownerSubtitle,
    };
  }, [fallbackNote, note]);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      setOwnerSearchDebounced(String(ownerSearch || '').trim());
    }, 320);
    return () => clearTimeout(timer);
  }, [ownerSearch]);

  const { data: ownerLookupData, isFetching: ownerLookupLoading } = useGetNoteOwnerOptionsQuery(
    {
      ownerType: form.ownerType,
      search: ownerSearchDebounced,
      limit: 20,
    },
    { skip: !form.ownerType }
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

  useEffect(() => {
    if (!isCreate || !form.ownerId || selectedOwner) return;
    const ownerTypeLabel = ownerTypeLabelMap[form.ownerType] || form.ownerType;
    const fallbackOwnerLabel = `${ownerTypeLabel} #${shortId(form.ownerId)}`;
    setSelectedOwner({
      id: form.ownerId,
      label: fallbackOwnerLabel,
      subtitle: form.ownerId,
    });
    setOwnerSearch(fallbackOwnerLabel);
  }, [form.ownerId, form.ownerType, isCreate, ownerTypeLabelMap, selectedOwner]);

  useEffect(() => {
    if (isCreate || !resolvedNote?.id) return;
    const nextForm = buildFormFromNote(resolvedNote);
    const ownerTypeLabel = ownerTypeLabelMap[nextForm.ownerType] || nextForm.ownerType;
    const fallbackOwnerLabel = resolvedNote?.ownerLabel || `${ownerTypeLabel} #${shortId(nextForm.ownerId)}`;
    setForm(nextForm);
    setBaseline(normalizeForm(nextForm));
    setSelectedOwner(
      nextForm.ownerId
        ? {
          id: nextForm.ownerId,
          label: fallbackOwnerLabel,
          subtitle: resolvedNote?.ownerSubtitle || nextForm.ownerId,
        }
        : null
    );
    setOwnerSearch(nextForm.ownerId ? fallbackOwnerLabel : '');
    setOwnerSearchDebounced('');
    setFormError('');
    setSaveState('');
  }, [isCreate, resolvedNote, ownerTypeLabelMap]);

  useEffect(() => {
    if (!isCreate) return;
    const nextBaseline = normalizeForm(form);
    setBaseline(nextBaseline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreate]);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      document.getElementById('note-detail-content')?.focus?.();
    });
  }, []);

  const derivedTitle = getDerivedNoteTitle(form.content) || t('notes.detail.newTitle');
  const contentEmpty = !String(form.content || '').trim();
  const dirty = JSON.stringify(normalizeForm(form)) !== JSON.stringify(baseline);

  const handleChange = useCallback((key, value) => {
    setSaveState('');
    setFormError('');
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleOwnerTypeChange = useCallback((value) => {
    setSaveState('');
    setFormError('');
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
    setSaveState('');

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
    setSaveState('');
    setFormError('');
    setForm((prev) => ({ ...prev, ownerId: String(option.id) }));
  }, []);

  const submit = useCallback(async (event) => {
    event?.preventDefault();
    if (saving) return;

    const payload = normalizeForm(form);
    setFormError('');
    setSaveState('');

    if (!payload.content) {
      setFormError(t('notes.validation.contentRequired'));
      return;
    }
    if (payload.visibility === 'department' && !payload.visibilityDepartmentId) {
      setFormError(t('visibility.departmentRequired'));
      return;
    }
    if (!payload.ownerType || !payload.ownerId) {
      setFormError(t('notes.validation.ownerRequired'));
      return;
    }

    try {
      if (isCreate) {
        const created = await createNote(payload).unwrap();
        const createdId = created?.id || created?.data?.id;
        if (createdId) {
          navigate(`/main/notes/${createdId}`, { replace: true });
          return;
        }
        navigate('/main/notes', { replace: true });
        return;
      }

      await updateNote({ id: noteId, payload }).unwrap();
      setBaseline(payload);
      setSaveState(t('notes.detail.saved'));
    } catch (error) {
      setFormError(
        error?.data?.error
        || error?.data?.message
        || error?.message
        || t('notes.validation.saveFailed')
      );
    }
  }, [createNote, form, isCreate, navigate, noteId, saving, t, updateNote]);

  const confirmDelete = useCallback(async () => {
    if (!noteId || deleting) return;
    setDeleteError('');
    try {
      await deleteNote(noteId).unwrap();
      navigate('/main/notes', { replace: true });
    } catch (error) {
      setDeleteError(
        error?.data?.error
        || error?.data?.message
        || error?.message
        || t('notes.validation.saveFailed')
      );
    }
  }, [deleteNote, deleting, navigate, noteId, t]);

  if (!isCreate && isFetching) {
    return (
      <main className={s.detailPage}>
        <div className={s.detailState}>{t('common.loading')}</div>
      </main>
    );
  }

  if (!isCreate && (isError || (!note && !fallbackNote))) {
    return (
      <main className={s.detailPage}>
        <div className={s.detailState}>{t('notes.detail.notFound')}</div>
        <button type="button" className={s.detailGhostButton} onClick={() => navigate('/main/notes')}>
          {t('notes.detail.back')}
        </button>
      </main>
    );
  }

  return (
    <main className={s.detailPage}>
      <form className={s.detailShell} onSubmit={submit}>
        <header className={s.detailHeader}>
          <button type="button" className={s.detailBack} onClick={() => navigate('/main/notes')}>
            {t('notes.detail.back')}
          </button>

          <div className={s.detailTitleBlock}>
            <h1 className={s.detailTitle} title={derivedTitle}>{derivedTitle}</h1>
            <div className={s.detailStatus}>
              {saveState || (dirty ? t('notes.detail.unsaved') : t('notes.detail.saved'))}
            </div>
          </div>

          <div className={s.detailActions}>
            {!isCreate ? (
              <button
                type="button"
                className={s.detailDangerButton}
                disabled={deleting}
                onClick={() => setDeleteOpen(true)}
              >
                {t('notes.actions.delete')}
              </button>
            ) : null}
            <button type="submit" className={s.detailPrimaryButton} disabled={saving || contentEmpty}>
              {saving
                ? t('common.saving')
                : isCreate
                  ? t('notes.actions.create')
                  : t('notes.actions.save')}
            </button>
          </div>
        </header>

        <section className={s.detailEditorSection}>
          <TextareaField
            id="note-detail-content"
            className={s.detailBodyField}
            inputClassName={s.detailTextarea}
            value={form.content}
            onValueChange={(value) => handleChange('content', value)}
            rows={18}
            placeholder={t('notes.placeholders.content')}
            autoFocus
          />
        </section>

        <section className={s.detailMetaPanel} aria-label={t('notes.fields.relatedTo')}>
          <div className={s.detailMetaTitle}>{t('notes.fields.relatedTo')}</div>
          <div className={s.detailRelationRow}>
            <SelectField
              className={s.field}
              inputClassName={s.select}
              label={t('notes.fields.relatedType')}
              value={form.ownerType}
              onValueChange={handleOwnerTypeChange}
              options={[
                { value: '', label: t('notes.placeholders.ownerType') },
                ...ownerTypeOptions,
              ]}
              placeholder={t('notes.placeholders.ownerType')}
              size="sm"
            />

            <div className={s.field}>
              <AutocompleteField
                label={t('notes.fields.relatedEntity')}
                value={selectedOwner}
                inputValue={ownerSearch}
                onInputChange={handleOwnerInputChange}
                options={ownerOptions}
                onSelect={handleOwnerSelect}
                placeholder={t('notes.placeholders.ownerSearch')}
                hint={form.ownerType ? t('notes.messages.typeToSearch') : t('notes.messages.selectOwnerTypeFirst')}
                searchingLabel={t('notes.messages.searching')}
                emptyLabel={t('notes.messages.emptyOwners')}
                loading={ownerLookupLoading}
                disabled={!form.ownerType}
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
              ) : form.ownerId ? (
                <span className={s.ownerIdHint}>
                  {t('notes.fields.selectedId')}: {form.ownerId}
                </span>
              ) : null}
            </div>
          </div>

          <div className={s.detailMetaRow}>
            <VisibilityField
              className={s.field}
              inputClassName={s.select}
              value={form.visibility}
              departmentId={form.visibilityDepartmentId}
              departments={departments}
              onChange={({ visibility, visibilityDepartmentId }) => {
                handleChange('visibility', visibility);
                handleChange('visibilityDepartmentId', visibilityDepartmentId);
              }}
              size="sm"
            />

            <CheckboxField
              className={s.pinControl}
              label={t('notes.fields.pinned')}
              checked={Boolean(form.pinned)}
              onValueChange={(checked) => handleChange('pinned', checked)}
            />
          </div>

          {formError ? <div className={s.error}>{formError}</div> : null}
        </section>
      </form>

      <ConfirmDialog
        open={deleteOpen}
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
          setDeleteOpen(false);
          setDeleteError('');
        }}
      />
    </main>
  );
}
