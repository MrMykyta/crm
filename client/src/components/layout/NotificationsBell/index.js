// frontend: простой колокольчик в топбаре
// src/components/layout/NotificationsBell.jsx
import React, { useEffect } from 'react';
import { useListMyNotificationsQuery, useMarkNotificationReadMutation, useMarkAllNotificationsReadMutation } from '../../store/rtk/notificationApi';
import s from './NotificationsBell.module.css';

export default function NotificationsBell({ sse }) {
  // sse – объект, который уже подключён к /sse и слушает события (если есть)
  const { data, refetch } = useListMyNotificationsQuery(
    { onlyUnread: 1, limit: 20 },
    { pollingInterval: 0 }
  );
  const [markRead] = useMarkNotificationReadMutation();
  const [markAll] = useMarkAllNotificationsReadMutation();

  useEffect(() => {
    if (!sse) return;
    const handler = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        if (!payload?.type) return;

        if (payload.type.startsWith('notification.')) {
          // пришло событие по нотификациям – обновим список
          refetch();
        }
      } catch {
        // ignore
      }
    };
    sse.addEventListener('message', handler);
    return () => sse.removeEventListener('message', handler);
  }, [sse, refetch]);

  const unreadCount = data?.unreadCount || 0;
  const items = data?.items || [];

  const onClickItem = async (n) => {
    if (!n.isRead) {
      await markRead(n.id);
    }
    // тут можно сделать navigate на сущность (если есть entityType/entityId)
    // например:
    // if (n.entityType === 'task') navigate(`/main/tasks/${n.entityId}`);
  };

  const onClickMarkAll = async () => {
    if (!unreadCount) return;
    await markAll();
  };

  return (
    <div className={s.wrap}>
      <button className={s.iconBtn}>
        <span className={s.bell}>🔔</span>
        {unreadCount > 0 && (
          <span className={s.badge}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <div className={s.dropdown}>
        <div className={s.header}>
          <span>Уведомления</span>
          {unreadCount > 0 && (
            <button className={s.markAll} onClick={onClickMarkAll}>
              Прочитать все
            </button>
          )}
        </div>

        <div className={s.list}>
          {items.length === 0 && (
            <div className={s.empty}>Пока нет уведомлений</div>
          )}

          {items.map((n) => (
            <button
              key={n.id}
              className={`${s.item} ${n.isRead ? s.read : s.unread}`}
              onClick={() => onClickItem(n)}
            >
              <div className={s.title}>{n.title}</div>
              {n.body && <div className={s.body}>{n.body}</div>}
              <div className={s.meta}>
                {n.entityType && n.entityId && (
                  <span className={s.tag}>
                    {n.entityType} #{n.entityId}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}