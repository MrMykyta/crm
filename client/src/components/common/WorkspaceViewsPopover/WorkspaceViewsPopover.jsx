import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutGrid, ChevronRight } from 'lucide-react';
import s from './WorkspaceViewsPopover.module.css';

// Universal Workspace Views popover.
//
// Designed to be reused across modules (Leads, Deals, Orders, Documents, WMS, PIM, ...).
// The component does not own the open state — the parent controls it via the `open` prop
// so the parent can implement hover/focus/click semantics suited to the surface (sidebar
// hover bridge, toolbar button, command palette, ...).
//
// Props:
//   open           — boolean. The panel is mounted with an enter animation while true;
//                    when toggled to false, the exit animation plays before unmount.
//   anchorEl       — the element to anchor the panel to (DOM node). Position is recomputed
//                    on scroll/resize so the popover follows its anchor (useful when the
//                    sidebar scrolls).
//   views          — array of view descriptors:
//                      { key, labelKey?, label?, fallback?, icon?, params? }
//                    `params` is a record merged into the query string for that view
//                    (default is `?view=<key>`).
//   routeBase      — pathname the popover navigates to (e.g. '/main/wms/documents').
//                    Each view becomes `${routeBase}?view=${key}`.
//   activeViewKey  — currently selected view; the matching entry is highlighted.
//   defaultViewKey — fallback used when no view is selected ('all' by default).
//   titleKey       — i18n key for the popover header. `title` overrides this.
//   title          — explicit header string.
//   onMouseEnter   — called when cursor enters the panel; the parent uses this to cancel
//                    its close timer and keep the popover open while the user moves from
//                    the menu item into the panel.
//   onMouseLeave   — called when the cursor leaves the panel; the parent schedules close.
//   onSelect       — optional callback fired on view click (for parent state, telemetry).
//
// Stage-1 scope: read-only views. Pinning / custom-view editing / starring will arrive
// later — the popover already leaves space for a future header action slot.
export default function WorkspaceViewsPopover({
  open,
  anchorEl,
  views,
  routeBase,
  activeViewKey,
  defaultViewKey = 'all',
  titleKey,
  title,
  onMouseEnter,
  onMouseLeave,
  onSelect,
}) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const panelRef = useRef(null);

  // Position tracking — recompute on scroll/resize so the panel sticks to its anchor.
  useEffect(() => {
    if (!open || !anchorEl) return undefined;
    const updatePosition = () => {
      const r = anchorEl.getBoundingClientRect();
      setPosition({
        top: Math.round(r.top),
        left: Math.round(r.right + 8),
      });
    };
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, anchorEl]);

  // Mount + visibility coordination — drives the enter/exit slide animation.
  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const t1 = setTimeout(() => setMounted(false), 240);
    return () => clearTimeout(t1);
  }, [open]);

  const headerLabel = useMemo(() => {
    if (title) return title;
    if (titleKey) return t(titleKey, '');
    return '';
  }, [title, titleKey, t]);

  if (!mounted || !Array.isArray(views) || views.length === 0) return null;

  return createPortal(
    <div
      ref={panelRef}
      className={`${s.popover} ${visible ? s.visible : ''}`}
      style={{ top: position.top, left: position.left }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="menu"
    >
      {headerLabel ? (
        <div className={s.header}>
          <LayoutGrid size={12} strokeWidth={2} className={s.headerIcon} />
          <span className={s.headerText}>{headerLabel}</span>
        </div>
      ) : null}

      <ul className={s.list}>
        {views.map((view) => {
          const Icon = view.icon || null;
          const label = view.label
            || (view.labelKey ? t(view.labelKey, view.fallback || view.key) : view.fallback || view.key);
          const search = new URLSearchParams();
          search.set('view', view.key);
          if (view.params && typeof view.params === 'object') {
            Object.entries(view.params).forEach(([k, v]) => {
              if (v !== null && v !== undefined) search.set(k, String(v));
            });
          }
          const isActive = activeViewKey
            ? activeViewKey === view.key
            : view.key === defaultViewKey;
          return (
            <li key={view.key} className={s.row}>
              <Link
                to={`${routeBase}?${search.toString()}`}
                className={`${s.item} ${isActive ? s.itemActive : ''}`}
                onClick={(e) => {
                  if (typeof onSelect === 'function') onSelect(view, e);
                }}
                role="menuitem"
              >
                {Icon ? (
                  <Icon size={14} strokeWidth={1.8} className={s.itemIcon} />
                ) : (
                  <span className={s.itemDot} aria-hidden="true" />
                )}
                <span className={s.itemLabel}>{label}</span>
                <ChevronRight size={12} strokeWidth={2} className={s.itemChev} />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>,
    document.body
  );
}
