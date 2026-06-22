import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react';
import { SearchField } from '../../ui/fields';
import {
  useListWorkspaceViewsQuery,
  useTouchWorkspaceViewMutation,
} from '../../../store/rtk/workspaceViewsApi';
import { openManageDrawer } from '../../../store/slices/workspaceViewsDrawerSlice';
import {
  buildViewUrl,
  groupViewsForPicker,
  resolveActiveView,
} from '../../../utils/workspaceViews';
import s from './WorkspaceViewPicker.module.css';

// Resolves a Lucide icon by name. Falls back to a neutral square when missing.
function pickIcon(name) {
  if (!name || typeof name !== 'string') return null;
  return Lucide[name] || null;
}

// View label resolver:
//   personal views: the user-typed `name` is canonical.
//   system views with `nameI18nKey`: try i18n, fall back to `name`.
function resolveLabel(t, view) {
  if (!view) return '';
  if (view.scope === 'system' && view.nameI18nKey) {
    return t(view.nameI18nKey, view.name || view.key);
  }
  return view.name || view.key || '';
}

// Render a single tab/list entry.
function ViewEntry({ view, isActive, onActivate, t, mode }) {
  const Icon = pickIcon(view.icon) || Lucide.LayoutGrid;
  const label = resolveLabel(t, view);
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className={mode === 'tabs'
        ? `${s.tab} ${isActive ? s.tabActive : ''}`
        : `${s.dropdownItem} ${isActive ? s.dropdownItemActive : ''}`}
      onClick={() => onActivate(view)}
    >
      {Icon ? <Icon size={mode === 'tabs' ? 14 : 16} strokeWidth={1.8} className={s.entryIcon} /> : null}
      <span className={s.entryLabel}>{label}</span>
      {view?.prefs?.pinned ? <span className={s.pinDot} aria-hidden="true" /> : null}
    </button>
  );
}

// Touch is debounced: when user toggles through tabs quickly, we don't want to spam
// the touch endpoint. We fire 1s after the last view activation.
function useTouchDebouncer(ms = 1000) {
  const [touchMut] = useTouchWorkspaceViewMutation();
  const timerRef = useRef(null);
  const queuedRef = useRef(null);

  const schedule = (viewId) => {
    if (!viewId) return;
    queuedRef.current = viewId;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const id = queuedRef.current;
      queuedRef.current = null;
      timerRef.current = null;
      if (id) touchMut({ id }).catch(() => { /* best-effort: silent */ });
    }, ms);
  };

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return schedule;
}

export default function WorkspaceViewPicker({
  module,
  routeBase,
  activeViewId = null,
  activeViewKey = null,
  onViewActivated,
  onOpenManage,
  onCreateView,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // If the caller doesn't pass `onOpenManage`, the picker dispatches the shared slice
  // action so the drawer mounted at the page level opens for this module.
  const handleOpenManage = onOpenManage || (() => dispatch(openManageDrawer(module)));
  const { data, isLoading, isError } = useListWorkspaceViewsQuery({ module });
  const views = useMemo(() => (Array.isArray(data?.data) ? data.data : []), [data]);

  const { mode, items } = useMemo(
    () => groupViewsForPicker(views, { tabsThreshold: 6 }),
    [views]
  );

  const activeView = useMemo(
    () => resolveActiveView(items, activeViewId, activeViewKey),
    [items, activeViewId, activeViewKey]
  );

  const scheduleTouch = useTouchDebouncer(1000);

  // Activation = navigate to the matching URL and schedule a touch. We don't push the
  // touch in onClick directly because the URL-driven re-render is the source of truth
  // and the cached list shouldn't refetch on every click (see touch invalidatesTags=[]).
  const activate = (view) => {
    if (!view) return;
    const url = buildViewUrl(routeBase, view);
    navigate(url);
    scheduleTouch(view.id);
    if (typeof onViewActivated === 'function') {
      try { onViewActivated(view); } catch (_) { /* swallow */ }
    }
  };

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownFilter, setDropdownFilter] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!dropdownOpen) return undefined;
    const onDocClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [dropdownOpen]);

  if (isLoading) {
    return (
      <div className={s.wrap} aria-busy="true">
        <span className={s.loading}>{t('common.loading', 'Loading…')}</span>
      </div>
    );
  }

  if (isError || items.length === 0) {
    return (
      <div className={s.wrap}>
        <span className={s.empty}>{t('workspaceViews.empty', 'No views available')}</span>
      </div>
    );
  }

  const onManage = () => {
    setDropdownOpen(false);
    handleOpenManage();
  };

  const onCreate = () => {
    if (typeof onCreateView === 'function') onCreateView();
  };

  if (mode === 'tabs') {
    return (
      <div className={s.wrap} role="tablist">
        <div className={s.tabs}>
          {items.map((v) => (
            <ViewEntry
              key={v.id}
              view={v}
              isActive={activeView?.id === v.id}
              onActivate={activate}
              t={t}
              mode="tabs"
            />
          ))}
        </div>
        <div className={s.actions}>
          <button
            type="button"
            className={s.actionBtn}
            onClick={onManage}
            title={t('workspaceViews.manage', 'Manage views')}
          >
            <Lucide.Settings2 size={14} strokeWidth={1.8} />
            <span>{t('workspaceViews.manage', 'Manage views')}</span>
          </button>
          {typeof onCreateView === 'function' ? (
            <button type="button" className={s.actionBtn} onClick={onCreate} title={t('workspaceViews.saveAsView', 'Save as view')}>
              <Lucide.Plus size={14} strokeWidth={2} />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  // Dropdown mode (>6 views).
  const filtered = dropdownFilter
    ? items.filter((v) => resolveLabel(t, v).toLowerCase().includes(dropdownFilter.trim().toLowerCase()))
    : items;
  const triggerLabel = resolveLabel(t, activeView) || t('workspaceViews.allViews', 'All views');

  return (
    <div className={s.wrap} ref={dropdownRef}>
      <button
        type="button"
        className={s.dropdownTrigger}
        onClick={() => setDropdownOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={dropdownOpen}
      >
        <span className={s.triggerLabel}>{triggerLabel}</span>
        <Lucide.ChevronDown size={14} strokeWidth={2} />
      </button>
      {dropdownOpen ? (
        <div className={s.dropdown} role="listbox">
          <div className={s.dropdownSearch}>
            <Lucide.Search size={14} strokeWidth={1.8} />
            <SearchField
              value={dropdownFilter}
              onValueChange={setDropdownFilter}
              placeholder={t('workspaceViews.searchPlaceholder', 'Search views…')}
              autoFocus
              fullWidth
            />
          </div>
          <div className={s.dropdownList}>
            {filtered.map((v) => (
              <ViewEntry
                key={v.id}
                view={v}
                isActive={activeView?.id === v.id}
                onActivate={(view) => {
                  activate(view);
                  setDropdownOpen(false);
                }}
                t={t}
                mode="dropdown"
              />
            ))}
            {filtered.length === 0 ? (
              <div className={s.dropdownEmpty}>
                {t('workspaceViews.noMatch', 'No views match')}
              </div>
            ) : null}
          </div>
          <div className={s.dropdownFooter}>
            <button
              type="button"
              className={s.actionBtn}
              onClick={onManage}
            >
              <Lucide.Settings2 size={14} strokeWidth={1.8} />
              <span>{t('workspaceViews.manage', 'Manage views')}</span>
            </button>
            {typeof onCreateView === 'function' ? (
              <button type="button" className={s.actionBtn} onClick={onCreate}>
                <Lucide.Plus size={14} strokeWidth={2} />
                <span>{t('workspaceViews.create', 'Create view')}</span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
