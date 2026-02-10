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
  updateMessage,
  updateReaction,
  updateRoom,
} from "../store/slices/chatSlice";
import { chatApi } from "../store/rtk/chatApi";

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

      dispatch(
        chatApi.util.updateQueryData(
          "getPinned",
          { roomId: payloadRoomKey },
          (draft) => {
            const list = Array.isArray(draft?.data)
              ? draft.data
              : Array.isArray(draft)
              ? draft
              : null;
            if (!list) return;

            const id = String(message._id);
            if (list.some((m) => String(m?._id) === id)) return;

            list.push(message);
            list.sort((a, b) => {
              const ta = new Date(a.createdAt || 0).getTime();
              const tb = new Date(b.createdAt || 0).getTime();
              return ta - tb;
            });
          }
        )
      );
    };

    const onMessageUnpinned = (payload = {}) => {
      const { roomId } = payload;
      if (!roomId) return;

      const payloadRoomKey = String(roomId);
      dispatch(removePinned({ roomId: payloadRoomKey }));

      dispatch(
        chatApi.util.updateQueryData(
          "getPinned",
          { roomId: payloadRoomKey },
          (draft) => {
            const list = Array.isArray(draft?.data)
              ? draft.data
              : Array.isArray(draft)
              ? draft
              : null;
            if (!list) return;

            const messageId = payload?.messageId;
            if (!messageId) return;

            const id = String(messageId);
            const next = list.filter((m) => String(m?._id) !== id);

            if (Array.isArray(draft?.data)) {
              draft.data = next;
            } else {
              list.length = 0;
              list.push(...next);
            }
          }
        )
      );
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

    // ===================== EDIT / DELETE =====================
    const onMessageEdited = (payload = {}) => {
      const { roomId, messageId, text, editedAt, editedBy, audit } = payload;
      if (!roomId || !messageId) return;
      dispatch(
        updateMessage({
          roomId: String(roomId),
          messageId: String(messageId),
          patch: {
            text,
            editedAt,
            editedBy,
            ...(audit ? { meta: { audit } } : {}),
          },
        })
      );

      dispatch(
        chatApi.util.updateQueryData(
          "getPinned",
          { roomId: String(roomId) },
          (draft) => {
            const list = Array.isArray(draft?.data)
              ? draft.data
              : Array.isArray(draft)
              ? draft
              : null;
            if (!list) return;
            const msg = list.find((m) => String(m?._id) === String(messageId));
            if (msg) {
              msg.text = text;
              msg.editedAt = editedAt;
              msg.editedBy = editedBy;
            }
          }
        )
      );
    };

    const onMessageDeleted = (payload = {}) => {
      const { roomId, messageId, text, deletedAt, deletedBy, audit } = payload;
      if (!roomId || !messageId) return;
      dispatch(
        updateMessage({
          roomId: String(roomId),
          messageId: String(messageId),
          patch: {
            text,
            deletedAt,
            deletedBy,
            attachments: [],
            forward: null,
            ...(audit ? { meta: { audit } } : {}),
          },
        })
      );

      dispatch(
        chatApi.util.updateQueryData(
          "getPinned",
          { roomId: String(roomId) },
          (draft) => {
            const list = Array.isArray(draft?.data)
              ? draft.data
              : Array.isArray(draft)
              ? draft
              : null;
            if (!list) return;
            const id = String(messageId);
            const next = list.filter((m) => String(m?._id) !== id);

            if (Array.isArray(draft?.data)) {
              draft.data = next;
            } else {
              list.length = 0;
              list.push(...next);
            }
          }
        )
      );
    };

    // ===================== REACTIONS =====================
    // Apply server reaction events to Redux state.
    const onReactionUpdate = (payload = {}) => {
      const { messageId, emoji, count, reacted, userId } = payload;
      if (!messageId || !emoji) return;
      const isSelf =
        userId && currentUserId && String(userId) === String(currentUserId);

      dispatch(
        updateReaction({
          messageId: String(messageId),
          emoji,
          count: typeof count === "number" ? count : undefined,
          reacted: isSelf ? reacted : undefined,
        })
      );
    };

    // ===================== ROOM UPDATED =====================
    const onRoomUpdated = (payload = {}) => {
      const { roomId, patch, updatedAt } = payload;
      if (!roomId || !patch) return;
      dispatch(
        updateRoom({
          roomId: String(roomId),
          patch: { ...patch, updatedAt },
        })
      );
    };

    // подписки
    socket.on("chat:message:new", onNewMessage);
    socket.on("chat:message:read", onMessageRead);
    socket.on("chat:message:pinned", onMessagePinned);
    socket.on("chat:message:unpinned", onMessageUnpinned);
    socket.on("chat:system:deleted", onSystemDeleted);
    socket.on("chat:message:edited", onMessageEdited);
    socket.on("chat:message:deleted", onMessageDeleted);
    socket.on("chat:room:updated", onRoomUpdated);
    socket.on("chat:reaction:add", onReactionUpdate);
    socket.on("chat:reaction:remove", onReactionUpdate);

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
      socket.off("chat:message:edited", onMessageEdited);
      socket.off("chat:message:deleted", onMessageDeleted);
      socket.off("chat:room:updated", onRoomUpdated);
      socket.off("chat:reaction:add", onReactionUpdate);
      socket.off("chat:reaction:remove", onReactionUpdate);
    };
  }, [activeRoomId, currentUserId, dispatch]);
}
