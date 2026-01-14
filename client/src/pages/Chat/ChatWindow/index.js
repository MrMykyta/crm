// src/pages/Chat/ChatWindow/index.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  useGetMessagesQuery,
  useMarkReadMutation,
  useLazyGetMessagesQuery,
} from "../../../store/rtk/chatApi";

import { getSocket } from "../../../sockets/io";
import {
  setMessages,
  setActiveRoom,
  setComposerDraft,
  clearComposerDraft,
  prependMessages,
} from "../../../store/slices/chatSlice";

import ChatCreateDirect from "../ChatCreateDirect";
import ChatInput from "../ChatInput";
import s from "../ChatPage.module.css";

import { groupMessagesByDay } from "../utils/chatDateUtils";
import { useChatTyping } from "../hooks/useChatTyping";
import { useChatSearch } from "../hooks/useChatSearch";
import { useChatScrollFloatingDay } from "../hooks/useChatScrollFloatingDay";

import ChatHeader from "../components/ChatHeader";
import ChatSearchBar from "../components/ChatSearchBar";
import ChatMessages from "../components/ChatMessages";
import MessageContextMenu from "../components/MessageContextMenu";
import ForwardDialog from "../components/ForwardDialog";
import { getAuthorInfo } from "../utils/chatMessageUtils";

// простая проверка Safari
const isSafari =
  typeof navigator !== "undefined" &&
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

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

  const currentUser = useSelector((st) => st.auth.user || st.auth.currentUser);
  const rooms = useSelector((st) => st.chat.rooms);
  const companyUsers = useSelector((st) => st.bootstrap.companyUsers || []);
  const composerDraft = useSelector(
    (st) => st.chat.composerDrafts?.[String(roomId)] || null
  );

  const meId = currentUser
    ? String(currentUser.userId || currentUser.id)
    : null;

  // первоначальная загрузка истории
  const { data, isLoading } = useGetMessagesQuery({ roomId });
  const [markRead] = useMarkReadMutation();

  // lazy-хук для подгрузки старых сообщений
  const [loadMoreMessages] = useLazyGetMessagesQuery();

  const [text, setText] = useState("");
  const [composerContext, setComposerContext] = useState(null); // только reply

  // refs
  const listRef = useRef(null);
  const lastReadIdRef = useRef(null);

  // для направления скролла (для пинов)
  const lastScrollTopRef = useRef(0);
  const scrollDirRef = useRef("down"); // "up" | "down"

  // флаг «мы уже сделали первичный скролл для этой комнаты»
  const initialScrollDoneRef = useRef(false);

  // ===== режим выбора сообщений (как в Telegram) =====
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const [forwardMessages, setForwardMessages] = useState([]);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);

  // свернут ли pinned-бар
  const [collapsedPinned, setCollapsedPinned] = useState(false);

  // сообщения из Redux
  const messages = useSelector((st) => st.chat.messages[String(roomId)] || []);

  // ===== пагинация вверх =====
  const PAGE_LIMIT = 50;
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const room = useMemo(
    () => rooms.find((r) => String(r._id) === String(roomId)),
    [rooms, roomId]
  );
  const isGroup = room?.type === "group";
  const participants = room?.participants || [];

  // ===== дата / группировка =====
  const groupedMessages = useMemo(
    () => groupMessagesByDay(messages),
    [messages]
  );

  // когда пришла история по REST — кладём её в Redux один раз
  useEffect(() => {
    if (!data) return;

    const base = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data)
      ? data
      : [];

    dispatch(setMessages({ roomId, messages: base }));

    // если меньше лимита — дальше грузить нечего
    setHasMore(base.length >= PAGE_LIMIT);
  }, [data, roomId, dispatch]);

  // ===== начальный черновик для комнаты =====
  useEffect(() => {
    if (!composerDraft) {
      setText("");
      setComposerContext(null);
      return;
    }

    setText(composerDraft.text || "");
    setComposerContext(composerDraft.context || null);
  }, [roomId, composerDraft]);

  // при смене комнаты сбрасываем свернутость pinned-бара и флаг начального скролла
  useEffect(() => {
    setCollapsedPinned(false);
    initialScrollDoneRef.current = false;
  }, [roomId]);

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

  // ===== typing (сокеты + подзаголовок) =====
  const { typingLabel, notifyTyping } = useChatTyping({
    roomId,
    currentUser,
    meId,
  });

  const subtitleToShow = typingLabel || headerInfo.subtitle;

  // ===== скролл + плавающая дата =====
  const { scrollState, floatingDay, isUserScrolling, handleInputHeightChange } =
    useChatScrollFloatingDay({
      listRef,
      groupedMessages,
      searchOpenDepsKey: roomId,
    });

  // 🔽 Хелпер для скролла вниз
  const scrollToBottom = (smooth = true) => {
    const el = listRef.current;
    if (!el) return;

    try {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    } catch {
      el.scrollTop = el.scrollHeight;
    }
  };

  // скролл к конкретному сообщению по id (для pinned / reply / first unread)
  const scrollToMessageId = (msgId, smooth = true) => {
    if (!msgId || !listRef.current) return;
    const container = listRef.current;
    const el = document.getElementById(`msg-${msgId}`);
    if (!el) return;

    const cRect = container.getBoundingClientRect();
    const mRect = el.getBoundingClientRect();
    const offset = mRect.top - cRect.top + container.scrollTop - 32;

    try {
      container.scrollTo({
        top: offset,
        behavior: smooth ? "smooth" : "auto",
      });
    } catch {
      container.scrollTop = offset;
    }
  };

  // ===== CБОР ВСЕХ ПИНОВ ИЗ messages =====
  const [pinnedList, setPinnedList] = useState([]);
  const [currentPinnedIndex, setCurrentPinnedIndex] = useState(0);

  useEffect(() => {
    if (!messages || !messages.length) {
      setPinnedList([]);
      setCurrentPinnedIndex(0);
      return;
    }

    const allPinned = messages.filter((m) => m?.isPinned === true);
    setPinnedList(allPinned);

    if (!allPinned.length) {
      setCurrentPinnedIndex(0);
      return;
    }

    // нормализуем индекс, чтобы он не вылетал за пределы
    setCurrentPinnedIndex((prev) => {
      if (prev < 0) return 0;
      if (prev >= allPinned.length) return allPinned.length - 1;
      return prev;
    });
  }, [messages]);

  const currentPinned =
    pinnedList.length === 0
      ? null
      : pinnedList[currentPinnedIndex] || pinnedList[0];

  // ===== ПИНЫ: выбор ближайшего закрепа сверху/снизу в зависимости от направления скролла =====
  useEffect(() => {
    const container = listRef.current;
    if (!container || !pinnedList.length) return;

    const handleScroll = () => {
      const c = listRef.current;
      if (!c || !pinnedList.length) return;

      // ---- направление скролла ----
      const currentTop = c.scrollTop;
      const prevTop = lastScrollTopRef.current;

      if (currentTop > prevTop + 1) {
        scrollDirRef.current = "down";
      } else if (currentTop < prevTop - 1) {
        scrollDirRef.current = "up";
      }
      lastScrollTopRef.current = currentTop;

      const scrollTop = c.scrollTop;
      const scrollBottom = scrollTop + c.clientHeight;

      const indicesAbove = [];
      const indicesBelow = [];

      pinnedList.forEach((m, idx) => {
        const el = document.getElementById(`msg-${m._id}`);
        if (!el) return;

        const msgTop = el.offsetTop;
        const msgBottom = msgTop + el.offsetHeight;

        if (msgBottom <= scrollTop) {
          indicesAbove.push(idx);
        } else if (msgTop >= scrollBottom) {
          indicesBelow.push(idx);
        }
      });

      const dir = scrollDirRef.current;
      let newIndex = currentPinnedIndex;

      if (dir === "down") {
        if (indicesBelow.length) {
          newIndex = indicesBelow[0];
        } else if (indicesAbove.length) {
          newIndex = indicesAbove[indicesAbove.length - 1];
        }
      } else if (dir === "up") {
        if (indicesAbove.length) {
          newIndex = indicesAbove[indicesAbove.length - 1];
        } else if (indicesBelow.length) {
          newIndex = indicesBelow[0];
        }
      }

      if (
        typeof newIndex === "number" &&
        newIndex >= 0 &&
        newIndex < pinnedList.length &&
        newIndex !== currentPinnedIndex
      ) {
        setCurrentPinnedIndex(newIndex);
      }
    };

    // стартовое выравнивание при монтировании / смене pinnedList
    handleScroll();

    container.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [pinnedList, currentPinnedIndex]);

  const handleJumpToPinned = (msg) => {
    if (!msg || !msg._id) return;

    scrollToMessageId(msg._id, true);

    setTimeout(() => {
      const wrapEl = document.getElementById(`msg-${msg._id}`);
      if (!wrapEl) return;

      const bubble = wrapEl.querySelector('[data-role="msg-bubble"]');
      if (!bubble) return;

      bubble.classList.add(s.msgBubbleHighlight);
      setTimeout(() => {
        bubble.classList.remove(s.msgBubbleHighlight);
      }, 900);
    }, 200);
  };

  // 🔼 ПОДГРУЗКА СТАРЫХ СООБЩЕНИЙ (дельта scrollHeight + отдельный путь для Safari)
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore || isLoading) return;
    if (!messages || !messages.length) return;

    const container = listRef.current;
    if (!container) return;

    const oldest = messages[0];
    if (!oldest || !oldest.createdAt) return;

    const before = oldest.createdAt;

    const prevScrollHeight = container.scrollHeight;
    const prevScrollTop = container.scrollTop;

    setIsLoadingMore(true);

    try {
      const res = await loadMoreMessages({
        roomId,
        before,
        limit: PAGE_LIMIT,
      }).unwrap();

      const extra = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];

      if (!extra.length) {
        setHasMore(false);
        return;
      }

      dispatch(
        prependMessages({
          roomId,
          messages: extra,
        })
      );

      if (extra.length < PAGE_LIMIT) {
        setHasMore(false);
      }

      // восстанавливаем позицию
      requestAnimationFrame(() => {
        const el = listRef.current;
        if (!el) return;

        const newScrollHeight = el.scrollHeight;
        const delta = newScrollHeight - prevScrollHeight;

        if (isSafari) {
          // Safari: даём ещё один кадр на layout и используем scrollBy
          requestAnimationFrame(() => {
            const el2 = listRef.current;
            if (!el2) return;

            // лёгкий форс-рефлоу, чтобы Safari точно обновил layout
            // eslint-disable-next-line no-unused-expressions
            el2.offsetHeight;

            el2.scrollBy(0, delta);
          });
        } else {
          el.scrollTop = prevScrollTop + delta;
        }
      });
    } catch (e) {
      console.error("[ChatRoomWindow] loadMore error", e);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // слушаем скролл и триггерим подгрузку ЧУТЬ ЗАРАНЕЕ
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;

    const onScroll = () => {
      const el = listRef.current;
      if (!el) return;

      if (
        el.scrollTop < 800 &&
        !isLoadingMore &&
        hasMore &&
        !isLoading &&
        messages.length >= PAGE_LIMIT
      ) {
        handleLoadMore();
      }
    };

    container.addEventListener("scroll", onScroll);
    return () => {
      container.removeEventListener("scroll", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, hasMore, isLoadingMore, isLoading, messages.length]);

  // 🔽 Авто-скролл, когда появляется новое сообщение ОТ МЕНЯ
  useEffect(() => {
    if (!messages.length || !meId) return;
    const last = messages[messages.length - 1];
    if (!last) return;

    if (String(last.authorId) !== String(meId)) {
      return;
    }

    scrollToBottom(true);
  }, [messages, meId]);

  // 🔽 ПЕРВЫЙ СКРОЛЛ ПРИ ВХОДЕ В ЧАТ: К ПЕРВОМУ НЕПРОЧИТАННОМУ
  useEffect(() => {
    if (!messages.length || !room || !meId) return;
    if (initialScrollDoneRef.current) return;

    const myParticipant =
      room.participants?.find((p) => String(p.userId) === String(meId)) || null;

    let targetMsg = null;

    // 1) если есть lastReadMessageId — берём сообщение сразу после него
    if (myParticipant?.lastReadMessageId) {
      const lastReadId = String(myParticipant.lastReadMessageId);
      const idx = messages.findIndex((m) => String(m._id) === lastReadId);

      if (idx >= 0 && idx < messages.length - 1) {
        targetMsg = messages[idx + 1];
      } else if (idx >= 0) {
        targetMsg = null;
      }
    }

    // 2) если нет lastReadMessageId, но есть myUnreadCount — прыгаем по нему
    if (!targetMsg && room.myUnreadCount > 0 && messages.length) {
      const n = room.myUnreadCount;
      const indexFrom = Math.max(messages.length - n, 0);
      targetMsg = messages[indexFrom] || null;
    }

    if (!targetMsg) {
      scrollToBottom(false);
      initialScrollDoneRef.current = true;
      return;
    }

    scrollToMessageId(targetMsg._id, false);

    setTimeout(() => {
      const wrapEl = document.getElementById(`msg-${targetMsg._id}`);
      if (!wrapEl) return;
      const bubble = wrapEl.querySelector('[data-role="msg-bubble"]');
      if (!bubble) return;

      bubble.classList.add(s.msgBubbleHighlight);
      setTimeout(() => {
        bubble.classList.remove(s.msgBubbleHighlight);
      }, 900);
    }, 200);

    initialScrollDoneRef.current = true;
  }, [messages, room, meId]);

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

  // ===== меню действий по сообщению (двойной клик) =====
  const [menuState, setMenuState] = useState({
    open: false,
    anchorRect: null,
    boundsRect: null,
    side: "other",
    clickY: null,
    message: null,
  });

  const openMessageMenu = (message, e) => {
    e.preventDefault();
    e.stopPropagation();

    if (selectMode) return;

    const wrapEl = e.currentTarget;
    if (!wrapEl) return;

    const bubbleEl = wrapEl.querySelector('[data-role="msg-bubble"]');
    const el = bubbleEl || wrapEl;
    const rect = el.getBoundingClientRect();

    let boundsRect = null;
    if (listRef.current) {
      const br = listRef.current.getBoundingClientRect();
      boundsRect = {
        top: br.top,
        bottom: br.bottom,
        left: br.left,
        right: br.right,
        width: br.width,
        height: br.height,
      };
    }

    const isMe = meId && String(message.authorId) === String(meId);

    setMenuState({
      open: true,
      anchorRect: {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      boundsRect,
      side: isMe ? "me" : "other",
      clickY: e.clientY,
      message,
    });
  };

  const closeMenu = () =>
    setMenuState((prev) => ({
      ...prev,
      open: false,
    }));

  // ====== ВСПОМОГАТЕЛЬНОЕ ======

  const makeAuthorName = (msg) => {
    try {
      const { name } = getAuthorInfo(msg, companyUsers);
      return name || "Пользователь";
    } catch {
      return "Пользователь";
    }
  };

  const getCurrentUserName = () => {
    if (!currentUser) return "Кто-то";
    const full = [currentUser.firstName, currentUser.lastName]
      .filter(Boolean)
      .join(" ");
    return full || currentUser.email || "Пользователь";
  };

  const syncDraft = (nextText, nextContext) => {
    dispatch(
      setComposerDraft({
        roomId,
        text: nextText || "",
        context: nextContext || null,
      })
    );
  };

  // ====== REPLY ======

  const handleReply = (msg) => {
    const ctx = {
      type: "reply",
      id: msg._id,
      authorId: msg.authorId,
      authorName: makeAuthorName(msg),
      text: msg.text || "",
    };
    setComposerContext(ctx);
    syncDraft(text, ctx);
    closeMenu();
  };

  const cancelComposerContext = () => {
    setComposerContext(null);
    syncDraft(text, null);
  };

  // ====== ВЫБОР СООБЩЕНИЙ ======

  const startSelectWith = (msg) => {
    const id = String(msg._id);
    setSelectMode(true);
    setSelectedIds([id]);
    closeMenu();
  };

  const toggleSelect = (msg) => {
    const id = String(msg._id);
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        if (!next.length) setSelectMode(false);
        return next;
      }
      return [...prev, id];
    });
  };

  const clearSelection = () => {
    setSelectMode(false);
    setSelectedIds([]);
  };

  // ====== ПЕРЕСЫЛКА ======

  const handleForward = (msg) => {
    setForwardMessages([msg]);
    setForwardDialogOpen(true);
    closeMenu();
  };

  const handleSelect = (msg) => {
    startSelectWith(msg);
  };

  const handleForwardSelected = () => {
    if (!selectedIds.length) return;
    const idSet = new Set(selectedIds);

    const selected = messages.filter((m) => idSet.has(String(m._id)));
    if (!selected.length) return;

    const sorted = [...selected].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime() || 0;
      const tb = new Date(b.createdAt).getTime() || 0;
      return ta - tb;
    });

    setForwardMessages(sorted);
    setForwardDialogOpen(true);
  };

  const getForwardSourceId = (msg) => {
    const f = msg?.meta?.forward || {};
    return (
      f.sourceMessageId ||
      f.originalMessageId ||
      f.messageId ||
      f.forwardedMessageId ||
      msg._id
    );
  };

  const handleForwardSelectRoom = (targetRoomId) => {
    const socket = getSocket();
    if (!socket || !forwardMessages.length) return;

    const sorted = [...forwardMessages].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime() || 0;
      const tb = new Date(b.createdAt).getTime() || 0;
      return ta - tb;
    });

    const sendNext = (index) => {
      if (index >= sorted.length) {
        const extra = (text || "").trim();
        if (extra) {
          socket.emit("chat:send", {
            roomId: targetRoomId,
            text: extra,
          });
        }

        setForwardDialogOpen(false);
        setForwardMessages([]);
        clearSelection();
        dispatch(setActiveRoom(targetRoomId));

        setTimeout(() => scrollToBottom(true), 0);
        return;
      }

      const m = sorted[index];

      const payload = {
        roomId: targetRoomId,
        text: m.text || "",
        forwardFrom: getForwardSourceId(m),
      };

      socket.emit("chat:send", payload, () => {
        sendNext(index + 1);
      });
    };

    sendNext(0);
  };

  const handleCopy = async (msg) => {
    try {
      await navigator.clipboard?.writeText(msg?.text || "");
    } catch (e) {
      console.error(e);
    }
    closeMenu();
  };

  const handleEdit = () => {
    closeMenu();
  };

  const handlePin = (msg) => {
    if (!msg || !msg._id) {
      closeMenu();
      return;
    }
    const socket = getSocket();
    if (!socket) {
      closeMenu();
      return;
    }

    const isUnpin = !!msg.isPinned;
    const event = isUnpin ? "chat:unpin" : "chat:pin";

    socket.emit(event, { roomId, messageId: msg._id }, () => {});

    if (!isUnpin) {
      const actorName = getCurrentUserName();
      const baseText = msg.text || "";
      const preview = baseText
        ? baseText.length > 40
          ? `${baseText.slice(0, 40)}…`
          : baseText
        : "сообщение";

      const systemText = `${actorName} закрепил(а) «${preview}»`;

      const systemPayload = {
        roomId,
        text: systemText,
        isSystem: true,
        systemType: "pin",
        systemPayload: {
          action: "pin",
          messageId: msg._id,
        },
      };

      socket.emit("chat:send", systemPayload, (res) => {
        if (!res?.ok) {
          console.error("[ChatRoomWindow] system pin message error", res);
        }
      });
    }

    closeMenu();
  };

  const handleUnpinFromBar = (messageId) => {
    if (!messageId) return;
    const socket = getSocket();
    if (!socket) return;

    socket.emit("chat:unpin", { roomId, messageId }, () => {});
  };

  const handleDelete = () => {
    closeMenu();
  };

  // ===== отправка через socket =====
  const handleSend = () => {
    const socket = getSocket();
    if (!socket) return;

    const raw = text || "";
    const trimmed = raw.trim();
    const hasText = trimmed.length > 0;

    if (!hasText) return;

    const isReply = composerContext?.type === "reply";

    if (meId) {
      socket.emit("chat:typing", {
        roomId,
        userId: meId,
        isTyping: false,
      });
    }

    const payload = {
      roomId,
      text: trimmed,
    };

    if (isReply) {
      payload.replyTo = composerContext.id;
    }

    socket.emit("chat:send", payload, (res) => {
      if (res?.ok) {
        setText("");
        setComposerContext(null);
        dispatch(
          clearComposerDraft({
            roomId,
          })
        );
        setTimeout(() => scrollToBottom(true), 0);
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
    const next = e.target.value;
    setText(next);
    syncDraft(next, composerContext);
    notifyTyping();
  };

  // ======== ПОИСК ПО СООБЩЕНИЯМ ========
  const {
    searchOpen,
    searchQuery,
    totalMatches,
    currentMatch,
    toggleSearch,
    closeSearch,
    handleSearchChange,
    gotoPrevMatch,
    gotoNextMatch,
  } = useChatSearch({ roomId, messages, listRef });

  // ================= РЕНДЕР =================
  const messagesClass = [
    s.messages,
    scrollState.scrollable ? s.messagesScrollable : "",
    scrollState.scrollable && scrollState.scrolled ? s.messagesScrolled : "",
  ]
    .filter(Boolean)
    .join(" ");

  const pinnedVisible = !!currentPinned && !searchOpen;
  const floatingDayTop = searchOpen ? 104 : pinnedVisible ? 104 : 64;

  const handleBack = () => {
    dispatch(setActiveRoom(null));
  };

  const canSend = text.trim().length > 0;

  // анимация бара при смене currentPinned
  useEffect(() => {
    if (!currentPinned) return;
    const bar = document.querySelector(`.${s.pinnedBar}`);
    if (!bar) return;

    bar.classList.remove(s.pinnedBarSwitch);
    void bar.offsetWidth;
    bar.classList.add(s.pinnedBarSwitch);
  }, [currentPinnedIndex, currentPinned]);

  return (
    <div className={s.window}>
      <ChatHeader
        initials={headerInfo.initials}
        title={headerInfo.title}
        subtitle={subtitleToShow}
        onBack={handleBack}
        onToggleSearch={toggleSearch}
      />

      <ChatSearchBar
        open={searchOpen}
        query={searchQuery}
        currentMatch={currentMatch}
        totalMatches={totalMatches}
        onChange={handleSearchChange}
        onPrev={gotoPrevMatch}
        onNext={gotoNextMatch}
        onClose={closeSearch}
      />

      {pinnedVisible && (
        <div
          className={`${s.pinnedBar} ${
            collapsedPinned ? s.pinnedCollapsed : ""
          }`}
        >
          <div
            className={s.pinnedLeft}
            onClick={() => handleJumpToPinned(currentPinned)}
          >
            <div>📌 Закреплённое сообщение</div>
            {currentPinned.text && !collapsedPinned && (
              <div className={s.pinnedPreview}>
                {currentPinned.text.length > 80
                  ? `${currentPinned.text.slice(0, 80)}…`
                  : currentPinned.text}
              </div>
            )}
          </div>

          <button
            type="button"
            className={s.pinnedCloseBtn}
            onClick={() => handleUnpinFromBar(currentPinned._id)}
          >
            ✕
          </button>
        </div>
      )}

      {scrollState.scrollable && isUserScrolling && floatingDay && (
        <div className={s.floatingDayLabel} style={{ top: floatingDayTop }}>
          <div className={s.floatingDayLabelInner}>{floatingDay}</div>
        </div>
      )}

      <ChatMessages
        listRef={listRef}
        messagesClass={messagesClass}
        isLoading={isLoading}
        messages={messages}
        groupedMessages={groupedMessages}
        meId={meId}
        isGroup={isGroup}
        participants={participants}
        room={room}
        companyUsers={companyUsers}
        searchQuery={searchQuery}
        onMessageActionsClick={openMessageMenu}
        selectMode={selectMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={handleLoadMore}
      />

      <MessageContextMenu
        open={menuState.open}
        anchorRect={menuState.anchorRect}
        boundsRect={menuState.boundsRect}
        side={menuState.side}
        clickY={menuState.clickY}
        message={menuState.message}
        onClose={closeMenu}
        onReply={handleReply}
        onCopy={handleCopy}
        onEdit={handleEdit}
        onPin={handlePin}
        onForward={handleForward}
        onSelect={handleSelect}
        onDelete={handleDelete}
      />

      <ForwardDialog
        open={forwardDialogOpen}
        onClose={() => {
          setForwardDialogOpen(false);
          setForwardMessages([]);
        }}
        rooms={rooms}
        currentRoomId={roomId}
        meId={meId}
        companyUsers={companyUsers}
        onSelectRoom={handleForwardSelectRoom}
      />

      {selectMode && (
        <div className={s.selectBar}>
          <button
            type="button"
            className={s.selectBarBtnDanger}
            onClick={clearSelection}
          >
            Убрать выбор
          </button>

          <div className={s.selectBarLabel}>
            Выбрано {selectedIds.length} сообщений
          </div>

          <button
            type="button"
            className={s.selectBarBtnPrimary}
            disabled={!selectedIds.length}
            onClick={handleForwardSelected}
          >
            Переслать
          </button>
        </div>
      )}

      <ChatInput
        text={text}
        onChangeText={onChangeText}
        onKeyDown={onKeyDown}
        onSend={handleSend}
        disabled={!canSend}
        onHeightChange={handleInputHeightChange}
        replyTo={composerContext}
        onCancelReply={cancelComposerContext}
      />
    </div>
  );
}