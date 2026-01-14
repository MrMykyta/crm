// src/sockets/useChatSocket.js
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getSocket } from "./io";
import {
  addMessage,
  updateRoomFromMessage,
  updateRoomRead,
  setPinned,
  removePinned,
  removeMessages,
} from "../store/slices/chatSlice";

export function useChatSocket(activeRoomId) {
  const dispatch = useDispatch();

  const currentUser = useSelector(
    (st) => st.auth.user || st.auth.currentUser
  );

  const currentUserId =
    currentUser && String(currentUser.userId || currentUser.id || "");

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const roomKey = activeRoomId ? String(activeRoomId) : null;

    // JOIN ROOM только для активной комнаты
    if (roomKey) {
      socket.emit("chat:join", { roomId: roomKey }, (res) => {
        if (!res?.ok) {
          console.warn("[chat:join] failed", res?.error);
        }
      });
    }

    // ===================== НОВОЕ СООБЩЕНИЕ =====================
    const onNewMessage = (payload = {}) => {
      const { roomId, message } = payload;
      if (!roomId || !message) return;

      const payloadRoomKey = String(roomId);
      const isActive = roomKey && payloadRoomKey === roomKey;

      // всегда обновляем данные комнаты (sidebar + счётчик)
      dispatch(
        updateRoomFromMessage({
          roomId: payloadRoomKey,
          message,
          currentUserId,
          isActive,
        })
      );

      // сообщения в стейт грузим только для активного чата
      if (isActive) {
        dispatch(addMessage({ roomId: roomKey, message }));
      }
    };

    // ===================== ПРОЧТЕНИЕ СООБЩЕНИЯ =====================
    const onMessageRead = (payload = {}) => {
      const { roomId, userId, messageId, lastReadAt } = payload;
      if (!roomId || !userId) return;

      const payloadRoomKey = String(roomId);

      dispatch(
        updateRoomRead({
          roomId: payloadRoomKey,
          userId,
          messageId,
          lastReadAt,
          currentUserId,
        })
      );
    };

    // ===================== PIN / UNPIN =====================
    const onMessagePinned = (payload = {}) => {
      const { roomId, message } = payload;
      if (!roomId || !message) return;

      const payloadRoomKey = String(roomId);
      dispatch(setPinned({ roomId: payloadRoomKey, pinned: message }));
    };

    const onMessageUnpinned = (payload = {}) => {
      const { roomId } = payload;
      if (!roomId) return;

      const payloadRoomKey = String(roomId);
      dispatch(removePinned({ roomId: payloadRoomKey }));
    };

    // ===================== УДАЛЕНИЕ СИСТЕМНЫХ =====================
    const onSystemDeleted = (payload = {}) => {
      const { roomId, messageIds } = payload;
      if (!roomId || !Array.isArray(messageIds) || !messageIds.length) return;

      const payloadRoomKey = String(roomId);
      dispatch(
        removeMessages({
          roomId: payloadRoomKey,
          messageIds: messageIds.map(String),
        })
      );
    };

    // подписки
    socket.on("chat:message:new", onNewMessage);
    socket.on("chat:message:read", onMessageRead);
    socket.on("chat:message:pinned", onMessagePinned);
    socket.on("chat:message:unpinned", onMessageUnpinned);
    socket.on("chat:system:deleted", onSystemDeleted);

    return () => {
      if (roomKey) {
        try {
          socket.emit("chat:leave", { roomId: roomKey }, () => {});
        } catch (e) {
          console.warn("[chat:leave] emit failed", e);
        }
      }

      socket.off("chat:message:new", onNewMessage);
      socket.off("chat:message:read", onMessageRead);
      socket.off("chat:message:pinned", onMessagePinned);
      socket.off("chat:message:unpinned", onMessageUnpinned);
      socket.off("chat:system:deleted", onSystemDeleted);
    };
  }, [activeRoomId, currentUserId, dispatch]);
}