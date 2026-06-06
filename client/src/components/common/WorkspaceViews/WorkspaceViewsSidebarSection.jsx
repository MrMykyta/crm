import React, { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react';
import { useListWorkspaceViewsQuery } from '../../../store/rtk/workspaceViewsApi';
import { openManageDrawer } from '../../../store/slices/workspaceViewsDrawerSlice';
import { buildViewUrl, groupViewsForSidebar } from '../../../utils/workspaceViews';
import s from './WorkspaceViewsSidebarSection.module.css';

// Sidebar pinned-views sub-list. Renders under a module item in the sidebar (e.g. the
// "Warehouse documents" entry). MVP behaviour (spec §6 + §13.2):
//   - expanded sidebar: render up to 5 pinned views; show "+N more" if overflow.
//   - collapsed sidebar: render nothing (the parent shows a flyout there).
//   - 0 pinned: render nothing.
// The component never owns navigation state — clicking a row sets the URL via NavLink.

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

// A row counts as "active" when the user is on its routeBase AND the URL view selector
// matches the row. Mirrors the resolution rules from §5.
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

export default function WorkspaceViewsSidebarSection({
  module,
  routeBase,
  collapsed = false,
  styles: parentStyles,
  onOpenManage,
}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { data } = useListWorkspaceViewsQuery({ module }, { skip: collapsed });
  const isActive = useActiveMatcher(routeBase);

  const handleOpenManage = onOpenManage || (() => dispatch(openManageDrawer(module)));

  const { pinned, overflowCount } = useMemo(
    () => groupViewsForSidebar(Array.isArray(data?.data) ? data.data : [], { max: 5 }),
    [data]
  );

  // Collapsed sidebar: spec says pinned views aren't shown (flyout takes over). We bail
  // here to keep the menu width math clean.
  if (collapsed) return null;
  if (!pinned || pinned.length === 0) return null;

  const itemClass = parentStyles?.item || s.item;
  const activeClass = parentStyles?.active || s.itemActive;

  return (
    <div className={s.section}>
      {pinned.map((view) => {
        const Icon = pickIcon(view.icon) || Lucide.Dot;
        const label = resolveLabel(t, view);
        const active = isActive(view);
        return (
          <NavLink
            key={view.id}
            to={buildViewUrl(routeBase, view)}
            className={`${itemClass} ${s.pinnedRow} ${active ? activeClass : ''}`}
            title={label}
          >
            <Icon size={14} strokeWidth={1.8} className={s.pinnedIcon} />
            <span className={s.pinnedLabel}>{label}</span>
          </NavLink>
        );
      })}
      {overflowCount > 0 ? (
        <button
          type="button"
          className={s.moreBtn}
          onClick={handleOpenManage}
          title={t('workspaceViews.moreCount', '+{{count}} more', { count: overflowCount })}
        >
          {t('workspaceViews.moreCount', '+{{count}} more', { count: overflowCount })}
        </button>
      ) : null}
    </div>
  );
}
