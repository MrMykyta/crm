import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react';
import { useCreateWorkspaceViewMutation } from '../../../store/rtk/workspaceViewsApi';
import { describeFilterClauses } from '../../../utils/workspaceViewsWmsDocumentsFilter';
import s from './WorkspaceViewEditor.module.css';

// Create-personal-view editor (Phase 4, spec §13.4).
// MVP: name + description + chips-preview of the filter. The filter itself is taken
// verbatim from `initialFilter` — there is no inline JSON/filter editor here.
//
// On success the parent receives the created view via onCreated(view); typical caller
// closes the modal and navigates to `?viewId=<view.id>`.
//
// Backend errors we surface specifically:
//   PERSONAL_VIEW_LIMIT_EXCEEDED → friendly "limit reached" message
//   VALIDATION_ERROR             → server-reported message
//   anything else                → generic fallback

const NAME_MAX = 120;
const DESCRIPTION_MAX = 500;
const DEFAULT_ICON = 'LayoutGrid';

export default function WorkspaceViewEditor({
  open,
  module,
  initialFilter = { where: [] },
  initialName = '',
  onClose,
  onCreated,
}) {
  const { t } = useTranslation();
  const [createMut, createState] = useCreateWorkspaceViewMutation();

  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);

  // Reset form whenever the modal toggles back open — supports "open repeatedly with
  // different filter from URL" without leaking the previous attempt's state.
  useEffect(() => {
    if (open) {
      setName(initialName || '');
      setDescription('');
      setError(null);
    }
  }, [open, initialName]);

  // Esc closes; backdrop click closes.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !createState.isLoading) onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, createState.isLoading]);

  const filterClauses = useMemo(
    () => describeFilterClauses(initialFilter),
    [initialFilter]
  );

  const trimmedName = name.trim();
  const nameValid = trimmedName.length > 0 && trimmedName.length <= NAME_MAX;
  const submitting = createState.isLoading;

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!nameValid || submitting) return;
    setError(null);
    try {
      const payload = {
        module,
        name: trimmedName,
        icon: DEFAULT_ICON,
        filter: initialFilter && typeof initialFilter === 'object' ? initialFilter : { where: [] },
      };
      const trimmedDesc = description.trim();
      if (trimmedDesc) payload.description = trimmedDesc;

      const created = await createMut(payload).unwrap();
      if (typeof onCreated === 'function') onCreated(created);
    } catch (err) {
      const code = err?.data?.code;
      if (code === 'PERSONAL_VIEW_LIMIT_EXCEEDED') {
        setError({ code, message: t(
          'workspaceViews.editor.errorLimitExceeded',
          'You have reached the personal-view limit (50). Delete or hide an existing view first.'
        ) });
      } else if (code === 'VALIDATION_ERROR') {
        setError({ code, message: err?.data?.message || t('common.errorGeneric', 'Validation failed') });
      } else {
        setError({ code: code || 'UNKNOWN', message: err?.data?.message || t('common.errorGeneric', 'Something went wrong') });
      }
    }
  };

  if (!open) return null;

  return createPortal(
    <div className={s.layer} role="dialog" aria-modal="true">
      <div
        className={s.backdrop}
        onClick={() => { if (!submitting) onClose?.(); }}
      />
      <div className={s.modal}>
        <header className={s.header}>
          <div className={s.headerTitle}>
            <Lucide.Plus size={16} strokeWidth={1.8} />
            <span>{t('workspaceViews.editor.title', 'Create view')}</span>
          </div>
          <button
            type="button"
            className={s.closeBtn}
            onClick={() => onClose?.()}
            disabled={submitting}
            aria-label="Close"
          >
            <Lucide.X size={16} strokeWidth={1.8} />
          </button>
        </header>

        <form className={s.body} onSubmit={handleSubmit}>
          <label className={s.field}>
            <span className={s.fieldLabel}>
              {t('workspaceViews.editor.name', 'View name')}
              <span className={s.required} aria-hidden="true">*</span>
            </span>
            <input
              type="text"
              className={s.input}
              value={name}
              maxLength={NAME_MAX}
              placeholder={t('workspaceViews.editor.namePlaceholder', 'e.g. WZ Łódź posted')}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
            <span className={s.charCounter}>{trimmedName.length}/{NAME_MAX}</span>
          </label>

          <label className={s.field}>
            <span className={s.fieldLabel}>{t('workspaceViews.editor.description', 'Description')}</span>
            <textarea
              className={`${s.input} ${s.textarea}`}
              value={description}
              maxLength={DESCRIPTION_MAX}
              rows={2}
              placeholder={t('workspaceViews.editor.descriptionPlaceholder', 'Optional notes for yourself')}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div className={s.field}>
            <span className={s.fieldLabel}>{t('workspaceViews.editor.filterPreview', 'Filter preview')}</span>
            {filterClauses.length === 0 ? (
              <div className={s.emptyFilter}>
                {t('workspaceViews.editor.noFilters', 'No filters — saves an unfiltered list view.')}
              </div>
            ) : (
              <div className={s.chips}>
                {filterClauses.map((c) => (
                  <span key={c.key} className={s.chip}>
                    <span className={s.chipLabel}>
                      {c.labelKey ? t(c.labelKey, c.fallback) : c.label}
                    </span>
                    <span className={s.chipValue}>{c.value}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error ? (
            <div className={s.errorBox} role="alert">
              {error.message}
            </div>
          ) : null}

          <footer className={s.footer}>
            <button
              type="button"
              className={s.cancelBtn}
              onClick={() => onClose?.()}
              disabled={submitting}
            >
              {t('workspaceViews.editor.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              className={s.submitBtn}
              disabled={!nameValid || submitting}
            >
              {submitting
                ? t('common.loading', 'Loading…')
                : t('workspaceViews.editor.create', 'Create')}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body
  );
}
