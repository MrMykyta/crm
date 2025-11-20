// src/pages/Chat/ChatCreateDirect.jsx
import React, { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  useGetOrCreateDirectMutation,
  useCreateGroupMutation,
} from '../../../store/rtk/chatApi';
import { useListCompanyUsersQuery } from '../../../store/rtk/companyUsersApi';
import s from '../ChatPage.module.css';

export default function ChatCreateDirect({ onChatCreated, mode = 'direct' }) {
  const authUser = useSelector((st) => st.auth.user || st.auth.currentUser);
  const { data, isLoading, error } = useListCompanyUsersQuery();
  const [createDirect, { isLoading: creatingDirect }] =
    useGetOrCreateDirectMutation();
  const [createGroup, { isLoading: creatingGroup }] =
    useCreateGroupMutation();

  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [localError, setLocalError] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedIds, setSelectedIds] = useState([]); // для группы

  const isGroup = mode === 'group';

  const title = isGroup ? 'Создать группу' : 'Создать чат';
  const subtitle = isGroup
    ? 'Выберите участников из вашей компании, чтобы создать групповой чат.'
    : 'Выберите участника из вашей компании, чтобы начать диалог.';
  const placeholder = isGroup
    ? 'Кого вы хотите пригласить?'
    : 'С кем вы хотите начать диалог?';

  const rawUsers = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.data)) return data.data;
    return [];
  }, [data]);

  const users = useMemo(() => {
    const myId = authUser?.userId || authUser?.id;
    const myEmail = authUser?.email;
    return rawUsers.filter((u) => {
      const uid = u.userId || u.id;
      if (myId && uid === myId) return false;
      if (myEmail && u.email && u.email === myEmail) return false;
      return true;
    });
  }, [rawUsers, authUser]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;

    return users.filter((u) => {
      const fullName = [u.firstName, u.lastName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const email = (u.email || '').toLowerCase();
      return fullName.includes(q) || email.includes(q);
    });
  }, [users, query]);

  const toggleSelect = (userId) => {
    setSelectedIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handlePickUser = async (u) => {
    const userId = u.userId || u.id;
    if (!userId) return;

    // DIRECT CHAT — сразу создаём
    if (!isGroup) {
      try {
        setLocalError('');
        setBusyId(userId);
        await createDirect(userId).unwrap();
        onChatCreated && onChatCreated();
      } catch (e) {
        console.error('[ChatCreateDirect] createDirect error', e);
        setLocalError('Не удалось создать чат');
      } finally {
        setBusyId(null);
      }
      return;
    }

    // GROUP — просто выделяем / снимаем выделение
    toggleSelect(userId);
  };

  const handleCreateGroup = async () => {
    const title = groupTitle.trim();
    if (!title || !selectedIds.length) return;

    try {
      setLocalError('');
      await createGroup({
        title,
        participantIds: selectedIds,
      }).unwrap();
      onChatCreated && onChatCreated();
    } catch (e) {
      console.error('[ChatCreateDirect] createGroup error', e);
      setLocalError('Не удалось создать группу');
    }
  };

  const creating = creatingDirect || creatingGroup;

  return (
    <div className={s.createWrap}>
      {/* HEADER */}
      <div className={s.createHeader}>
        <div>
          <div className={s.createTitle}>{title}</div>
          <div className={s.createSubtitle}>{subtitle}</div>
        </div>
      </div>

      {/* SEARCH */}
      <div className={s.createSearch}>
        <input
          className={s.createSearchInput}
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {(error || localError) && (
        <div className={s.createError}>
          {localError || 'Не удалось загрузить пользователей'}
        </div>
      )}

      {/* СПИСОК ПОЛЬЗОВАТЕЛЕЙ */}
      <div className={s.userList}>
        {isLoading && (
          <div className={s.createEmpty}>Загружаем участников…</div>
        )}

        {!isLoading && filteredUsers.length === 0 && (
          <div className={s.createEmpty}>
            Не найдено ни одного пользователя
          </div>
        )}

        {!isLoading &&
          filteredUsers.map((u) => {
            const userId = u.userId || u.id;
            const fullName =
              [u.firstName, u.lastName].filter(Boolean).join(' ') ||
              'Без имени';
            const initials =
              (u.firstName?.[0] || '?') + (u.lastName?.[0] || '');

            const selected = isGroup && selectedIds.includes(userId);

            return (
              <button
                key={userId}
                className={`${s.userRow} ${
                  selected ? s.userRowSelected : ''
                }`}
                onClick={() => handlePickUser(u)}
                disabled={creating && !selected} // можно кликать только не во время запроса
              >
                <div className={s.userAvatar}>
                  <span className={s.userInitials}>{initials}</span>
                </div>

                <div className={s.userMain}>
                  <div className={s.userName}>{fullName}</div>
                  {u.email && (
                    <div className={s.userEmail}>{u.email}</div>
                  )}
                </div>

                <div className={s.userCheckWrap}>
                  <div className={s.userCheckCircle}>
                    {(busyId === userId || selected) && (
                      <div className={s.userBusyDot} />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
      </div>

      {/* FOOTER ДЛЯ ГРУППЫ */}
      {isGroup && (
        <div className={s.createFooter}>
          <input
            className={s.groupTitleInput}
            placeholder="Название группы"
            value={groupTitle}
            onChange={(e) => setGroupTitle(e.target.value)}
          />
          <button
            type="button"
            className={s.groupCreateBtn}
            disabled={
              creatingGroup ||
              !groupTitle.trim() ||
              !selectedIds.length
            }
            onClick={handleCreateGroup}
          >
            Создать
          </button>
        </div>
      )}
    </div>
  );
}