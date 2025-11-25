// src/sockets/useChatSocket.js
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { getSocket } from "./io";
import {
  addMessage,
  updateRoomFromMessage,
  updateRoomRead,
  setPinned,
  removePinned,
} from "../store/slices/chatSlice";

export function useChatSocket(activeRoomId) {
  const dispatch = useDispatch();

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !activeRoomId) return;

    const roomKey = String(activeRoomId);

    // JOIN ROOM
    socket.emit("chat:join", { roomId: roomKey }, (res) => {
      if (!res?.ok) {
        console.warn("[chat:join] failed", res?.error);
      }
    });

    // НОВОЕ СООБЩЕНИЕ
    const onNewMessage = (payload = {}) => {
      const { roomId, message } = payload;
      if (!roomId || !message) return;

      const payloadRoomKey = String(roomId);
      if (payloadRoomKey !== roomKey) return;

      dispatch(addMessage({ roomId: roomKey, message }));
      dispatch(updateRoomFromMessage({ roomId: roomKey, message }));
    };

    // 🔵 КТО-ТО ПРОЧИТАЛ (chat:message:read)
    const onMessageRead = (payload = {}) => {
      const { roomId, userId, messageId, lastReadAt } = payload;
      if (!roomId || !userId) return;

      const payloadRoomKey = String(roomId);
      if (payloadRoomKey !== roomKey) return;

      dispatch(
        updateRoomRead({
          roomId: roomKey,
          userId,
          messageId,
          lastReadAt,
        })
      );
    };

    socket.on("chat:message:new", onNewMessage);
    socket.on("chat:message:read", onMessageRead);
    socket.on("chat:message:pinned", ({ roomId, message }) => {
      dispatch(setPinned({ roomId, pinned: message }));
    });

    socket.on("chat:message:unpinned", ({ roomId }) => {
      dispatch(removePinned({ roomId }));
    });

    return () => {
      try {
        socket.emit("chat:leave", { roomId: roomKey }, () => {});
      } catch (e) {
        console.warn("[chat:leave] emit failed", e);
      }
      socket.off("chat:message:new", onNewMessage);
      socket.off("chat:message:read", onMessageRead);
    };
  }, [activeRoomId, dispatch]);
}
