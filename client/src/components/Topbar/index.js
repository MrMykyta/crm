// Topbar.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import styles from "./Topbar.module.css";
import UserMenu from "../UserMenu";

export default function Topbar({
  collapsed=false, title="menu.pulpit", user,
  onSearch, onLogout, onNotifications,
}) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(()=>{
    const h = (e)=>{ 
      if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="k"){ 
        e.preventDefault(); 
        inputRef.current?.focus(); 
      }};
      window.addEventListener("keydown", h);
      return ()=>window.removeEventListener("keydown", h);
  },[]);

  const initials = useMemo(() => {
    const a = user?.firstName || user?.name || "";
    const b = user?.lastName || "";
    const base = (a + " " + b).trim() || user?.email || "";
    return base.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]?.toUpperCase()).join("") || "U";
  }, [user]);

  return (
    <header
      className={styles.topbar}
      style={{ insetInlineStart: `var(${collapsed ? "--sidebar-w-collapsed" : "--sidebar-w"})` }}
    >
      <div className={styles.left}><span className={styles.title}>{t(title)}</span></div>

      <div className={styles.searchWrap}>
        <input
          ref={inputRef}
          className={styles.search}
          placeholder={t('topbar.searchPlaceholder')+" (Ctrl/⌘K)"}
          onChange={(e)=>onSearch?.(e.target.value)}
        />
        <button className={styles.searchBtn} aria-label={t('topbar.find')}>
          <Search size={16} className={styles.searchBtnIcon}/>
        </button>
      </div>

      <div className={styles.right}>
        <button className={styles.iconBtn} onClick={onNotifications} aria-label={t('topbar.notifications')}>
          <Bell size={18} />
          <span className={styles.badge}>3</span>
        </button>

        {/* AVATAR + MENU */}
        <div className={styles.avatarWrap}>
          <button
            className={styles.avatar}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={()=>setMenuOpen(v=>!v)}
          >
            {initials}
          </button>
          {menuOpen && (
            <UserMenu
              user={user}
              onClose={()=>setMenuOpen(false)}
              onLogout={onLogout}
            />
          )}
        </div>
      </div>
    </header>
  );
}