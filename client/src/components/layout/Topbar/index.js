import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Bell, MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useTopbarOptional } from "../../../Providers/TopbarProvider";
import DebugBadge from "../../debug/DebugBadge";
import styles from "./Topbar.module.css";

import UserMenu from "../UserMenu";
import NotificationsMenu from "../NotificationsMenu";
import { useSignedFileUrl } from "../../../hooks/useSignedFileUrl";

import {
  useListMyNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} from "../../../store/rtk/notificationApi";

function readCssVarUrl(name) {
  if (typeof window === "undefined") return "";
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
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
  onChat,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const ctx = useTopbarOptional();

  const inputRef = useRef(null);
  const notifRootRef = useRef(null);

  const notifySoundRef = useRef(null);
  const audioUnlockedRef = useRef(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const rawAvatarUrl = user?.avatarUrl || readCssVarUrl("--user-avatar-url");
  const { url: avatarUrl, onError: onAvatarError } = useSignedFileUrl(rawAvatarUrl);

  // =================== NOTIFICATIONS ===================
  const { data: notifData, refetch: refetchNotifs } =
    useListMyNotificationsQuery({ limit: 5 }, { pollingInterval: 0 });

  const [markRead] = useMarkNotificationReadMutation();
  const [markAll] = useMarkAllNotificationsReadMutation();

  const notifications = notifData?.items || [];

  const unreadCount =
    typeof notifData?.unreadCount === "number"
      ? notifData.unreadCount
      : notifications.filter((n) => !n.isRead).length;

  // ---- звук ----
  useEffect(() => {
    if (typeof window === "undefined") return;
    notifySoundRef.current = new Audio("/sounds/notify.mp3");
  }, []);

  // ---- разблокировка звука (важно!) ----
  useEffect(() => {
    if (typeof window === "undefined") return;

    const unlock = () => {
      if (audioUnlockedRef.current) return;
      const audio = notifySoundRef.current;
      if (!audio) return;

      audio.volume = 0.01;
      audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 1;
          audioUnlockedRef.current = true;
        })
        .catch(() => {
          /* заблокировано браузером — повторится на следующем клике */
        });
    };

    document.addEventListener("click", unlock, { once: true });
    return () => document.removeEventListener("click", unlock);
  }, []);

  // =================== SSE ===================
  useEffect(() => {
    if (!user?.id) return;

    const currentUserId = String(user.id);

    const attach = (es) => {
      if (!es) return () => {};

      const handler = (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          if (!payload?.type) return;

          // фильтр юзера
          const uids = Array.isArray(payload.userIds)
            ? payload.userIds.map(String)
            : payload.userId
            ? [String(payload.userId)]
            : null;

          if (uids && !uids.includes(currentUserId)) return;

          if (payload.type.startsWith("notification.")) {
            refetchNotifs();

            if (
              payload.type === "notification.created" &&
              !notifOpen &&
              document.visibilityState === "visible"
            ) {
              try {
                notifySoundRef.current?.play();
              } catch {}
            }
          }
        } catch {}
      };

      es.addEventListener("message", handler);
      return () => es.removeEventListener("message", handler);
    };

    let cleanup = null;

    // если SSE уже создан
    if (window.__SUNSET_SSE__) {
      cleanup = attach(window.__SUNSET_SSE__);
    }

    // ждём событие инициализации realtime
    const onReady = (e) => {
      cleanup?.();
      const es = e.detail?.es || window.__SUNSET_SSE__;
      if (es) cleanup = attach(es);
    };

    window.addEventListener("realtime:ready", onReady);

    return () => {
      window.removeEventListener("realtime:ready", onReady);
      cleanup?.();
    };
  }, [user?.id, refetchNotifs, notifOpen]);

  useEffect(() => {
    refetchNotifs();
  }, []);

  // закрыть меню при клике вне
  useEffect(() => {
    if (!notifOpen) return;

    const close = (e) => {
      if (!notifRootRef.current) return;
      if (!notifRootRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [notifOpen]);

  // =================== NAVIGATION ===================
  const navigateByNotification = (n) => {
    if (!n.entityType || !n.entityId) return;
    const id = encodeURIComponent(n.entityId);

    switch (n.entityType) {
      case "task":
        navigate(`/main/tasks/${id}`);
        break;

      case "lead":
        navigate(`/main/crm/leads/${id}`);
        break;

      case "client":
        navigate(`/main/crm/clients/${id}`);
        break;

      case "counterparty":
        navigate(`/main/crm/counterparties/${id}`);
        break;

      default:
        break;
    }
  };

  const handleNotifClick = async (n) => {
    if (!n.isRead) {
      try {
        await markRead(n.id).unwrap();
      } catch {}
    }
    setNotifOpen(false);
    navigateByNotification(n);
  };

  const handleClearAll = async () => {
    if (!unreadCount) return;
    try {
      await markAll().unwrap();
    } catch {}
  };

  const handleShowAll = () => {
    setNotifOpen(false);
    navigate("/main/notifications");
  };

  const handleMarkRead = async (n) => {
    if (!n?.id || n.isRead) return;

    try {
      await markRead(n.id).unwrap();
      await refetchNotifs();
    } catch (e) {
      console.error("Failed to mark notification read:", e);
    }
  };
  
  // =================== OTHER TOPBAR ===================
  // avatarUrl приходит через signed inline URL

  // user:avatar-ready now updates CSS var; signed URL is derived from user/var directly

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
        .map((w) => w[0].toUpperCase())
        .join("") || "U"
    );
  }, [user]);

  // =================== RENDER ===================
  return (
    <header
      className={styles.topbar}
      style={{
        insetInlineStart: `var(${
          collapsed ? "--sidebar-w-collapsed" : "--sidebar-w"
        })`,
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

        <button className={styles.searchBtn}>
          <Search size={16} className={styles.searchBtnIcon} />
        </button>
      </div>

      <div className={styles.right}>
        <DebugBadge />

        {/* Чат — заглушка */}
        <button className={styles.iconBtn} onClick={onChat}>
          <MessageSquare size={18} />
          <span className={styles.badge}>2</span>
        </button>

        {/* 🔔 УВЕДОМЛЕНИЯ */}
        <div className={styles.notifWrap} ref={notifRootRef}>
          <button
            className={styles.iconBtn}
            onClick={() => setNotifOpen((v) => !v)}
          >
            <Bell size={18} />

            {unreadCount > 0 && (
              <span className={styles.badge}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <NotificationsMenu
              notifications={notifications}
              unreadCount={unreadCount}
              onClickItem={handleNotifClick}
              onMarkRead={handleMarkRead} // ← НОВОЕ
              onClearAll={handleClearAll}
              onShowAll={handleShowAll}
              onClose={() => setNotifOpen(false)}
            />
          )}
        </div>

        {/* АВАТАР */}
        <div className={styles.avatarWrap}>
          <button
            className={styles.avatarBtn}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {avatarUrl ? (
              <img className={styles.avatarImg} src={avatarUrl} alt="" onError={onAvatarError} />
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
