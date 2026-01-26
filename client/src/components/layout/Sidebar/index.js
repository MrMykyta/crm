import { NavLink, useLocation } from "react-router-dom";
import { useMemo, useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { MENU } from "../../../config/menu";
import SidebarTooltip from "../SidebarTooltip";
import CompanyMenu from "../../company/CompanyMenu";
import { useSignedFileUrl } from "../../../hooks/useSignedFileUrl";
import styles from "./Sidebar.module.css";

// RTK Query — данные компании
import { useGetCompanyQuery } from "../../../store/rtk/companyApi";

export default function Sidebar({ collapsed = false, onToggle, onNavigate, t }) {
  const { pathname } = useLocation();
  const brandWrapRef = useRef(null);

  // из Redux
  const companyId = useSelector(s => s.auth?.companyId);

  // подгружаем компанию через RTK Query
  const { data: company, isFetching: loadingCompany } = useGetCompanyQuery(companyId, {
    skip: !companyId,
  });

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
    const res = [];
    let current = null;
    for (const item of MENU) {
      if (item.type === "section") {
        current = { ...item, children: [] };
        res.push(current);
      } else if (current) {
        current.children.push(item);
      } else {
        res.push(item);
      }
    }
    return res;
  }, []);

  const tr = (key) => (t ? t(key) : key);

  // ---- tooltip state
  const [tip, setTip] = useState({ visible: false, text: "", x: 0, y: 0 });
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
