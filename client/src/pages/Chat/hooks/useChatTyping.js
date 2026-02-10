// src/pages/Chat/hooks/useChatTyping.js
// Typing indicator hook: subscribes to socket events and builds subtitle text.
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { getSocket } from "../../../sockets/io";
import i18n from "../../../i18n";

const DEFAULT_TYPING_EMIT_THROTTLE = 2000;
const DEFAULT_TYPING_STALE_MS = 8000;

export function useChatTyping({
  roomId,
  currentUser,
  meId,
  throttleMs = DEFAULT_TYPING_EMIT_THROTTLE,
  staleMs = DEFAULT_TYPING_STALE_MS,
}) {
  const [typingUsers, setTypingUsers] = useState({});
  const lastTypingSentAtRef = useRef(0);

  // подписка на событие typing
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleTyping = (payload = {}) => {
      const { roomId: rId, userId, isTyping, userName } = payload;
      if (!userId || String(rId) !== String(roomId)) return;

      setTypingUsers((prev) => {
        const next = { ...prev };
        const key = String(userId);

        if (isTyping) {
          next[key] = {
            userId: key,
            userName:
              userName || next[key]?.userName || i18n.t("chat.message.user"),
            at: Date.now(),
          };
        } else {
          delete next[key];
        }
        return next;
      });
    };

    socket.on("chat:typing", handleTyping);
    return () => {
      socket.off("chat:typing", handleTyping);
    };
  }, [roomId]);

  // автоочистка typing
  useEffect(() => {
    const interval = setInterval(() => {
      setTypingUsers((prev) => {
        const now = Date.now();
        let changed = false;
        const next = {};
        Object.values(prev).forEach((entry) => {
          if (now - entry.at < staleMs) {
            next[entry.userId] = entry;
          } else {
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [staleMs]);

  // отправка "я печатаю" с троттлингом
  const notifyTyping = useCallback(() => {
    const socket = getSocket();
    if (!socket || !currentUser || !roomId || !meId) return;

    const now = Date.now();
    if (now - lastTypingSentAtRef.current < throttleMs) {
      return;
    }
    lastTypingSentAtRef.current = now;

    const userName =
      [currentUser.firstName, currentUser.lastName].filter(Boolean).join(" ") ||
      currentUser.email ||
      i18n.t("chat.typing.you");

    socket.emit("chat:typing", {
      roomId,
      userId: meId,
      userName,
      isTyping: true,
    });
  }, [roomId, currentUser, meId, throttleMs]);

  // при смене комнаты / размонтировании — отправим isTyping:false
  useEffect(() => {
    return () => {
      const socket = getSocket();
      if (socket && roomId && meId) {
        socket.emit("chat:typing", {
          roomId,
          userId: meId,
          isTyping: false,
        });
      }
    };
  }, [roomId, meId]);

  // подпись в хедере
  const typingLabel = useMemo(() => {
    const all = Object.values(typingUsers || {});
    const others = all.filter((u) => !meId || String(u.userId) !== meId);

    if (!others.length) return "";

    if (others.length === 1) {
      const name = others[0].userName || i18n.t("chat.typing.userFallback");
      return i18n.t("chat.typing.single", { name });
    }
    return i18n.t("chat.typing.multi");
  }, [typingUsers, meId]);

  return {
    typingUsers,
    typingLabel,
    notifyTyping,
  };
}
