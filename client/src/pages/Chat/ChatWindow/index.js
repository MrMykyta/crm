// src/pages/Chat/ChatWindow/index.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  useGetMessagesQuery,
  useMarkReadMutation,
} from "../../../store/rtk/chatApi";

import { useChatSocket } from "../../../sockets/useChatSocket";
import { getSocket } from "../../../sockets/io";
import { setMessages, setActiveRoom } from "../../../store/slices/chatSlice";

import ChatCreateDirect from "../ChatCreateDirect";
import ChatInput from "../ChatInput";
import s from "../ChatPage.module.css";

// ================= ОБЁРТКА =================
export default function ChatWindow({ roomId, mode = "room", onExitCreate }) {
  if (mode === "createDirect" || mode === "createGroup") {
    return (
      <div className={s.window}>
        <ChatCreateDirect
          mode={mode === "createGroup" ? "group" : "direct"}
          onChatCreated={onExitCreate}
        />
      </div>
    );
  }

  if (!roomId) {
    return (
      <div className={s.window}>
        <div className={s.empty}>Выберите чат</div>
      </div>
    );
  }

  return <ChatRoomWindow roomId={roomId} />;
}

// ================= ВНУТРЕННИЙ КОМПОНЕНТ =================
function ChatRoomWindow({ roomId }) {
  const dispatch = useDispatch();

  // === настройки typing ===
  const TYPING_EMIT_THROTTLE = 2000;
  const TYPING_STALE_MS = 8000;

  const currentUser = useSelector((st) => st.auth.user || st.auth.currentUser);
  const rooms = useSelector((st) => st.chat.rooms);
  const companyUsers = useSelector((st) => st.bootstrap.companyUsers || []);

  const meId = currentUser
    ? String(currentUser.userId || currentUser.id)
    : null;

  // live-сокет
  useChatSocket(roomId);

  // первоначальная загрузка истории
  const { data, isLoading } = useGetMessagesQuery({ roomId });
  const [markRead] = useMarkReadMutation();

  const [text, setText] = useState("");
  const listRef = useRef(null);
  const lastReadIdRef = useRef(null);

  // локальное состояние "кто печатает"
  const [typingUsers, setTypingUsers] = useState({});
  const lastTypingSentAtRef = useRef(0);

  // состояние скролла (для плавающей даты)
  const [scrollState, setScrollState] = useState({
    scrollable: false,
    scrolled: false,
  });
  const [floatingDay, setFloatingDay] = useState(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollStopTimeoutRef = useRef(null);

  // === состояние поиска ===
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState([]); // массив messageId
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  // сообщения из Redux
  const messages = useSelector((st) => st.chat.messages[String(roomId)] || []);

  const room = useMemo(
    () => rooms.find((r) => String(r._id) === String(roomId)),
    [rooms, roomId]
  );
  const isGroup = room?.type === "group";
  const participants = room?.participants || [];

  // ===== утилки даты =====
  const formatDayKey = (date) => {
    const d = new Date(date);
    return d.toISOString().slice(0, 10); // yyyy-mm-dd
  };

  const formatDayLabel = (date) => {
    const d = new Date(date);
    const today = new Date();
    const startOf = (x) => {
      const n = new Date(x);
      n.setHours(0, 0, 0, 0);
      return n.getTime();
    };
    const diffDays = Math.round(
      (startOf(today) - startOf(d)) / (24 * 60 * 60 * 1000)
    );

    if (diffDays === 0) return "Сегодня";
    if (diffDays === 1) return "Вчера";

    return d.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
    });
  };

  // группируем сообщения по дням
  const groupedMessages = useMemo(() => {
    if (!Array.isArray(messages)) return [];

    const byKey = new Map();

    messages.forEach((m) => {
      if (!m?.createdAt) return;
      const key = formatDayKey(m.createdAt);
      if (!byKey.has(key)) {
        byKey.set(key, []);
      }
      byKey.get(key).push(m);
    });

    const keys = Array.from(byKey.keys()).sort();
    return keys.map((key) => ({
      key,
      label: formatDayLabel(byKey.get(key)[0].createdAt),
      items: byKey.get(key),
    }));
  }, [messages]);

  // когда пришла история по REST — кладём её в Redux один раз
  useEffect(() => {
    if (!data) return;

    const base = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data)
      ? data
      : [];

    dispatch(setMessages({ roomId, messages: base }));
  }, [data, roomId, dispatch]);

  // ===== ХЕДЕР =====
  const headerInfo = useMemo(() => {
    if (!room) {
      return { title: "Чат", subtitle: "", initials: "C" };
    }

    if (room.type === "group") {
      const t = room.title || "Группа";
      const count = room.participants?.length || 0;

      return {
        title: t,
        subtitle: `${count} участник${
          count === 1 ? "" : count < 5 ? "а" : "ов"
        }`,
        initials: t[0] || "G",
      };
    }

    const parts = room.participants || [];
    const otherPart = parts.find((p) => String(p.userId) !== meId) || parts[0];

    if (!otherPart) {
      return { title: "Чат", subtitle: "", initials: "C" };
    }

    const user =
      companyUsers.find(
        (u) => String(u.userId || u.id) === String(otherPart.userId)
      ) || otherPart;

    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");

    const t = fullName || user.email || "Пользователь";
    const init =
      (user.firstName?.[0] || t[0] || "U") + (user.lastName?.[0] || "");

    return {
      title: t,
      subtitle: "был(а) недавно",
      initials: init,
    };
  }, [room, companyUsers, meId]);

  const handleInputHeightChange = React.useCallback((delta) => {
    const el = listRef.current;
    if (!el || !delta) return;
    // всегда компенсируем изменение высоты инпута
    el.scrollTop += delta;
  }, []);

  // ===== расчёт статуса сообщений (sent / readSome / readAll) =====
  const getMessageStatus = (m) => {
    if (!room || !meId) return "sent";

    const others = (participants || []).filter(
      (p) => String(p.userId) !== meId
    );

    if (!others.length) return "sent";

    let readCount = 0;

    others.forEach((p) => {
      if (!p.lastReadMessageId) return;
      if (String(m._id) <= String(p.lastReadMessageId)) {
        readCount += 1;
      }
    });

    if (readCount === 0) return "sent";
    if (readCount < others.length) return "readSome";
    return "readAll";
  };

  const statusTitleMap = {
    sent: "Отправлено",
    readSome: isGroup ? "Прочитано кем-то" : "Доставлено",
    readAll: isGroup ? "Прочитано всеми" : "Прочитано",
  };

  // ===== TYPING: подписка на сокет =====
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
            userName: userName || next[key]?.userName || "Пользователь",
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
          if (now - entry.at < TYPING_STALE_MS) {
            next[entry.userId] = entry;
          } else {
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [TYPING_STALE_MS]);

  // отправка "я печатаю" с троттлингом
  const notifyTyping = () => {
    const socket = getSocket();
    if (!socket || !currentUser || !roomId || !meId) return;

    const now = Date.now();
    if (now - lastTypingSentAtRef.current < TYPING_EMIT_THROTTLE) {
      return;
    }
    lastTypingSentAtRef.current = now;

    const userName =
      [currentUser.firstName, currentUser.lastName].filter(Boolean).join(" ") ||
      currentUser.email ||
      "Вы";

    socket.emit("chat:typing", {
      roomId,
      userId: meId,
      userName,
      isTyping: true,
    });
  };

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

  // ===== subtitle с учётом typing =====
  const typingLabel = useMemo(() => {
    const all = Object.values(typingUsers || {});
    const others = all.filter((u) => !meId || String(u.userId) !== meId);

    if (!others.length) return "";

    if (others.length === 1) {
      const name = others[0].userName || "Собеседник";
      return `${name} печатает…`;
    }
    return "Несколько человек печатают…";
  }, [typingUsers, meId]);

  const subtitleToShow = typingLabel || headerInfo.subtitle;

  // ===== автоскролл к низу при загрузке/новых сообщениях =====
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [roomId, messages.length]);

  // ===== отслеживание скролла + плавающая дата =====
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const updateFromScroll = (fromEvent = false) => {
      const scrollable = el.scrollHeight > el.clientHeight + 1;
      const scrolled = el.scrollTop > 0;

      setScrollState({ scrollable, scrolled });

      // нет скролла или в самом верху — ничего не показываем
      if (!scrollable || !scrolled) {
        setFloatingDay(null);
        if (fromEvent) setIsUserScrolling(false);
        return;
      }

      // пользователь скроллит
      if (fromEvent) {
        setIsUserScrolling(true);
        if (scrollStopTimeoutRef.current) {
          clearTimeout(scrollStopTimeoutRef.current);
        }
        scrollStopTimeoutRef.current = setTimeout(() => {
          setIsUserScrolling(false);
        }, 600);
      }

      const nodes = el.querySelectorAll("[data-day-key]");
      if (!nodes.length || !groupedMessages.length) {
        setFloatingDay(null);
        return;
      }

      const listRect = el.getBoundingClientRect();

      // ---- Зона столкновения с разделителем ----
      let nearTop = false;
      const NEAR_RANGE = 0;

      nodes.forEach((node) => {
        const rect = node.getBoundingClientRect();
        const relTop = rect.top - listRect.top; // позиция внутри контейнера
        if (relTop >= 0 && relTop <= NEAR_RANGE) {
          nearTop = true;
        }
      });

      if (nearTop) {
        setFloatingDay(null);
        return;
      }

      // ---- Вычисление "активного" дня ----
      let firstVisibleIndex = -1;
      const relPositions = [];

      nodes.forEach((node, idx) => {
        const rect = node.getBoundingClientRect();
        const relTop = rect.top - listRect.top;
        relPositions[idx] = relTop;
        if (firstVisibleIndex === -1 && relTop >= 0) {
          firstVisibleIndex = idx;
        }
      });

      let activeIndex = 0;

      if (firstVisibleIndex === -1) {
        activeIndex = nodes.length - 1;
      } else if (firstVisibleIndex <= 0) {
        activeIndex = 0;
      } else {
        activeIndex = firstVisibleIndex - 1;
      }

      const activeGroup = groupedMessages[activeIndex];
      const label = activeGroup?.label || null;
      setFloatingDay(label);
    };

    // первоначальный расчёт
    updateFromScroll(false);

    const onScroll = () => updateFromScroll(true);
    const onResize = () => updateFromScroll(false);

    el.addEventListener("scroll", onScroll);
    window.addEventListener("resize", onResize);

    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (scrollStopTimeoutRef.current) {
        clearTimeout(scrollStopTimeoutRef.current);
      }
    };
  }, [groupedMessages]);

  // ===== markRead =====
  useEffect(() => {
    if (!messages.length || !currentUser) return;
    const last = messages[messages.length - 1];
    if (!last?._id) return;

    const lastId = String(last._id);
    if (lastReadIdRef.current === lastId) return;
    lastReadIdRef.current = lastId;

    markRead({ roomId, messageId: last._id }).catch(() => {});
  }, [messages, roomId, markRead, currentUser]);

  // ===== отправка через socket =====
  const handleSend = () => {
    const value = text.trim();
    if (!value) return;

    const socket = getSocket();
    if (!socket) return;

    if (meId) {
      socket.emit("chat:typing", {
        roomId,
        userId: meId,
        isTyping: false,
      });
    }

    socket.emit("chat:send", { roomId, text: value }, (res) => {
      if (res?.ok) {
        setText("");
      } else {
        console.error("[ChatRoomWindow] send error", res);
      }
    });
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const onChangeText = (e) => {
    setText(e.target.value);
    notifyTyping();
  };

  // детерминированный цвет по userId
  const getUserColor = (userId) => {
    if (!userId) return undefined;

    let hash = 0;
    const str = String(userId);
    for (let i = 0; i < str.length; i += 1) {
      hash = (hash * 31 + str.charCodeAt(i)) | 0;
    }

    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 65%)`;
  };

  // ===== helpers для автора / аватарки =====
  const getAuthorInfo = (m) => {
    const authorId = m.authorId ? String(m.authorId) : null;

    if (!authorId) {
      return {
        authorId: null,
        name: "",
        initials: "",
        color: undefined,
      };
    }

    const user =
      companyUsers.find((u) => String(u.userId || u.id) === authorId) ||
      m.author ||
      null;

    const fullName = user
      ? [user.firstName, user.lastName].filter(Boolean).join(" ")
      : "";

    const name = fullName || user?.email || "Пользователь";

    const initials =
      (user?.firstName?.[0] || name[0] || "U") + (user?.lastName?.[0] || "");

    const color = getUserColor(authorId);

    return {
      authorId,
      name,
      initials,
      color,
    };
  };

  // ======== ПОИСК ПО СООБЩЕНИЯМ ========

  const handleToggleSearch = () => {
    setSearchOpen((prev) => {
      const next = !prev;
      if (!next) {
        setSearchQuery("");
        setSearchMatches([]);
        setActiveMatchIndex(0);
      }
      return next;
    });
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  useEffect(() => {
    // при смене комнаты — гасим поиск и сбрасываем состояние
    setSearchOpen(false);
    setSearchQuery("");
    setSearchMatches([]);
    setActiveMatchIndex(0);
  }, [roomId]);

  // пересчёт списка совпадений
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchMatches([]);
      setActiveMatchIndex(0);
      return;
    }

    const q = searchQuery.toLowerCase();
    const found = [];

    messages.forEach((m) => {
      if (m?.text && m.text.toLowerCase().includes(q)) {
        found.push(String(m._id));
      }
    });

    setSearchMatches(found);
    setActiveMatchIndex(found.length ? 0 : 0);
  }, [searchQuery, messages]);

  const gotoPrevMatch = () => {
    if (!searchMatches.length) return;
    setActiveMatchIndex((prev) =>
      prev <= 0 ? searchMatches.length - 1 : prev - 1
    );
  };

  const gotoNextMatch = () => {
    if (!searchMatches.length) return;
    setActiveMatchIndex((prev) =>
      prev >= searchMatches.length - 1 ? 0 : prev + 1
    );
  };

  // скролл к активному сообщению
  useEffect(() => {
    if (!searchOpen) return;
    if (!searchMatches.length) return;

    let idx = activeMatchIndex;
    if (idx < 0) idx = 0;
    if (idx >= searchMatches.length) idx = searchMatches.length - 1;

    const msgId = searchMatches[idx];
    if (!msgId) return;

    const el = document.getElementById(`msg-${msgId}`);
    const container = listRef.current;
    if (!el || !container) return;

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    const offset = elRect.top - containerRect.top;
    container.scrollTop += offset - container.clientHeight / 2;
  }, [activeMatchIndex, searchMatches, searchOpen]);

  // подсветка совпадений в тексте
  const renderHighlightedText = (text, query) => {
    if (!query) return text;
    const q = query.toLowerCase();
    const lower = text.toLowerCase();

    let start = 0;
    let index;
    const parts = [];
    let key = 0;

    while ((index = lower.indexOf(q, start)) !== -1) {
      if (index > start) {
        parts.push(text.slice(start, index));
      }
      parts.push(
        <span key={`h-${key++}`} className={s.msgHighlight}>
          {text.slice(index, index + query.length)}
        </span>
      );
      start = index + query.length;
    }

    if (start < text.length) {
      parts.push(text.slice(start));
    }

    return parts;
  };

  // ================= РЕНДЕР =================
  const messagesClass = [
    s.messages,
    scrollState.scrollable ? s.messagesScrollable : "",
    scrollState.scrollable && scrollState.scrolled ? s.messagesScrolled : "",
  ]
    .filter(Boolean)
    .join(" ");

  const totalMatches = searchMatches.length;
  const currentMatch = totalMatches ? activeMatchIndex + 1 : 0;
  const floatingDayTop = searchOpen ? 104 : 64;

  return (
    <div className={s.window}>
      {/* HEADER */}
      <div className={s.chatHeader}>
        <button
          className={s.backBtn}
          type="button"
          onClick={() => dispatch(setActiveRoom(null))}
        >
          ←
        </button>

        <div className={s.chatHeaderMain}>
          <div className={s.chatAvatar}>
            <span>{headerInfo.initials}</span>
          </div>
          <div className={s.chatHeaderTexts}>
            <div className={s.chatTitle}>{headerInfo.title}</div>
            {subtitleToShow && (
              <div className={s.chatSubtitle}>{subtitleToShow}</div>
            )}
          </div>
        </div>

        <div className={s.chatHeaderActions}>
          <button
            className={s.chatHeaderBtn}
            type="button"
            onClick={handleToggleSearch}
          >
            🔍
          </button>
          <button className={s.chatHeaderBtn} type="button">
            ⋯
          </button>
        </div>
      </div>

      {/* ПАНЕЛЬ ПОИСКА */}
      {searchOpen && (
        <div className={s.chatSearchBar}>
          <input
            className={s.chatSearchInput}
            type="text"
            placeholder="Поиск по сообщениям…"
            value={searchQuery}
            onChange={handleSearchChange}
          />

          <div className={s.chatSearchCounter}>
            {searchQuery.trim() ? `${currentMatch}/${totalMatches || 0}` : ""}
          </div>

          <button
            type="button"
            className={s.chatSearchNavBtn}
            onClick={gotoPrevMatch}
            disabled={!totalMatches}
          >
            ◀
          </button>

          <button
            type="button"
            className={s.chatSearchNavBtn}
            onClick={gotoNextMatch}
            disabled={!totalMatches}
          >
            ▶
          </button>

          {/* ❌ КНОПКА ЗАКРЫТЬ */}
          <button
            type="button"
            className={s.chatSearchCloseBtn}
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery("");
              setSearchMatches([]);
              setActiveMatchIndex(0);
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Плавающая дата в процессе скролла */}
      {scrollState.scrollable && isUserScrolling && floatingDay && (
        <div className={s.floatingDayLabel} style={{ top: floatingDayTop }}>
          <div className={s.floatingDayLabelInner}>{floatingDay}</div>
        </div>
      )}

      {/* СООБЩЕНИЯ */}
      <div ref={listRef} className={messagesClass}>
        {isLoading && !messages.length && (
          <div className={s.roomsEmpty}>Загружаем сообщения…</div>
        )}

        {!isLoading && !messages.length && (
          <div className={s.roomsEmpty}>В этом чате ещё нет сообщений</div>
        )}

        {groupedMessages.map((group) => (
          <div key={group.key}>
            {/* статичный разделитель в ленте */}
            <div className={s.dayDivider} data-day-key={group.key}>
              <span>{group.label}</span>
            </div>

            {group.items.map((m) => {
              const isMe = meId && String(m.authorId) === meId;
              const {
                name: authorName,
                initials,
                color: authorColor,
              } = getAuthorInfo(m);

              const showAuthorName = isGroup && !isMe;

              return (
                <div
                  key={m._id}
                  id={`msg-${m._id}`}
                  className={`${s.messageWrap} ${
                    isMe ? s.meWrap : s.otherWrap
                  }`}
                >
                  {!isMe && (
                    <div className={s.msgAvatar}>
                      <span>{initials || "U"}</span>
                    </div>
                  )}

                  <div className={s.msgBubble}>
                    {showAuthorName && (
                      <div className={s.messageAuthorRow}>
                        <span
                          className={s.messageAuthorName}
                          style={
                            authorColor ? { color: authorColor } : undefined
                          }
                        >
                          {authorName}
                        </span>
                      </div>
                    )}

                    <div className={s.msgText}>
                      {renderHighlightedText(m.text, searchQuery)}
                    </div>

                    <div className={s.msgMetaRow}>
                      {m.createdAt && (
                        <div className={s.msgTime}>
                          {new Date(m.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      )}

                      {isMe &&
                        (() => {
                          const status = getMessageStatus(m);
                          const title = statusTitleMap[status] || "";
                          const isDouble =
                            status === "readSome" || status === "readAll";

                          return (
                            <div className={s.msgStatus} title={title}>
                              <span
                                className={[
                                  s.msgCheckIcon,
                                  status === "sent"
                                    ? s.msgCheckSent
                                    : status === "readSome"
                                    ? s.msgCheckPartial
                                    : s.msgCheckRead,
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                              >
                                {isDouble ? (
                                  <>
                                    <span className={s.msgCheckLayer}>✓</span>
                                    <span className={s.msgCheckLayer}>✓</span>
                                  </>
                                ) : (
                                  <span className={s.msgCheckLayer}>✓</span>
                                )}
                              </span>
                            </div>
                          );
                        })()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* INPUT */}
      <ChatInput
        text={text}
        onChangeText={onChangeText}
        onKeyDown={onKeyDown}
        onSend={handleSend}
        disabled={!text.trim()}
        onHeightChange={handleInputHeightChange}
      />
    </div>
  );
}