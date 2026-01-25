// src/pages/Chat/index.jsx
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { initSocket } from '../../sockets/io';
import { useListRoomsQuery } from '../../store/rtk/chatApi';
import { setRooms, setActiveRoom, clearEditTarget } from '../../store/slices/chatSlice';

import ChatSidebar from './ChatSidebar';
import ChatWindow from './ChatWindow';
import s from './ChatPage.module.css';

export default function ChatPage({ accessToken: accessTokenProp }) {
  const dispatch = useDispatch();
  const [mode, setMode] = useState('room'); // 'room' | 'createDirect' | 'createGroup'

  const activeRoomId = useSelector((st) => st.chat.activeRoomId);
  const accessTokenStore = useSelector((st) => st.auth.accessToken);
  const composerMode = useSelector((st) => st.chat.composerMode);

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

      if (composerMode === 'edit') {
        dispatch(clearEditTarget());
        return;
      }

      if (mode !== 'room') {
        // если сейчас создаём чат/группу — просто выходим из режима
        setMode('room');
        return;
      }

      if (activeRoomId) {
        // если открыт чат — закрыть
        dispatch(setActiveRoom(null));
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, activeRoomId, dispatch, composerMode]);

  const handleExitCreate = () => {
    setMode('room');
  };

  return (
    <div className={s.wrap}>
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
          {isLoading ? 'Загружаем чаты…' : 'Выберите чат'}
        </div>
      )}
    </div>
  );
}
