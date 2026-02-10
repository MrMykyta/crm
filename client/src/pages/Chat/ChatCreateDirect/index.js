// src/pages/Chat/ChatCreateDirect.jsx
// Chat creation flow: direct dialog or group creation with participant selection.
import React, { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  useGetOrCreateDirectMutation,
  useCreateGroupMutation,
} from '../../../store/rtk/chatApi';
import { useListCompanyUsersQuery } from '../../../store/rtk/companyUsersApi';
import s from '../ChatPage.module.css';

export default function ChatCreateDirect({ onChatCreated, mode = 'direct' }) {
  const { t } = useTranslation();
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

  const title = isGroup ? t('chat.create.groupTitle') : t('chat.create.directTitle');
  const subtitle = isGroup
    ? t('chat.create.groupSubtitle')
    : t('chat.create.directSubtitle');
  const placeholder = isGroup
    ? t('chat.create.groupPlaceholder')
    : t('chat.create.directPlaceholder');

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
        setLocalError(t('chat.create.directError'));
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
      setLocalError(t('chat.create.groupError'));
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
          {localError || t('chat.create.loadUsersError')}
        </div>
      )}

      {/* СПИСОК ПОЛЬЗОВАТЕЛЕЙ */}
      <div className={s.userList}>
        {isLoading && (
          <div className={s.createEmpty}>{t('chat.create.loadingUsers')}</div>
        )}

        {!isLoading && filteredUsers.length === 0 && (
          <div className={s.createEmpty}>
            {t('chat.create.emptyUsers')}
          </div>
        )}

        {!isLoading &&
          filteredUsers.map((u) => {
            const userId = u.userId || u.id;
            const fullName =
              [u.firstName, u.lastName].filter(Boolean).join(' ') ||
              t('chat.create.noName');
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
            placeholder={t('chat.create.groupNamePlaceholder')}
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
            {t('chat.create.groupCreate')}
          </button>
        </div>
      )}
    </div>
  );
}
