// src/pages/Chat/index.jsx
// Chat page layout: sidebar + window, handles socket init and ESC behavior.
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { initSocket } from '../../sockets/io';
import { useListRoomsQuery } from '../../store/rtk/chatApi';
import {
  setRooms,
  setActiveRoom,
  clearEditTarget,
  closeInfoPanel,
} from '../../store/slices/chatSlice';

import ChatSidebar from './ChatSidebar';
import ChatWindow from './ChatWindow';
import s from './ChatPage.module.css';

export default function ChatPage({ accessToken: accessTokenProp }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  // Current mode for chat screen (room list vs create dialog).
  const [mode, setMode] = useState('room'); // 'room' | 'createDirect' | 'createGroup'

  // Active room id from chat slice.
  const activeRoomId = useSelector((st) => st.chat.activeRoomId);
  // Access token from auth slice.
  const accessTokenStore = useSelector((st) => st.auth.accessToken);
  // Composer mode for ESC handling (edit vs normal).
  const composerMode = useSelector((st) => st.chat.composerMode);
  // Info panel open state for current room.
  const infoPanelOpen = useSelector(
    (st) => st.chat.infoPanelOpenByRoomId?.[String(activeRoomId || '')]
  );

  const accessToken = accessTokenProp || accessTokenStore;

  // грузим комнаты
  const { data, isLoading } = useListRoomsQuery();

  useEffect(() => {
    if (!data) return;

    const rooms = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data)
      ? data
      : [];

    dispatch(setRooms(rooms));
  }, [data, dispatch]);

  // инициализация сокета
  useEffect(() => {
    if (!accessToken) return;
    initSocket(accessToken);
  }, [accessToken]);

  // ESC: выйти из создания или закрыть активный чат
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (e.defaultPrevented) return;

      if (infoPanelOpen && activeRoomId) {
        dispatch(closeInfoPanel(activeRoomId));
        return;
      }

      if (composerMode === 'edit') {
        dispatch(clearEditTarget());
        return;
      }

      if (mode !== 'room') {
        // если сейчас создаём чат/группу — просто выходим из режима
        setMode('room');
        return;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, activeRoomId, dispatch, composerMode]);

  const handleExitCreate = () => {
    setMode('room');
  };

  return (
    <div className={s.wrap} data-ui="chat-root">
      <ChatSidebar
        onCreateDirect={() => {
          // при создании чата/группы можно сбросить активную комнату
          dispatch(setActiveRoom(null));
          setMode('createDirect');
        }}
        onCreateGroup={() => {
          dispatch(setActiveRoom(null));
          setMode('createGroup');
        }}
      />

      {mode === 'createDirect' || mode === 'createGroup' ? (
        <ChatWindow mode={mode} onExitCreate={handleExitCreate} />
      ) : activeRoomId ? (
        <ChatWindow
          mode="room"
          roomId={activeRoomId}
          onExitCreate={handleExitCreate}
        />
      ) : (
        <div className={s.empty}>
          {isLoading ? t('chat.messages.loadingRooms') : t('chat.emptyRoom')}
        </div>
      )}
    </div>
  );
}
