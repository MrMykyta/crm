import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import {
  useListMyNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} from "../../../store/rtk/notificationApi";

import {
  getNotificationEntityLabel,
  formatNotificationTitle,
  formatNotificationBody,
} from "../../../utils/notificationHelpers";

import s from "./NotificationsPage.module.css";

const PAGE_SIZE = 100;

function mapEntityLabel(t, et) {
  return getNotificationEntityLabel(t, et);
}

function groupByDate(items) {
  const now = new Date();
  const todayStr = now.toDateString();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const yestStr = yest.toDateString();

  const today = [];
  const yesterday = [];
  const earlier = [];

  for (const n of items) {
    if (!n.createdAt) {
      earlier.push(n);
      continue;
    }
    const d = new Date(n.createdAt);
    const ds = d.toDateString();
    if (ds === todayStr) today.push(n);
    else if (ds === yestStr) yesterday.push(n);
    else earlier.push(n);
  }

  const out = [];
  if (today.length) out.push({ key: "today", items: today });
  if (yesterday.length) out.push({ key: "yesterday", items: yesterday });
  if (earlier.length) out.push({ key: "earlier", items: earlier });

  return out;
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [page, setPage] = useState(1); // 1-based
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");

  const queryArgs = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      ...(unreadOnly ? { onlyUnread: 1 } : {}),
      ...(typeFilter !== "all" ? { entityType: typeFilter } : {}),
    }),
    [page, unreadOnly, typeFilter]
  );

  const { data, isFetching, isLoading, refetch } =
    useListMyNotificationsQuery(queryArgs, {
      refetchOnMountOrArgChange: true,
    });

  const [markRead] = useMarkNotificationReadMutation();
  const [markAll] = useMarkAllNotificationsReadMutation();

  const items = data?.items || [];
  const unreadCount =
    typeof data?.unreadCount === "number"
      ? data.unreadCount
      : items.filter((n) => !n.isRead).length;

  useEffect(() => {
    document.title = t("notifications.title", "Уведомления");
  }, [t]);

  const grouped = useMemo(() => groupByDate(items), [items]);

  // для селекта типов — берём уникальные entityType из текущей страницы
  const entityTypeOptions = useMemo(() => {
    const set = new Set();
    for (const n of items) {
      if (n.entityType) set.add(String(n.entityType).toLowerCase());
    }
    return Array.from(set).sort();
  }, [items]);

  // небольшой "дашборд" статистики
  const stats = useMemo(() => {
    const total = items.length;
    const unread = unreadCount;

    const todayGroup = grouped.find((g) => g.key === "today");
    const todayTotal = todayGroup ? todayGroup.items.length : 0;
    const todayUnread = todayGroup
      ? todayGroup.items.filter((n) => !n.isRead).length
      : 0;

    const taskUnread = items.filter(
      (n) =>
        !n.isRead &&
        (n.entityType || "").toLowerCase() === "task"
    ).length;

    const counterpartyUnread = items.filter(
      (n) =>
        !n.isRead &&
        ["counterparty", "lead", "client"].includes(
          (n.entityType || "").toLowerCase()
        )
    ).length;

    return {
      total,
      unread,
      todayTotal,
      todayUnread,
      taskUnread,
      counterpartyUnread,
    };
  }, [items, grouped, unreadCount]);

  const hasNextPage = items.length === PAGE_SIZE;
  const hasPrevPage = page > 1;

  const goPrev = () => {
    if (!hasPrevPage) return;
    setPage((p) => Math.max(1, p - 1));
  };

  const goNext = () => {
    if (!hasNextPage || isFetching) return;
    setPage((p) => p + 1);
  };

  const handleMarkAll = async () => {
    if (!unreadCount) return;
    try {
      await markAll().unwrap();
      await refetch();
    } catch {
      // ignore
    }
  };

  const formatDateTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString();
  };

  const openEntity = (n) => {
    const type = (n.entityType || "").toLowerCase();
    const id = n.entityId;
    if (!type || !id) return;

    switch (type) {
      case "task":
        navigate(`/main/tasks/${id}`);
        break;
      case "counterparty":
        navigate(`/main/crm/counterparties/${id}`);
        break;
      case "lead":
        navigate(`/main/crm/leads/${id}`);
        break;
      case "client":
      case "contact":
        navigate(`/main/crm/clients/${id}`);
        break;
      case "user":
        navigate(`/main/users/${id}`);
        break;
      default:
        break;
    }
  };

  const handleClickItem = async (n) => {
    if (!n.isRead) {
      try {
        await markRead(n.id).unwrap();
        await refetch();
      } catch {
        // не ломаем навигацию
      }
    }
    openEntity(n);
  };

  const toggleUnread = () => {
    setPage(1);
    setUnreadOnly((v) => !v);
  };

  const changeTypeFilter = (val) => {
    setPage(1);
    setTypeFilter(val);
  };

  const renderGroupTitle = (key) => {
    switch (key) {
      case "today":
        return t("notifications.group.today", "Сегодня");
      case "yesterday":
        return t("notifications.group.yesterday", "Вчера");
      default:
        return t("notifications.group.earlier", "Ранее");
    }
  };

  return (
    <div className={s.wrap}>
      {/* ===== HEADER ===== */}
      <div className={s.head}>
        <div className={s.headLeft}>
          <h1 className={s.title}>
            {t("notifications.title", "Уведомления")}
          </h1>
          <span className={s.subTitle}>
            {unreadCount > 0
              ? t("notifications.unreadCount", {
                  defaultValue: "Непрочитанных: {{count}}",
                  count: unreadCount,
                })
              : t(
                  "notifications.noUnread",
                  "Все уведомления прочитаны — красота ✨"
                )}
          </span>
        </div>

        <div className={s.headRight}>
          <div className={s.chips}>
            <button
              type="button"
              className={`${s.chip} ${!unreadOnly ? s.chipActive : ""}`}
              onClick={() => {
                setPage(1);
                setUnreadOnly(false);
              }}
            >
              {t("notifications.filterAll", "Все")}
            </button>
            <button
              type="button"
              className={`${s.chip} ${unreadOnly ? s.chipActive : ""}`}
              onClick={toggleUnread}
            >
              {t("notifications.filterUnread", "Непрочитанные")}
            </button>
          </div>

          <div className={s.typeFilter}>
            <select
              className={s.typeSelect}
              value={typeFilter}
              onChange={(e) => changeTypeFilter(e.target.value)}
            >
              <option value="all">
                {t("notifications.typeAll", "Все типы")}
              </option>
              {entityTypeOptions.map((et) => (
                <option key={et} value={et}>
                  {mapEntityLabel(t, et)}
                </option>
              ))}
            </select>
          </div>

          {unreadCount > 0 && (
            <button className={s.clearBtn} onClick={handleMarkAll}>
              {t("notifications.markAll", "Отметить все как прочитанные")}
            </button>
          )}
        </div>
      </div>

      {/* ===== SMALL STATS ROW ===== */}
      <div className={s.metricsRow}>
        <div className={s.metricCard}>
          <span className={s.metricLabel}>
            {t("notifications.metric.total", "Всего уведомлений")}
          </span>
          <div className={s.metricMain}>
            <span className={s.metricValue}>{stats.total}</span>
            {stats.unread > 0 && (
              <span className={s.metricPill}>
                {t("notifications.metric.unreadShort", {
                  defaultValue: "{{count}} непроч.",
                  count: stats.unread,
                })}
              </span>
            )}
          </div>
          <span className={s.metricHint}>
            {t(
              "notifications.metric.tipTotal",
              "История всех событий за последние дни."
            )}
          </span>
        </div>

        <div className={s.metricCard}>
          <span className={s.metricLabel}>
            {t("notifications.metric.today", "Сегодня")}
          </span>
          <div className={s.metricMain}>
            <span className={s.metricValue}>{stats.todayTotal}</span>
            {stats.todayUnread > 0 && (
              <span className={s.metricPillAccent}>
                {t("notifications.metric.todayUnread", {
                  defaultValue: "{{count}} новых",
                  count: stats.todayUnread,
                })}
              </span>
            )}
          </div>
          <span className={s.metricHint}>
            {t(
              "notifications.metric.tipToday",
              "Свежие уведомления за текущие сутки."
            )}
          </span>
        </div>

        <div className={s.metricCard}>
          <span className={s.metricLabel}>
            {t("notifications.metric.tasks", "По задачам")}
          </span>
          <div className={s.metricMain}>
            <span className={s.metricValue}>{stats.taskUnread}</span>
            {!!stats.counterpartyUnread && (
              <span className={s.metricPillSecondary}>
                {t("notifications.metric.clientsShort", {
                  defaultValue: "{{count}} по клиентам",
                  count: stats.counterpartyUnread,
                })}
              </span>
            )}
          </div>
          <span className={s.metricHint}>
            {t(
              "notifications.metric.tipTasks",
              "Новые изменения по задачам и клиентам."
            )}
          </span>
        </div>
      </div>

      {/* ===== LIST ===== */}
      <div className={s.list}>
        {isLoading && (
          <div className={s.empty}>{t("common.loading", "Загрузка…")}</div>
        )}

        {!isLoading && items.length === 0 && (
          <div className={s.empty}>
            {t("notifications.empty", "У вас пока нет уведомлений")}
          </div>
        )}

        {!isLoading &&
          grouped.map((group) => (
            <div key={group.key} className={s.group}>
              <div className={s.groupHeader}>{renderGroupTitle(group.key)}</div>

              {group.items.map((n) => {
                const title = formatNotificationTitle(t, n);
                const body = formatNotificationBody(t, n);
                const label = mapEntityLabel(t, n.entityType);

                return (
                  <button
                    key={n.id}
                    type="button"
                    className={`${s.item} ${n.isRead ? s.read : s.unread}`}
                    onClick={() => handleClickItem(n)}
                  >
                    <div className={s.itemHeader}>
                      <div className={s.itemMain}>
                        <span className={s.itemTitle}>{title}</span>

                        {n.entityType && n.entityId && (
                          <span className={s.entityTag}>{label}</span>
                        )}
                      </div>

                      <span className={s.time}>
                        {formatDateTime(n.createdAt)}
                      </span>
                    </div>

                    {body && (
                      <div className={s.body}>{String(body).trim()}</div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
      </div>

      {/* ===== FOOTER ===== */}
      <div className={s.footer}>
        <div className={s.pagination}>
          <button
            className={s.pageBtn}
            onClick={goPrev}
            disabled={!hasPrevPage || isFetching}
          >
            {t("common.prev", "Назад")}
          </button>

          <span className={s.pageInfo}>
            {t("notifications.page", {
              defaultValue: "Страница {{page}}",
              page,
            })}
          </span>

          <button
            className={s.pageBtn}
            onClick={goNext}
            disabled={!hasNextPage || isFetching}
          >
            {t("common.next", "Вперёд")}
          </button>
        </div>

        <div className={s.footerRight}>
          {isFetching && (
            <span className={s.footerHint}>
              {t("notifications.updating", "Обновляем список…")}
            </span>
          )}
          {!isFetching && (
            <span className={s.footerHint}>
              {t(
                "notifications.tipClick",
                "Клик по уведомлению — открыть связанную сущность."
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}