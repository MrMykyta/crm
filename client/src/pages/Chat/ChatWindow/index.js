// src/pages/Chat/ChatWindow/index.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  useGetMessagesQuery,
  useMarkReadMutation,
} from "../../../store/rtk/chatApi";

import { useChatSocket } from "../../../sockets/useChatSocket";
import { getSocket } from "../../../sockets/io";
import {
  setMessages,
  setActiveRoom,
  setComposerDraft,
  clearComposerDraft,
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

  // live-сокет
  useChatSocket(roomId);

  // первоначальная загрузка истории
  const { data, isLoading } = useGetMessagesQuery({ roomId });
  const [markRead] = useMarkReadMutation();

  const [text, setText] = useState("");
  const [composerContext, setComposerContext] = useState(null);
  // composerContext: { type: 'reply' | 'forward', id, authorId, authorName, text }

  const listRef = useRef(null);
  const lastReadIdRef = useRef(null);

  // пересылка: источник + модалка выбора комнаты
  const [forwardSource, setForwardSource] = useState(null);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);

  // сообщения из Redux
  const messages = useSelector((st) => st.chat.messages[String(roomId)] || []);

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
  }, [data, roomId, dispatch]);

  // ===== начальный черновик для комнаты =====
  useEffect(() => {
    // при смене комнаты / первым заходом подтягиваем черновик
    if (!composerDraft) {
      setText("");
      setComposerContext(null);
      return;
    }

    setText(composerDraft.text || "");
    setComposerContext(composerDraft.context || null);
  }, [roomId, composerDraft]);

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

  // ===== меню действий по сообщению (двойной клик по сообщению) =====
  const [menuState, setMenuState] = useState({
    open: false,
    anchorRect: null, // DOMRect пузыря
    boundsRect: null, // DOMRect зоны сообщений (listRef)
    side: "other", // 'me' | 'other'
    clickY: null,
    message: null,
  });

  const openMessageMenu = (message, e) => {
    e.preventDefault();
    e.stopPropagation();

    const wrapEl = e.currentTarget; // div.messageWrap
    if (!wrapEl) return;

    const bubbleEl = wrapEl.querySelector('[data-role="msg-bubble"]');
    const el = bubbleEl || wrapEl;
    const rect = el.getBoundingClientRect();

    // границы области сообщений (между header+search и input)
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

  // ====== ДЕЙСТВИЯ ИЗ МЕНЮ ======

  const makeAuthorName = (msg) => {
    try {
      const { name } = getAuthorInfo(msg, companyUsers);
      return name || "Пользователь";
    } catch {
      return "Пользователь";
    }
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

  // здесь только запускаем модалку пересылки
  const handleForward = (msg) => {
    setForwardSource(msg);
    setForwardDialogOpen(true);
    closeMenu();
  };

  const handleCopy = async (msg) => {
    try {
      await navigator.clipboard?.writeText(msg?.text || "");
    } catch (e) {
      console.error(e);
    }
    closeMenu();
  };

  const handleEdit = (msg) => {
    console.log("Edit", msg);
    closeMenu();
  };

  const handlePin = (msg) => {
    console.log("Pin", msg);
    closeMenu();
  };

  const handleSelect = (msg) => {
    console.log("Select", msg);
    closeMenu();
  };

  const handleDelete = (msg) => {
    console.log("Delete", msg);
    closeMenu();
  };

  const cancelComposerContext = () => {
    setComposerContext(null);
    syncDraft(text, null);
  };

  // ===== выбор комнаты для пересылки =====
  const handleForwardSelectRoom = (targetRoomId) => {
    if (!forwardSource) return;

    const ctx = {
      type: "forward",
      id: forwardSource._id,
      authorId: forwardSource.authorId,
      authorName: makeAuthorName(forwardSource),
      text: forwardSource.text || "",
    };

    // создаём черновик в целевой комнате: пустой текст + контекст пересылки
    dispatch(
      setComposerDraft({
        roomId: targetRoomId,
        text: "",
        context: ctx,
      })
    );

    setForwardDialogOpen(false);
    setForwardSource(null);

    // переключаемся в выбранную комнату
    dispatch(setActiveRoom(targetRoomId));
  };

  // ===== отправка через socket =====
  const handleSend = () => {
    const socket = getSocket();
    if (!socket) return;

    const raw = text || "";
    const trimmed = raw.trim();

    const isReply = composerContext?.type === "reply";
    const isForward = composerContext?.type === "forward";

    const hasText = trimmed.length > 0;

    // НЕЛЬЗЯ отправлять совсем пустое сообщение,
    // но для forward текст можно не писать
    if (!hasText && !isForward) {
      return;
    }

    if (meId) {
      socket.emit("chat:typing", {
        roomId,
        userId: meId,
        isTyping: false,
      });
    }

    const payload = {
      roomId,
      text: hasText ? trimmed : "", // для forward без текста уйдёт пустая строка
    };

    if (isReply) {
      payload.replyTo = composerContext.id;
    }
    if (isForward) {
      payload.forwardFrom = composerContext.id; // 👈 ключ, который теперь понимает сервер
    }

    socket.emit("chat:send", payload, (res) => {
      if (res?.ok) {
        setText("");
        setComposerContext(null);
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

  // ======== ПОИСК ПО СООБЩЕНИЯМ (hook) ========
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

  const floatingDayTop = searchOpen ? 104 : 64;

  const handleBack = () => {
    dispatch(setActiveRoom(null));
  };

  const canSend = text.trim().length > 0 || composerContext?.type === "forward";

  return (
    <div className={s.window}>
      {/* HEADER */}
      <ChatHeader
        initials={headerInfo.initials}
        title={headerInfo.title}
        subtitle={subtitleToShow}
        onBack={handleBack}
        onToggleSearch={toggleSearch}
      />

      {/* ПАНЕЛЬ ПОИСКА */}
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

      {/* Плавающая дата */}
      {scrollState.scrollable && isUserScrolling && floatingDay && (
        <div className={s.floatingDayLabel} style={{ top: floatingDayTop }}>
          <div className={s.floatingDayLabelInner}>{floatingDay}</div>
        </div>
      )}

      {/* СООБЩЕНИЯ */}
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
        onMessageActionsClick={openMessageMenu} // двойной клик / что ты там повесил
      />

      {/* МЕНЮ ДЛЯ СООБЩЕНИЯ */}
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

      {/* МОДАЛКА ПЕРЕСЫЛКИ */}
      <ForwardDialog
        open={forwardDialogOpen}
        onClose={() => {
          setForwardDialogOpen(false);
          setForwardSource(null);
        }}
        rooms={rooms}
        currentRoomId={roomId}
        meId={meId}
        companyUsers={companyUsers}
        onSelectRoom={handleForwardSelectRoom}
      />

      {/* INPUT */}

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
