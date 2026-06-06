import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react';
import { useListWorkspaceViewsQuery } from '../../../store/rtk/workspaceViewsApi';
import { openManageDrawer } from '../../../store/slices/workspaceViewsDrawerSlice';
import { buildViewUrl } from '../../../utils/workspaceViews';
import s from './WorkspaceViewsFlyout.module.css';

// Sidebar hover/focus flyout — shows a quick-access list of workspace views to the
// right of the menu item it's attached to.
//
// Resolution rules:
//   - if any pinned views exist → show pinned (sortOrder asc).
//   - else → fall back to all visible (non-hidden) views as a discovery surface.
//   - bottom of the panel: a "Manage views" action that dispatches openManageDrawer.
//
// The component does not own its open state — the parent (Sidebar) controls it via
// `open`/`anchorEl` so the parent can implement hover-bridge timers without flicker.

const MAX_VIEWS = 8;

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

function useActiveMatcher(routeBase) {
  const { pathname, search } = useLocation();
  return useMemo(() => {
    const sp = new URLSearchParams(search);
    const urlViewId = sp.get('viewId');
    const urlViewKey = sp.get('view');
    return (view) => {
      if (!pathname.startsWith(routeBase)) return false;
      if (urlViewId) return view.id === urlViewId;
      if (urlViewKey) return view.scope === 'system' && view.key === urlViewKey;
      return !!view.isDefault;
    };
  }, [routeBase, pathname, search]);
}

export default function WorkspaceViewsFlyout({
  open,
  anchorEl,
  module,
  routeBase,
  titleKey,
  title,
  collapsedSidebar = false,
  onMouseEnter,
  onMouseLeave,
  onSelect,
  onClose,
}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { data } = useListWorkspaceViewsQuery({ module }, { skip: !open });
  const isActive = useActiveMatcher(routeBase);

  const [position, setPosition] = useState({ top: 0, left: 0, maxHeight: 480 });
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef(null);

  // Anchor: top edge of the panel = bottom edge of the menu item (minus a small lift
  // so the panel visually overlaps with the item by 8px). The panel grows downward.
  // The only time we move the panel up is when its height would overflow the bottom
  // of the viewport — then we shift it up just enough to fit, never re-centering it.
  // Horizontal: panel sits 8px right of the anchor's right edge.
  useEffect(() => {
    if (!open || !anchorEl) return undefined;
    const update = () => {
      const r = anchorEl.getBoundingClientRect();
      const left = Math.round(r.right + (collapsedSidebar ? 14 : 8));
      const maxH = Math.max(240, window.innerHeight - 32);
      // Anchor strategy: start the panel 8px above the item's bottom edge.
      let top = Math.round(r.bottom - 8);
      // Measure the actual rendered panel; on first frame it may not exist yet, fall
      // back to a conservative seed so we still place it reasonably before paint.
      const panelH = panelRef.current
        ? panelRef.current.getBoundingClientRect().height
        : Math.min(maxH, 360);
      const viewportBottomEdge = window.innerHeight - 16;
      if (top + panelH > viewportBottomEdge) {
        top = Math.max(16, viewportBottomEdge - panelH);
      }
      setPosition({ top, left, maxHeight: maxH });
    };
    update();
    // After the first paint the panel's real height is known — re-run once.
    const raf = requestAnimationFrame(update);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);

    // Re-clamp when the panel's own size changes (RTK Query data arriving, etc.).
    let ro = null;
    if (typeof ResizeObserver !== 'undefined' && panelRef.current) {
      ro = new ResizeObserver(() => update());
      ro.observe(panelRef.current);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      if (ro) ro.disconnect();
    };
  }, [open, anchorEl, collapsedSidebar, mounted]);

  // Mount → next frame → visible. Reverse on close so the exit animation can play.
  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const tm = setTimeout(() => setMounted(false), 220);
    return () => clearTimeout(tm);
  }, [open]);

  // Esc + click-outside close.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    const onDocClick = (e) => {
      if (panelRef.current && panelRef.current.contains(e.target)) return;
      if (anchorEl && anchorEl.contains(e.target)) return;
      onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDocClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDocClick);
    };
  }, [open, onClose, anchorEl]);

  const views = useMemo(
    () => (Array.isArray(data?.data) ? data.data : []),
    [data]
  );

  const items = useMemo(() => {
    const visibleViews = views.filter((v) => !v?.prefs?.hidden);
    const pinned = visibleViews
      .filter((v) => v?.prefs?.pinned)
      .slice()
      .sort((a, b) => (Number(a?.prefs?.sortOrder) || 0) - (Number(b?.prefs?.sortOrder) || 0));
    if (pinned.length > 0) return pinned.slice(0, MAX_VIEWS);
    // No pinned → fall back to system + personal visible views for discovery.
    return visibleViews
      .slice()
      .sort((a, b) => {
        // System first so the default catalogue surfaces cleanly.
        const sa = a.scope === 'system' ? 0 : 1;
        const sb = b.scope === 'system' ? 0 : 1;
        if (sa !== sb) return sa - sb;
        return String(a?.name || '').localeCompare(String(b?.name || ''));
      })
      .slice(0, MAX_VIEWS);
  }, [views]);

  if (!mounted) return null;

  const headerLabel = title || (titleKey ? t(titleKey, '') : '');

  const onManage = () => {
    dispatch(openManageDrawer(module));
    onClose?.();
  };

  return createPortal(
    <div
      ref={panelRef}
      className={`${s.panel} ${visible ? s.visible : ''}`}
      style={{ top: position.top, left: position.left, maxHeight: position.maxHeight }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="menu"
      aria-label={headerLabel || 'Workspace views'}
    >
      {headerLabel ? (
        <div className={s.header}>
          <Lucide.LayoutGrid size={12} strokeWidth={2} className={s.headerIcon} />
          <span className={s.headerText}>{headerLabel}</span>
        </div>
      ) : null}

      <ul className={s.list}>
        {items.length === 0 ? (
          <li className={s.empty}>{t('workspaceViews.empty', 'No views available')}</li>
        ) : null}
        {items.map((view) => {
          const Icon = pickIcon(view.icon) || Lucide.LayoutGrid;
          const label = resolveLabel(t, view);
          const active = isActive(view);
          const personal = view.scope === 'personal';
          return (
            <li key={view.id} className={s.row}>
              <Link
                to={buildViewUrl(routeBase, view)}
                className={`${s.item} ${active ? s.itemActive : ''}`}
                onClick={() => {
                  onSelect?.(view);
                  onClose?.();
                }}
                role="menuitem"
              >
                <Icon size={14} strokeWidth={1.8} className={s.itemIcon} />
                <span className={s.itemLabel} title={label}>{label}</span>
                {personal ? (
                  <span className={s.personalBadge} aria-hidden="true">P</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className={s.divider} />
      <button type="button" className={s.manageBtn} onClick={onManage}>
        <Lucide.Settings2 size={14} strokeWidth={1.8} />
        <span>{t('workspaceViews.manage', 'Manage views')}</span>
      </button>
    </div>,
    document.body
  );
}
