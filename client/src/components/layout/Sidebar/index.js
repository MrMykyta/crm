import { NavLink, useLocation } from "react-router-dom";
import { useMemo, useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { MENU } from "../../../config/menu";
import SidebarTooltip from "../SidebarTooltip";
import CompanyMenu from "../../company/CompanyMenu";
import ViewsSidebarSection from "../../common/WorkspaceViews/WorkspaceViewsSidebarSection";
import ViewsFlyout from "../../common/WorkspaceViews/WorkspaceViewsFlyout";
import { FlyoutGroup, FlyoutItem, HoverFlyoutMenu } from "../../ui/flyout";
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

function WorkspaceMenuItem({ item, Icon, label, collapsed, showTip, hideTip, onNavigate, tr, disabledNavigationKeys, styles }) {
  const anchorRef = useRef(null);
  const closeTimerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const hasNavigationFlyout = Array.isArray(item.navigationFlyout) && item.navigationFlyout.length > 0;
  const location = useLocation();

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

  if (hasNavigationFlyout) {
    return (
      <HoverFlyoutMenu
        title={label}
        placement="right-start"
        collapsed={collapsed}
        gap={8}
        collapsedGap={14}
        width={292}
        zIndex={72}
        closeDelayMs={180}
        openOnClick={false}
        renderTrigger={({ close, triggerProps }) => (
          <div {...triggerProps} style={{ position: 'relative' }}>
            <NavLink
              to={item.route || "#"}
              className={({ isActive }) =>
                `${styles.item} ${isActive ? styles.active : ""}`
              }
              onMouseEnter={(e) => showTip(label, e.currentTarget)}
              onMouseLeave={hideTip}
              onClick={() => {
                close();
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
          </div>
        )}
      >
        {({ close }) => item.navigationFlyout.map((group) => (
          <FlyoutGroup key={group.key} label={tr(group.labelKey)}>
            {(group.items || []).map((navItem) => {
              const disabled = !!disabledNavigationKeys[navItem.key];
              const itemLabel = tr(navItem.labelKey);
              const disabledReason = navItem.disabledReasonKey ? tr(navItem.disabledReasonKey) : '';
              return (
                <FlyoutItem
                  key={navItem.key}
                  to={navItem.to || '#'}
                  active={isActiveRoute(navItem.to)}
                  disabled={disabled}
                  disabledReason={disabledReason}
                  onSelect={close}
                >
                  {itemLabel}
                </FlyoutItem>
              );
            })}
          </FlyoutGroup>
        ))}
      </HoverFlyoutMenu>
    );
  }

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
    </div>
  );
}
