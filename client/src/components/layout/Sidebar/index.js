import { Link, NavLink, useLocation } from "react-router-dom";
import { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useSelector } from "react-redux";
import { MENU } from "../../../config/menu";
import SidebarTooltip from "../SidebarTooltip";
import CompanyMenu from "../../company/CompanyMenu";
import ViewsSidebarSection from "../../common/WorkspaceViews/WorkspaceViewsSidebarSection";
import ViewsFlyout from "../../common/WorkspaceViews/WorkspaceViewsFlyout";
import { useSignedFileUrl } from "../../../hooks/useSignedFileUrl";
import { useListWarehousesQuery } from "../../../store/rtk/wmsDocumentsApi";
import useAclPermissions, { hasAclRequirements } from "../../../hooks/useAclPermissions";
import styles from "./Sidebar.module.css";

// RTK Query — данные компании
import { useGetCompanyQuery } from "../../../store/rtk/companyApi";

// Компонент Sidebar: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function Sidebar({ collapsed = false, onToggle, onNavigate, t }) {
  const { pathname } = useLocation();
  const brandWrapRef = useRef(null);
  const acl = useAclPermissions();

  // из Redux
  const companyId = useSelector(s => s.auth?.companyId);

  // подгружаем компанию через RTK Query
  const { data: company, isFetching: loadingCompany } = useGetCompanyQuery(companyId, {
    skip: !companyId,
  });
  const { data: sidebarWarehousesData } = useListWarehousesQuery(
    { limit: 200, sort: 'code', dir: 'ASC' },
    { skip: !companyId }
  );
  const warehousesLoaded = Array.isArray(sidebarWarehousesData?.items);
  const navigationDisabledKeys = useMemo(() => (
    warehousesLoaded && sidebarWarehousesData.items.length < 2 ? { MM: true } : {}
  ), [sidebarWarehousesData, warehousesLoaded]);

  const [preAvatar, setPreAvatar] = useState(() => {
    try {
      const css = getComputedStyle(document.documentElement)
        .getPropertyValue("--company-avatar-url")
        .trim();
      const m = css && css.match(/^url\("(.+)"\)$/);
      return m ? m[1] : "";
    } catch { return ""; }
  });

  const [menuCompanyOpen, setMenuCompanyOpen] = useState(false);

  useEffect(() => {
        // onReady: вспомогательная логика компонента.
const onReady = (e) => setPreAvatar(e?.detail?.url || "");
    window.addEventListener("company:avatar-ready", onReady);
    return () => window.removeEventListener("company:avatar-ready", onReady);
  }, []);

  const companyName = company?.shortName || company?.name || "Workspace";
  const companySub = company?.vat || company?.domain || "";
  const initials = (companyName || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  const { url: companyAvatarUrl, onError: onCompanyAvatarError } = useSignedFileUrl(company?.avatarUrl || preAvatar || "");

  const sections = useMemo(() => {
    const canShow = (item) => hasAclRequirements(acl, item);
    const res = [];
    let current = null;
    for (const item of MENU) {
      if (item.type === "section") {
        current = { ...item, children: [] };
        res.push(current);
      } else if (!canShow(item)) {
        continue;
      } else if (current) {
        current.children.push(item);
      } else {
        res.push(item);
      }
    }
    return res.filter((item) => item.type !== "section" || item.children.length > 0);
  }, [acl]);

    // tr: вспомогательная логика компонента.
const tr = (key) => (t ? t(key) : key);

  // ---- tooltip state
  const [tip, setTip] = useState({ visible: false, text: "", x: 0, y: 0 });
    // showTip: вспомогательная логика компонента.
const showTip = (label, el) => {
    if (!collapsed || !el) return;
    const r = el.getBoundingClientRect();
    setTip({
      visible: true,
      text: label,
      x: Math.round(r.right + 8),
      y: Math.round(r.top + r.height / 2),
    });
  };
    // hideTip: вспомогательная логика компонента.
const hideTip = () => setTip((s) => ({ ...s, visible: false }));

  return (
    <>
      <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
        <div className={styles.top}>
          {/* Бренд / компания */}
          <div ref={brandWrapRef} style={{ position: "relative" }}>
            <button
              type="button"
              className={styles.brandBtn}
              onClick={() => setMenuCompanyOpen((v) => !v)}
              title={companyName}
              aria-haspopup="menu"
              aria-expanded={menuCompanyOpen}
            >
              <div className={styles.mark}>
                {companyAvatarUrl ? (
                  <img
                    className={styles.logoImg}
                    src={companyAvatarUrl}
                    alt={companyName}
                    onError={onCompanyAvatarError}
                  />
                ) : (
                  <span className={styles.initials}>{initials}</span>
                )}
              </div>

              {!collapsed && (
                <div className={styles.brandText}>
                  <span className={styles.companyName}>{loadingCompany ? "…" : companyName}</span>
                  {companySub && <span className={styles.companySub}>{companySub}</span>}
                </div>
              )}
            </button>

            {menuCompanyOpen && (
              <CompanyMenu
                company={company}
                onClose={() => setMenuCompanyOpen(false)}
              />
            )}
          </div>

          <button
            className={styles.toggle}
            aria-label="Toggle sidebar"
            onClick={() => onToggle?.(!collapsed)}
          >
            <span className={styles.chev} />
          </button>
        </div>

        <nav className={styles.nav}>
          {sections.map((sec) => {
            if (sec.type !== "section") {
              const Icon = sec.icon;
              const label = tr(sec.labelKey);
              const isActive = sec.route && pathname.startsWith(sec.route || "");
              return (
                <NavLink
                  key={sec.key}
                  to={sec.route || "#"}
                  className={({ isActive: navActive }) =>
                    `${styles.item} ${navActive || isActive ? styles.active : ""}`
                  }
                  onMouseEnter={(e) => showTip(label, e.currentTarget)}
                  onMouseLeave={hideTip}
                  onClick={() => onNavigate?.(sec.route)}
                >
                  {Icon ? (
                    <Icon className={styles.icon} size={18} />
                  ) : (
                    <span className={styles.bullet} />
                  )}
                  {!collapsed && <span className={styles.label}>{label}</span>}
                </NavLink>
              );
            }

            const SecIcon = sec.icon;
            return (
              <div key={sec.key} className={styles.section}>
                <div className={styles.sectionHead}>
                  {SecIcon ? (
                    <SecIcon className={styles.sectionIcon} size={16} />
                  ) : (
                    <span className={styles.dot} />
                  )}
                  {!collapsed && <span className={styles.sectionTitle}>{tr(sec.labelKey)}</span>}
                </div>

                <div className={styles.list}>
                  {sec.children.map((it) => {
                    const Icon = it.icon;
                    const label = tr(it.labelKey);
                    const hasWorkspaceViews = typeof it.workspaceViewsModule === 'string';
                    const hasNavigationFlyout = Array.isArray(it.navigationFlyout) && it.navigationFlyout.length > 0;
                    if (hasWorkspaceViews || hasNavigationFlyout) {
                      return (
                        <WorkspaceMenuItem
                          key={it.key}
                          item={it}
                          Icon={Icon}
                          label={label}
                          collapsed={collapsed}
                          showTip={showTip}
                          hideTip={hideTip}
                          onNavigate={onNavigate}
                          tr={tr}
                          disabledNavigationKeys={navigationDisabledKeys}
                          styles={styles}
                        />
                      );
                    }
                    return (
                      <NavLink
                        key={it.key}
                        to={it.route || "#"}
                        className={({ isActive }) =>
                          `${styles.item} ${isActive ? styles.active : ""}`
                        }
                        onMouseEnter={(e) => showTip(label, e.currentTarget)}
                        onMouseLeave={hideTip}
                        onClick={() => onNavigate?.(it.route)}
                      >
                        {Icon ? (
                          <Icon className={styles.icon} size={18} />
                        ) : (
                          <span className={styles.bullet} />
                        )}
                        {!collapsed && <span className={styles.label}>{label}</span>}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* плавающий тултип */}
      <SidebarTooltip visible={tip.visible} text={tip.text} x={tip.x} y={tip.y} />
    </>
  );
}

// WorkspaceMenuItem — sidebar entry with a hover/focus flyout for Workspace Views.
// The flyout is portal-rendered so the sidebar's `overflow: hidden` can't clip it.
// Hover-bridge timers prevent the panel from collapsing as the cursor travels from the
// menu row into the panel itself.
function WorkspaceMenuItem({ item, Icon, label, collapsed, showTip, hideTip, onNavigate, tr, disabledNavigationKeys, styles }) {
  const anchorRef = useRef(null);
  const closeTimerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const hasNavigationFlyout = Array.isArray(item.navigationFlyout) && item.navigationFlyout.length > 0;

  const openNow = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setOpen(true);
  };

  const scheduleClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, 180);
  };

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  return (
    <div
      ref={anchorRef}
      onMouseEnter={openNow}
      onMouseLeave={scheduleClose}
      style={{ position: 'relative' }}
    >
      <NavLink
        to={item.route || "#"}
        className={({ isActive }) =>
          `${styles.item} ${isActive ? styles.active : ""}`
        }
        onMouseEnter={(e) => showTip(label, e.currentTarget)}
        onMouseLeave={hideTip}
        onFocus={openNow}
        onBlur={scheduleClose}
        onClick={() => {
          if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
          setOpen(false);
          onNavigate?.(item.route);
        }}
      >
        {Icon ? (
          <Icon className={styles.icon} size={18} />
        ) : (
          <span className={styles.bullet} />
        )}
        {!collapsed && <span className={styles.label}>{label}</span>}
      </NavLink>
      {!collapsed && !hasNavigationFlyout ? (
        <ViewsSidebarSection
          module={item.workspaceViewsModule}
          routeBase={item.route}
          collapsed={collapsed}
          styles={styles}
        />
      ) : null}
      {hasNavigationFlyout ? (
        <StaticNavigationFlyout
          open={open}
          anchorEl={anchorRef.current}
          groups={item.navigationFlyout}
          title={label}
          collapsedSidebar={collapsed}
          tr={tr}
          disabledKeys={disabledNavigationKeys}
          styles={styles}
          onMouseEnter={openNow}
          onMouseLeave={scheduleClose}
          onSelect={() => setOpen(false)}
          onClose={() => setOpen(false)}
        />
      ) : (
        <ViewsFlyout
          open={open}
          anchorEl={anchorRef.current}
          module={item.workspaceViewsModule}
          routeBase={item.route}
          titleKey={item.labelKey}
          collapsedSidebar={collapsed}
          onMouseEnter={openNow}
          onMouseLeave={scheduleClose}
          onSelect={() => setOpen(false)}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function StaticNavigationFlyout({
  open,
  anchorEl,
  groups = [],
  title,
  collapsedSidebar = false,
  tr,
  disabledKeys = {},
  styles,
  onMouseEnter,
  onMouseLeave,
  onSelect,
  onClose,
}) {
  const location = useLocation();
  const panelRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, maxHeight: 480 });

  useEffect(() => {
    if (!open || !anchorEl) return undefined;
    const update = () => {
      const r = anchorEl.getBoundingClientRect();
      const left = Math.round(r.right + (collapsedSidebar ? 14 : 8));
      const maxH = Math.max(240, window.innerHeight - 32);
      let top = Math.round(r.bottom - 8);
      const panelH = panelRef.current
        ? panelRef.current.getBoundingClientRect().height
        : Math.min(maxH, 420);
      const bottom = window.innerHeight - 16;
      if (top + panelH > bottom) top = Math.max(16, bottom - panelH);
      setPosition({ top, left, maxHeight: maxH });
    };
    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, anchorEl, collapsedSidebar, mounted]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const tm = setTimeout(() => setMounted(false), 180);
    return () => clearTimeout(tm);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    const onDocClick = (event) => {
      if (panelRef.current && panelRef.current.contains(event.target)) return;
      if (anchorEl && anchorEl.contains(event.target)) return;
      onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDocClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDocClick);
    };
  }, [open, onClose, anchorEl]);

  const isActiveRoute = (route) => {
    if (!route) return false;
    const url = new URL(route, window.location.origin);
    if (location.pathname !== url.pathname) return false;
    const targetSearch = url.searchParams;
    const current = new URLSearchParams(location.search);
    if ([...targetSearch.keys()].length === 0) {
      return !current.get('view') && !current.get('type');
    }
    return [...targetSearch.entries()].every(([key, value]) => current.get(key) === value);
  };

  if (!mounted) return null;

  return createPortal(
    <div
      ref={panelRef}
      className={`${styles.navFlyout} ${visible ? styles.navFlyoutVisible : ''}`}
      style={{ top: position.top, left: position.left, maxHeight: position.maxHeight }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="menu"
      aria-label={title}
    >
      {title ? <div className={styles.navFlyoutTitle}>{title}</div> : null}
      <div className={styles.navFlyoutGroups}>
        {groups.map((group) => (
          <section key={group.key} className={styles.navFlyoutGroup}>
            <div className={styles.navFlyoutGroupTitle}>{tr(group.labelKey)}</div>
            <div className={styles.navFlyoutList}>
              {(group.items || []).map((item) => {
                const active = isActiveRoute(item.to);
                const disabled = !!disabledKeys[item.key];
                const label = tr(item.labelKey);
                const disabledReason = item.disabledReasonKey ? tr(item.disabledReasonKey) : '';
                if (disabled) {
                  return (
                    <span
                      key={item.key}
                      className={`${styles.navFlyoutItem} ${styles.navFlyoutItemDisabled}`}
                      title={disabledReason || label}
                      role="menuitem"
                      aria-disabled="true"
                    >
                      <span>{label}</span>
                      {disabledReason ? <small>{disabledReason}</small> : null}
                    </span>
                  );
                }
                return (
                  <Link
                    key={item.key}
                    to={item.to || '#'}
                    className={`${styles.navFlyoutItem} ${active ? styles.navFlyoutItemActive : ''}`}
                    onClick={() => {
                      onSelect?.(item);
                      onClose?.();
                    }}
                    role="menuitem"
                  >
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>,
    document.body
  );
}
