// src/components/layout/Sidebar.jsx
import { NavLink, useLocation } from "react-router-dom";
import { useMemo, useState, useEffect, useRef } from "react";
import { MENU } from "../../config/menu";
import { getCompanyById } from "../../api/company";
import { getActiveCompanyId } from "../../utils/company";
import SidebarTooltip from "../SidebarTooltip";
import CompanyMenu from "../../components/CompanyMenu"; // <— добавлено
import styles from "./Sidebar.module.css";

export default function Sidebar({ collapsed = false, onToggle, t }) {
  const { pathname } = useLocation();

  // ---- company
  const [company, setCompany] = useState(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [menuCompanyOpen, setMenuCompanyOpen] = useState(false); // <— исправлено/добавлено
  const brandWrapRef = useRef(null);

  useEffect(() => {
    const id = getActiveCompanyId();
    if (!id) {
      setLoadingCompany(false);
      return;
    }
    (async () => {
      try {
        const c = await getCompanyById(id);
        setCompany(c);
      } finally {
        setLoadingCompany(false);
      }
    })();
  }, []);

  const companyName = company?.shortName || company?.name || "Workspace";
  const companySub = company?.vat || company?.domain || "";
  const initials = (companyName || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  // ---- меню сгруппированное
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
              onClick={() => setMenuCompanyOpen((v) => !v)} // <— открываем меню компании
              title={companyName}
              aria-haspopup="menu"
              aria-expanded={menuCompanyOpen}
            >
              <div className={styles.mark}>
                {company?.logoUrl ? (
                  <img className={styles.logoImg} src={company.logoUrl} alt={companyName} />
                ) : (
                  <span className={styles.markInitials}>{initials}</span>
                )}
              </div>

              {!collapsed && (
                <div className={styles.brandText}>
                  <span className={styles.companyName}>{loadingCompany ? "…" : companyName}</span>
                  {companySub && <span className={styles.companySub}>{companySub}</span>}
                </div>
              )}
            </button>

            {/* Выпадающее меню компании */}
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