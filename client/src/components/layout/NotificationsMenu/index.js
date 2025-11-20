// src/components/layout/NotificationsMenu/NotificationsMenu.jsx
import { useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import s from "./NotificationsMenu.module.css";

import {
  getNotificationEntityLabel,
  formatNotificationTitle,
  formatNotificationBody,
} from "../../../utils/notificationHelpers";

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationsMenu({
  notifications = [],
  unreadCount = 0,
  onClickItem,
  onMarkRead, // ← новый проп
  onClearAll,
  onShowAll,
  onClose,
}) {
  const { t } = useTranslation();
  const ref = useRef(null);

  // показываем ТОЛЬКО непрочитанные
  const unreadItems = useMemo(
    () => notifications.filter((n) => !n.isRead),
    [notifications]
  );

  // закрытие кликом вне
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    };
    const esc = (e) => e.key === "Escape" && onClose?.();

    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  return (
    <div ref={ref} className={s.menu} role="menu">
      {/* HEADER */}
      <div className={s.head}>
        <div className={s.headLeft}>
          <span className={s.title}>{t("topbar.notificationsTitle")}</span>

          {unreadCount > 0 && (
            <span className={s.counter}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <div role="button" className={s.clearBtn} onClick={onClearAll}>
            {t("topbar.notificationsClear")}
          </div>
        )}
      </div>

      {/* LIST */}
      <div className={s.list}>
        {unreadItems.length === 0 && (
          <div className={s.empty}>{t("topbar.notificationsEmpty")}</div>
        )}

        {unreadItems.map((n) => {
          const label = getNotificationEntityLabel(t, n);
          const title = formatNotificationTitle(t, n);
          const body = formatNotificationBody(t, n);

          return (
            <div
              key={n.id}
              className={`${s.item} ${s.unread}`}
              role="button"
              onClick={() => onClickItem?.(n)}
            >
              {/* Полоска */}
              <div className={s.leftStripe} />

              {/* Контент */}
              <div className={s.itemContent}>
                <div className={s.itemHeader}>
                  <div className={s.itemTitle}>{title}</div>

                  <div className={s.time}>{formatTime(n.createdAt)}</div>
                </div>

                {body && <div className={s.itemBody}>{body}</div>}

                <div className={s.itemFooter}>
                  {label && <span className={s.tag}>{label}</span>}
                  <button
                    type="button"
                    className={s.markBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkRead?.(n);
                    }}
                  >
                    ✔
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* FOOTER */}
      <div className={s.footer}>
        <div role="button" className={s.allBtn} onClick={onShowAll}>
          {t("topbar.notificationsAll")}
        </div>
      </div>
    </div>
  );
}
