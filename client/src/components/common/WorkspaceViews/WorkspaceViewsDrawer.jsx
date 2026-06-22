import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react';
import { TextField } from '../../ui/fields';
import {
  useListWorkspaceViewsQuery,
  usePinWorkspaceViewMutation,
  useHideWorkspaceViewMutation,
  useDeleteWorkspaceViewMutation,
  useUpdateWorkspaceViewMutation,
} from '../../../store/rtk/workspaceViewsApi';
import s from './WorkspaceViewsDrawer.module.css';

// Manage drawer (spec §13.3, Phase 3). Slide-in from the right, ~420px wide. Lists every
// view for the module — system + personal, including hidden ones. Per-row actions:
//   - pin/unpin                  → both scopes
//   - hide/unhide                → both scopes (note: hide auto-unpins server-side)
//   - rename inline              → personal only
//   - delete                     → personal only
// Create-new-view button is rendered but disabled — that lands in Phase 4.

function pickIcon(name) {
  if (!name || typeof name !== 'string') return null;
  return Lucide[name] || null;
}

function resolveLabel(t, view) {
  if (!view) return '';
  if (view.scope === 'system' && view.nameI18nKey) {
    return t(view.nameI18nKey, view.name || view.key);
  }
  return view.name || view.key || '';
}

function ManageRow({ view, t, busy, onPin, onHide, onRename, onDelete }) {
  const isSystem = view.scope === 'system';
  const Icon = pickIcon(view.icon) || Lucide.LayoutGrid;
  const label = resolveLabel(t, view);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(view.name || '');

  // Keep the draft in sync with server-side renames coming through cache invalidation.
  useEffect(() => {
    if (!editing) setDraftName(view.name || '');
  }, [view.name, editing]);

  const commitRename = () => {
    const next = draftName.trim();
    if (!next || next === view.name) {
      setEditing(false);
      setDraftName(view.name || '');
      return;
    }
    onRename(view, next);
    setEditing(false);
  };

  const cancelRename = () => {
    setEditing(false);
    setDraftName(view.name || '');
  };

  const pinned = !!view?.prefs?.pinned;
  const hidden = !!view?.prefs?.hidden;

  return (
    <div className={`${s.row} ${hidden ? s.rowHidden : ''}`}>
      <div className={s.rowMain}>
        <Icon size={16} strokeWidth={1.8} className={s.rowIcon} />
        <div className={s.rowText}>
          {editing ? (
            <TextField
              inputClassName={s.renameInput}
              value={draftName}
              autoFocus
              maxLength={120}
              onValueChange={setDraftName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                else if (e.key === 'Escape') cancelRename();
              }}
              onBlur={commitRename}
            />
          ) : (
            <span className={s.rowName} title={label}>{label}</span>
          )}
          <div className={s.rowMeta}>
            <span className={`${s.badge} ${isSystem ? s.badgeSystem : s.badgePersonal}`}>
              {isSystem ? t('workspaceViews.system', 'System') : t('workspaceViews.personal', 'Personal')}
            </span>
            {isSystem ? (
              <Lucide.Lock size={11} strokeWidth={2} className={s.lockIcon} aria-hidden="true" />
            ) : null}
            {view.isDefault ? (
              <span className={s.defaultMark}>{t('workspaceViews.default', 'Default')}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className={s.rowActions}>
        <button
          type="button"
          className={`${s.iconBtn} ${pinned ? s.iconBtnActive : ''}`}
          onClick={() => onPin(view, !pinned)}
          disabled={busy}
          title={pinned ? t('workspaceViews.unpin', 'Unpin') : t('workspaceViews.pin', 'Pin')}
        >
          {pinned
            ? <Lucide.PinOff size={14} strokeWidth={1.8} />
            : <Lucide.Pin size={14} strokeWidth={1.8} />}
        </button>
        <button
          type="button"
          className={`${s.iconBtn} ${hidden ? s.iconBtnActive : ''}`}
          onClick={() => onHide(view, !hidden)}
          disabled={busy}
          title={hidden ? t('workspaceViews.show', 'Show') : t('workspaceViews.hide', 'Hide')}
        >
          {hidden
            ? <Lucide.EyeOff size={14} strokeWidth={1.8} />
            : <Lucide.Eye size={14} strokeWidth={1.8} />}
        </button>
        {!isSystem ? (
          <>
            <button
              type="button"
              className={s.iconBtn}
              onClick={() => setEditing(true)}
              disabled={busy || editing}
              title={t('workspaceViews.rename', 'Rename')}
            >
              <Lucide.Pencil size={14} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className={`${s.iconBtn} ${s.iconBtnDanger}`}
              onClick={() => onDelete(view)}
              disabled={busy}
              title={t('workspaceViews.delete', 'Delete')}
            >
              <Lucide.Trash2 size={14} strokeWidth={1.8} />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function WorkspaceViewsDrawer({ module, open, onClose, onCreate }) {
  const { t } = useTranslation();
  const { data, isFetching, isError } = useListWorkspaceViewsQuery(
    { module, includeHidden: true },
    { skip: !open }
  );
  const [pinMut, pinState] = usePinWorkspaceViewMutation();
  const [hideMut, hideState] = useHideWorkspaceViewMutation();
  const [deleteMut, deleteState] = useDeleteWorkspaceViewMutation();
  const [updateMut, updateState] = useUpdateWorkspaceViewMutation();

  const busy = pinState.isLoading || hideState.isLoading
    || deleteState.isLoading || updateState.isLoading;

  // Mount-then-visible coordination so the drawer can play an enter/exit transition.
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const tm = setTimeout(() => setMounted(false), 240);
    return () => clearTimeout(tm);
  }, [open]);

  // Esc to close.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const views = useMemo(
    () => (Array.isArray(data?.data) ? data.data : []),
    [data]
  );

  // Render order matches the picker rule: pinned first by sortOrder, then by lastUsedAt
  // desc, then alphabetically. Hidden views go to the bottom so the user sees the active
  // surface first.
  const sortedViews = useMemo(() => {
    const sorted = views.slice().sort((a, b) => {
      const ha = a?.prefs?.hidden ? 1 : 0;
      const hb = b?.prefs?.hidden ? 1 : 0;
      if (ha !== hb) return ha - hb;
      const pa = a?.prefs?.pinned ? 0 : 1;
      const pb = b?.prefs?.pinned ? 0 : 1;
      if (pa !== pb) return pa - pb;
      if (pa === 0) {
        const sa = Number(a?.prefs?.sortOrder) || 0;
        const sb = Number(b?.prefs?.sortOrder) || 0;
        if (sa !== sb) return sa - sb;
      }
      const la = a?.prefs?.lastUsedAt ? Date.parse(a.prefs.lastUsedAt) : 0;
      const lb = b?.prefs?.lastUsedAt ? Date.parse(b.prefs.lastUsedAt) : 0;
      if (la !== lb) return lb - la;
      return String(a?.name || '').localeCompare(String(b?.name || ''));
    });
    return sorted;
  }, [views]);

  const onPin = (view, pinned) => {
    pinMut({ id: view.id, pinned }).catch(() => { /* swallow; mutation surfaces error in cache */ });
  };
  const onHide = (view, hidden) => {
    hideMut({ id: view.id, hidden }).catch(() => {});
  };
  const onDelete = (view) => {
    // eslint-disable-next-line no-alert
    const ok = window.confirm(t('workspaceViews.confirmDelete', 'Delete this view? This cannot be undone.'));
    if (!ok) return;
    deleteMut({ id: view.id, module }).catch(() => {});
  };
  const onRename = (view, name) => {
    updateMut({ id: view.id, name }).catch(() => {});
  };

  if (!mounted) return null;

  return createPortal(
    <div className={`${s.layer} ${visible ? s.layerVisible : ''}`} aria-modal="true" role="dialog">
      <div className={s.backdrop} onClick={onClose} />
      <aside className={`${s.panel} ${visible ? s.panelVisible : ''}`}>
        <header className={s.header}>
          <div className={s.headerTitle}>
            <Lucide.Settings2 size={16} strokeWidth={1.8} />
            <span>{t('workspaceViews.manage', 'Manage views')}</span>
          </div>
          <button type="button" className={s.closeBtn} onClick={onClose} aria-label="Close">
            <Lucide.X size={16} strokeWidth={1.8} />
          </button>
        </header>

        <div className={s.body}>
          {isFetching && sortedViews.length === 0 ? (
            <div className={s.muted}>{t('common.loading', 'Loading…')}</div>
          ) : null}
          {isError ? (
            <div className={s.error}>{t('common.errorGeneric', 'Something went wrong')}</div>
          ) : null}
          {!isFetching && !isError && sortedViews.length === 0 ? (
            <div className={s.muted}>{t('workspaceViews.noViews', 'No views')}</div>
          ) : null}
          {sortedViews.map((view) => (
            <ManageRow
              key={view.id}
              view={view}
              t={t}
              busy={busy}
              onPin={onPin}
              onHide={onHide}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>

        <footer className={s.footer}>
          <button
            type="button"
            className={s.createBtn}
            disabled={typeof onCreate !== 'function'}
            onClick={() => {
              if (typeof onCreate === 'function') {
                onClose?.();
                onCreate();
              }
            }}
            title={typeof onCreate === 'function'
              ? t('workspaceViews.createNewView', 'Create new view')
              : t('workspaceViews.comingSoon', 'Coming soon')}
          >
            <Lucide.Plus size={14} strokeWidth={2} />
            <span>{t('workspaceViews.createNewView', 'Create new view')}</span>
          </button>
        </footer>
      </aside>
    </div>,
    document.body
  );
}
