import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Bell, MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTopbarOptional } from "../../../Providers/TopbarProvider";
import DebugBadge  from "../../debug/DebugBadge";
import styles from "./Topbar.module.css";
import UserMenu from "../UserMenu";

function readCssVarUrl(varName) {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  const m = raw.match(/^url\(["']?(.*?)["']?\)$/i);
  return m ? m[1] : "";
}

export default function Topbar({
  collapsed = false,
  title = "menu.pulpit",
  user,
  onSearch,
  onLogout,
  onNotifications,
  onChat,
}) {
  const { t } = useTranslation();
  const ctx = useTopbarOptional();
  const inputRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState(() =>
    user?.avatarUrl || readCssVarUrl("--user-avatar-url")
  );

  useEffect(() => {
    if (user?.avatarUrl) setAvatarUrl(user.avatarUrl);
  }, [user?.avatarUrl]);

  useEffect(() => {
    const onUserAvatar = (e) => {
      const next = e?.detail?.url;
      if (next) setAvatarUrl(next);
    };
    window.addEventListener("user:avatar-ready", onUserAvatar);
    return () => window.removeEventListener("user:avatar-ready", onUserAvatar);
  }, []);

  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const titleToShow = ctx?.title ?? title;
  const subtitleToShow = ctx?.subtitle ?? "";

  const initials = useMemo(() => {
    const a = user?.firstName || user?.name || "";
    const b = user?.lastName || "";
    const base = (a + " " + b).trim() || user?.email || "";
    return (
      base
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join("") || "U"
    );
  }, [user]);

  return (
    <header
      className={styles.topbar}
      style={{
        insetInlineStart: `var(${collapsed ? "--sidebar-w-collapsed" : "--sidebar-w"})`,
      }}
    >
      <div className={styles.left}>
        <span className={styles.title}>{t(titleToShow)}</span>
        {subtitleToShow && (
          <span className={styles.subtitle}>{subtitleToShow}</span>
        )}
      </div>

      <div className={styles.searchWrap}>
        <input
          ref={inputRef}
          className={styles.search}
          placeholder={t("topbar.searchPlaceholder") + " (Ctrl/⌘K)"}
          onChange={(e) => onSearch?.(e.target.value)}
        />
        <button className={styles.searchBtn} aria-label={t("topbar.find")}>
          <Search size={16} className={styles.searchBtnIcon} />
        </button>
      </div>

      <div className={styles.right}>
        <DebugBadge />
        <button
          className={styles.iconBtn}
          onClick={onChat}
          aria-label={t("topbar.chat")}
        >
          <MessageSquare size={18} />
          <span className={styles.badge}>2</span>
        </button>

        <button
          className={styles.iconBtn}
          onClick={onNotifications}
          aria-label={t("topbar.notifications")}
        >
          <Bell size={18} />
          <span className={styles.badge}>3</span>
        </button>

        <div className={styles.avatarWrap}>
          <button
            className={styles.avatarBtn}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {avatarUrl ? (
              <img className={styles.avatarImg} src={avatarUrl} alt="" />
            ) : (
              <div className={styles.avatarFallback}>{initials}</div>
            )}
          </button>

          {menuOpen && (
            <UserMenu
              user={user}
              onClose={() => setMenuOpen(false)}
              onLogout={onLogout}
            />
          )}
        </div>
      </div>
    </header>
  );
}