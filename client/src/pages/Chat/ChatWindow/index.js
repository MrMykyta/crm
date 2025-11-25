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
  // composerContext теперь ТОЛЬКО для reply
  // { type: 'reply', id, authorId, authorName, text }
  const [composerContext, setComposerContext] = useState(null);

  const listRef = useRef(null);
  const lastReadIdRef = useRef(null);

  // ===== режим выбора сообщений (как в Telegram) =====
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]); // строки _id

  // какие сообщения пересылаем (массив)
  const [forwardMessages, setForwardMessages] = useState([]);
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

  const handlePin = () => {
    closeMenu();
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

  const floatingDayTop = searchOpen ? 104 : 64;

  const handleBack = () => {
    dispatch(setActiveRoom(null));
  };

  const canSend = text.trim().length > 0;

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