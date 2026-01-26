// src/pages/Chat/ChatWindow/index.jsx
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import {
  useGetMessagesQuery,
  useMarkReadMutation,
  useLazyGetMessagesQuery,
  useGetPinnedQuery,
  useEditMessageMutation,
  useDeleteMessageMutation,
} from "../../../store/rtk/chatApi";
import { useUploadFileMutation } from "../../../store/rtk/filesApi";

import { getSocket } from "../../../sockets/io";
import {
  setMessages,
  setActiveRoom,
  setComposerDraft,
  clearComposerDraft,
  prependMessages,
  setActivePinnedIndex,
  setEditTarget,
  clearEditTarget,
  clearActiveAudio,
  openInfoPanel,
  closeInfoPanel,
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
import Modal from "../../../components/Modal";
import ChatInfoPanel from "../../../components/chat/info/ChatInfoPanel";

// простая проверка Safari
const isSafari =
  typeof navigator !== "undefined" &&
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

const MAX_FILES = 10;
const MAX_TOTAL_SIZE_MB = 50;
const MAX_SINGLE_FILE_MB = 20;
const MAX_TOTAL_BYTES = MAX_TOTAL_SIZE_MB * 1024 * 1024;
const MAX_SINGLE_BYTES = MAX_SINGLE_FILE_MB * 1024 * 1024;

const CHAT_ATTACH_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "video/mp4",
  "video/webm",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

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
  const { t } = useTranslation();

  const currentUser = useSelector((st) => st.auth.user || st.auth.currentUser);
  const rooms = useSelector((st) => st.chat.rooms);
  const companyUsers = useSelector((st) => st.bootstrap.companyUsers || []);
  const composerDraft = useSelector(
    (st) => st.chat.composerDrafts?.[String(roomId)] || null
  );
  const composerMode = useSelector((st) => st.chat.composerMode);
  const editTarget = useSelector((st) => st.chat.editTarget);

  const meId = currentUser
    ? String(currentUser.userId || currentUser.id)
    : null;

  // первоначальная загрузка истории
  const { data, isLoading } = useGetMessagesQuery({ roomId });
  const [markRead] = useMarkReadMutation();
  const [editMessage, { isLoading: isEditing }] = useEditMessageMutation();
  const [deleteMessage, { isLoading: isDeleting }] =
    useDeleteMessageMutation();
  const [uploadFile] = useUploadFileMutation();

  // lazy-хук для подгрузки старых сообщений
  const [loadMoreMessages] = useLazyGetMessagesQuery();
  const { data: pinnedData } = useGetPinnedQuery(
    { roomId },
    { skip: !roomId }
  );

  const [text, setText] = useState("");
  const [composerContext, setComposerContext] = useState(null); // только reply
  const [attachmentsDraft, setAttachmentsDraft] = useState([]);
  const [sendError, setSendError] = useState(false);

  // refs
  const listRef = useRef(null);
  const lastReadIdRef = useRef(null);
  const jumpTokenRef = useRef(0);

  // флаг «мы уже сделали первичный скролл для этой комнаты»
  const initialScrollDoneRef = useRef(false);

  // ===== режим выбора сообщений (как в Telegram) =====
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const [forwardMessages, setForwardMessages] = useState([]);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [originalModal, setOriginalModal] = useState({
    open: false,
    title: "",
    text: "",
  });

  // свернут ли pinned-бар
  const [collapsedPinned, setCollapsedPinned] = useState(false);

  // сообщения из Redux
  const messages = useSelector((st) => st.chat.messages[String(roomId)] || []);
  const activePinnedIndex = useSelector(
    (st) => st.chat.activePinnedIndexByRoomId?.[String(roomId)] ?? 0
  );

  const messagesRef = useRef(messages);
  const messagesByIdRef = useRef(new Map());
  const prevRoomIdRef = useRef(null);

  useEffect(() => {
    messagesRef.current = messages;
    const map = new Map();
    messages.forEach((m) => {
      if (m && m._id) map.set(String(m._id), m);
    });
    messagesByIdRef.current = map;
  }, [messages]);

  useEffect(() => {
    if (prevRoomIdRef.current && prevRoomIdRef.current !== roomId) {
      dispatch(closeInfoPanel(prevRoomIdRef.current));
    }
    prevRoomIdRef.current = roomId;
  }, [dispatch, roomId]);

  useEffect(() => {
    return () => {
      if (roomId) {
        dispatch(closeInfoPanel(roomId));
      }
    };
  }, [dispatch, roomId]);

  // ===== пагинация вверх =====
  const PAGE_LIMIT = 50;
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const hasMoreRef = useRef(hasMore);
  const isLoadingMoreRef = useRef(isLoadingMore);
  const isLoadingRef = useRef(isLoading);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  useEffect(() => {
    isLoadingMoreRef.current = isLoadingMore;
  }, [isLoadingMore]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  const room = useMemo(
    () => rooms.find((r) => String(r._id) === String(roomId)),
    [rooms, roomId]
  );
  const isGroup = room?.type === "group";
  const EDIT_WINDOW_MS = 15 * 60 * 1000;
  const [nowTs, setNowTs] = useState(Date.now());
  const participants = room?.participants || [];
  const myParticipant = useMemo(() => {
    if (!meId) return null;
    return participants.find((p) => String(p.userId) === String(meId)) || null;
  }, [participants, meId]);
  const currentUserRole = currentUser?.role || null;
  const isSystemPrivileged =
    currentUserRole === "admin" || currentUserRole === "owner";
  const canViewOriginal =
    room?.type === "group" &&
    (isSystemPrivileged ||
      myParticipant?.role === "admin" ||
      String(room?.createdBy || "") === String(meId));
  const isEditMode =
    composerMode === "edit" &&
    editTarget &&
    String(editTarget.roomId) === String(roomId);
  const editTargetForRoom = isEditMode ? editTarget : null;
  const prevIsEditModeRef = useRef(false);
  useEffect(() => {
    const id = setInterval(() => {
      setNowTs(Date.now());
    }, 10_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setAttachmentsDraft([]);
    setSendError(false);
    dispatch(clearActiveAudio());
    return () => dispatch(clearActiveAudio());
  }, [roomId, dispatch]);

  useEffect(() => {
    if (isEditMode) {
      setAttachmentsDraft([]);
      setSendError(false);
    }
  }, [isEditMode]);

  // ===== дата / группировка =====
  const groupedMessages = useMemo(
    () => groupMessagesByDay(messages),
    [messages]
  );

  const pinnedList = useMemo(() => {
    const base = Array.isArray(pinnedData?.data)
      ? pinnedData.data
      : Array.isArray(pinnedData)
      ? pinnedData
      : [];
    return base
      .filter((m) => !m?.deletedAt)
      .sort((a, b) => {
      const ta = new Date(a?.pinnedAt || a?.createdAt || 0).getTime();
      const tb = new Date(b?.pinnedAt || b?.createdAt || 0).getTime();
      return tb - ta;
      });
  }, [pinnedData]);

  useEffect(() => {
    if (!roomId) return;

    if (!pinnedList.length) {
      if (activePinnedIndex !== 0) {
        dispatch(setActivePinnedIndex({ roomId, index: 0 }));
      }
      return;
    }

    if (activePinnedIndex >= pinnedList.length) {
      dispatch(
        setActivePinnedIndex({
          roomId,
          index: Math.max(0, pinnedList.length - 1),
        })
      );
    }
  }, [pinnedList.length, activePinnedIndex, roomId, dispatch]);

  const currentPinned =
    pinnedList.length === 0
      ? null
      : pinnedList[activePinnedIndex] || pinnedList[0];

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

  useEffect(() => {
    if (!isEditMode || !editTargetForRoom?.messageId) return;
    const msg = messages.find(
      (m) => String(m._id) === String(editTargetForRoom.messageId)
    );
    if (!msg) return;
    if (msg.isSystem || msg.deletedAt) {
      cancelEdit();
      return;
    }

    const currentText = msg.text || "";
    if (currentText !== (editTargetForRoom.originalText || "")) {
      cancelEdit();
    }
  }, [messages, isEditMode, editTargetForRoom]);

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
    jumpTokenRef.current += 1;
  }, [roomId]);

  useEffect(() => {
    if (!editTarget) return;
    if (String(editTarget.roomId) !== String(roomId)) {
      dispatch(clearEditTarget());
    }
  }, [editTarget, roomId, dispatch]);

  useEffect(() => {
    const wasEdit = prevIsEditModeRef.current;
    if (wasEdit && !isEditMode) {
      setText("");
      setComposerContext(null);
      syncDraft("", null);
    }
    prevIsEditModeRef.current = isEditMode;
  }, [isEditMode]);

  // ===== ХЕДЕР =====
  const headerInfo = useMemo(() => {
    if (!room) {
      return { title: "Чат", subtitle: "", initials: "C", avatar: "" };
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
        avatar: room.avatarUrl || "",
      };
    }

    const parts = room.participants || [];
    const otherPart = parts.find((p) => String(p.userId) !== meId) || parts[0];

    if (!otherPart) {
      return { title: "Чат", subtitle: "", initials: "C", avatar: "" };
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
      avatar: user.avatarUrl || "",
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

  const MAX_PIN_LOAD_ATTEMPTS = 6;

  const waitForMessageInView = (messageId, token, timeoutMs = 3000) =>
    new Promise((resolve) => {
      const container = listRef.current;
      if (!container || !messageId) {
        resolve(false);
        return;
      }

      let done = false;
      let rafId = null;
      let timeoutId = null;
      let scrollTimerId = null;
      let scrollStable = false;

      const cleanup = () => {
        if (done) return;
        done = true;
        if (rafId) cancelAnimationFrame(rafId);
        if (timeoutId) clearTimeout(timeoutId);
        if (scrollTimerId) clearTimeout(scrollTimerId);
        container.removeEventListener("scroll", onScroll);
      };

      const markStableSoon = () => {
        scrollStable = false;
        if (scrollTimerId) clearTimeout(scrollTimerId);
        scrollTimerId = setTimeout(() => {
          scrollStable = true;
        }, 120);
      };

      const onScroll = () => {
        markStableSoon();
      };

      const isInView = () => {
        const el = document.getElementById(`msg-${messageId}`);
        if (!el) return false;
        const cRect = container.getBoundingClientRect();
        const mRect = el.getBoundingClientRect();
        return mRect.bottom >= cRect.top && mRect.top <= cRect.bottom;
      };

      const tick = () => {
        if (done) return;
        if (jumpTokenRef.current !== token) {
          cleanup();
          resolve(false);
          return;
        }
        if (isInView() && scrollStable) {
          cleanup();
          resolve(true);
          return;
        }
        rafId = requestAnimationFrame(tick);
      };

      container.addEventListener("scroll", onScroll, { passive: true });
      markStableSoon();
      rafId = requestAnimationFrame(tick);
      timeoutId = setTimeout(() => {
        cleanup();
        resolve(false);
      }, timeoutMs);
    });

  const highlightMessage = (messageId) => {
    if (!messageId) return;
    const wrapEl = document.getElementById(`msg-${messageId}`);
    if (!wrapEl) return;

    const bubble = wrapEl.querySelector('[data-role="msg-bubble"]');
    if (!bubble) return;

    bubble.classList.add(s.msgBubbleHighlight);
    setTimeout(() => {
      bubble.classList.remove(s.msgBubbleHighlight);
    }, 1400);
  };

  const jumpToPinnedMessage = async (messageId, token) => {
    if (!messageId) return false;

    const idStr = String(messageId);

    if (messagesByIdRef.current.has(idStr)) {
      scrollToMessageId(idStr, true);
      const ok = await waitForMessageInView(idStr, token);
      if (ok) highlightMessage(idStr);
      return true;
    }

    for (let attempt = 0; attempt < MAX_PIN_LOAD_ATTEMPTS; attempt += 1) {
      const res = await loadOlderBatch();
      if (!res?.ok) break;

      await new Promise((resolve) => setTimeout(resolve, 0));

      if (messagesByIdRef.current.has(idStr)) {
        scrollToMessageId(idStr, true);
        const ok = await waitForMessageInView(idStr, token);
        if (ok) highlightMessage(idStr);
        return true;
      }
    }

    return false;
  };

  const handlePinnedBarClick = async () => {
    if (!currentPinned || !currentPinned._id || !pinnedList.length) return;

    const token = jumpTokenRef.current + 1;
    jumpTokenRef.current = token;
    const ok = await jumpToPinnedMessage(currentPinned._id, token);
    if (!ok) {
      if (typeof window !== "undefined") {
        window.alert("Сообщение не найдено");
      }
      return;
    }

    const nextIndex = (activePinnedIndex + 1) % pinnedList.length;
    dispatch(setActivePinnedIndex({ roomId, index: nextIndex }));
  };

  const loadOlderBatch = async () => {
    if (isLoadingMoreRef.current || isLoadingRef.current) {
      return { ok: false };
    }
    if (!hasMoreRef.current) {
      return { ok: false, done: true };
    }

    const currentMessages = messagesRef.current || [];
    if (!currentMessages.length) return { ok: false };

    const container = listRef.current;
    const oldest = currentMessages[0];
    if (!oldest || !oldest.createdAt) return { ok: false };

    const before = oldest.createdAt;

    const prevScrollHeight = container?.scrollHeight || 0;
    const prevScrollTop = container?.scrollTop || 0;

    isLoadingMoreRef.current = true;
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
        return { ok: false, done: true };
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

      if (container) {
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
      }

      return { ok: true };
    } catch (e) {
      console.error("[ChatRoomWindow] loadMore error", e);
      return { ok: false, error: e };
    } finally {
      setIsLoadingMore(false);
      isLoadingMoreRef.current = false;
    }
  };

  // 🔼 ПОДГРУЗКА СТАРЫХ СООБЩЕНИЙ (дельта scrollHeight + отдельный путь для Safari)
  const handleLoadMore = async () => {
    await loadOlderBatch();
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

  const getPinnedSnippet = (msg) => {
    if (!msg) return "";
    if (msg.deletedAt) return "Сообщение удалено";

    const text = (msg.text || "").trim();
    if (text) return text;

    if (msg.forward?.textSnippet) return msg.forward.textSnippet;

    const metaAttachments = msg?.meta?.attachments;
    if (Array.isArray(metaAttachments) && metaAttachments.length) {
      return metaAttachments[0]?.filename || "Вложение";
    }

    if (Array.isArray(msg.attachments) && msg.attachments.length) {
      return msg.attachments[0]?.name || "Вложение";
    }

    return "Сообщение";
  };

  const getCurrentUserName = () => {
    if (!currentUser) return "Кто-то";
    const full = [currentUser.firstName, currentUser.lastName]
      .filter(Boolean)
      .join(" ");
    return full || currentUser.email || "Пользователь";
  };

  const isWithinEditWindow = (msg, windowMs = EDIT_WINDOW_MS) => {
    const createdAt = msg?.createdAt;
    if (!createdAt) return false;
    const createdTs = new Date(createdAt).getTime();
    if (!createdTs) return false;
    return nowTs - createdTs <= windowMs;
  };

  const isMessageEditable = (msg) => {
    if (!msg) return false;
    if (!meId) return false;
    if (msg.isSystem || msg.deletedAt) return false;
    if (String(msg.authorId) !== String(meId)) return false;
    if (!isWithinEditWindow(msg)) return false;
    return true;
  };

  const canDeletePermission = (msg) => {
    if (!msg) return false;
    if (!meId) return false;
    if (msg.isSystem) return false;

    return String(msg.authorId) === String(meId);
  };

  const isMessageDeletable = (msg) => {
    if (!canDeletePermission(msg)) return false;
    if (msg.deletedAt) return false;
    return true;
  };

  const canCopyMessage = (msg) => {
    if (!msg || msg.isSystem || msg.deletedAt) return false;
    const text = (msg.text || "").trim();
    return text.length > 0;
  };

  const canForwardMessage = (msg) => {
    if (!msg || msg.isSystem || msg.deletedAt) return false;
    return true;
  };

  const updateDraft = useCallback((localId, patch) => {
    setAttachmentsDraft((prev) =>
      prev.map((d) => (d.localId === localId ? { ...d, ...patch } : d))
    );
  }, []);

  const uploadDraft = useCallback(
    async (draft) => {
      if (!draft || !draft.file) return;
      updateDraft(draft.localId, { status: "uploading", error: null });
      try {
        const res = await uploadFile({
          ownerType: "chatMessage",
          ownerId: String(roomId),
          purpose: "chat_attachment",
          file: draft.file,
        }).unwrap();

        const data = res?.data || res || {};
        if (!data?.id) {
          throw new Error("Upload failed");
        }

        updateDraft(draft.localId, {
          status: "done",
          fileId: data.id,
          filename: data.filename || draft.filename,
          mime: data.mime || draft.mime || "",
          size: data.size || draft.size || 0,
        });
      } catch (e) {
        updateDraft(draft.localId, {
          status: "error",
          error: t("chat.attach.sendFailed"),
        });
      }
    },
    [roomId, updateDraft, uploadFile, t]
  );

  const handleFilesSelected = async (fileList) => {
    if (!fileList || !fileList.length) return;
    if (!roomId) return;
    if (isEditMode) return;
    if (sendError) setSendError(false);

    const files = Array.from(fileList);
    const currentSize = attachmentsDraft.reduce(
      (sum, d) => sum + (d.size || 0),
      0
    );
    let totalSize = currentSize;
    let count = attachmentsDraft.length;

    const nextDrafts = [];

    for (const file of files) {
      if (count >= MAX_FILES) {
        if (typeof window !== "undefined") {
          window.alert(t("chat.attach.tooLarge"));
        }
        continue;
      }
      if (!file.type || !CHAT_ATTACH_MIME.has(file.type)) {
        if (typeof window !== "undefined") {
          window.alert(t("chat.attach.unsupportedType"));
        }
        continue;
      }
      if (file.size > MAX_SINGLE_BYTES) {
        if (typeof window !== "undefined") {
          window.alert(t("chat.attach.tooLarge"));
        }
        continue;
      }
      if (totalSize + file.size > MAX_TOTAL_BYTES) {
        if (typeof window !== "undefined") {
          window.alert(t("chat.attach.tooLarge"));
        }
        continue;
      }

      const draft = {
        localId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        file,
        status: "uploading",
        fileId: null,
        filename: file.name,
        mime: file.type || "",
        size: file.size || 0,
        error: null,
      };
      nextDrafts.push(draft);
      totalSize += file.size;
      count += 1;
    }

    if (!nextDrafts.length) return;

    setAttachmentsDraft((prev) => [...prev, ...nextDrafts]);

    nextDrafts.forEach((draft) => {
      uploadDraft(draft);
    });
  };

  const handleRetryAttachment = (localId) => {
    const draft = attachmentsDraft.find((d) => d.localId === localId);
    if (!draft) return;
    uploadDraft(draft);
  };

  const handleRemoveAttachment = (localId) => {
    setAttachmentsDraft((prev) => prev.filter((d) => d.localId !== localId));
    if (sendError) setSendError(false);
  };

  const getOriginalInfo = (msg) => {
    if (!canViewOriginal || !msg) return null;
    const audit = msg?.meta?.audit;
    if (!audit) return null;

    if (msg.deletedAt && audit.textBeforeDelete) {
      return { title: "До удаления", text: audit.textBeforeDelete };
    }

    if (msg.editedAt && audit.prevText) {
      return { title: "До изменения", text: audit.prevText };
    }

    return null;
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
    let replyText = msg.text || "";
    if (!replyText) {
      const replyAttachments = msg?.meta?.attachments || msg?.attachments || [];
      if (Array.isArray(replyAttachments) && replyAttachments.length) {
        replyText =
          replyAttachments[0]?.filename ||
          replyAttachments[0]?.name ||
          "Вложение";
      }
    }
    const ctx = {
      type: "reply",
      id: msg._id,
      authorId: msg.authorId,
      authorName: makeAuthorName(msg),
      text: replyText,
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

  const cancelEdit = () => {
    dispatch(clearEditTarget());
    setText("");
    setComposerContext(null);
    syncDraft("", null);
  };

  const handleEdit = (msg) => {
    if (!isMessageEditable(msg)) {
      closeMenu();
      return;
    }

    const payload = {
      roomId: String(roomId),
      messageId: String(msg._id),
      originalText: msg.text || "",
      authorName: makeAuthorName(msg),
      createdAt: msg.createdAt,
    };

    dispatch(setEditTarget(payload));
    setComposerContext(null);
    setText(msg.text || "");
    syncDraft(msg.text || "", null);
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

  const handleDelete = async (msg) => {
    if (!msg || !msg._id) {
      closeMenu();
      return;
    }
    if (!isMessageDeletable(msg)) {
      closeMenu();
      return;
    }

    try {
      await deleteMessage({
        roomId: String(roomId),
        messageId: String(msg._id),
      }).unwrap();
    } catch (e) {
      const status = e?.status || e?.originalStatus;
      if (status === 403 || status === 404) {
        if (typeof window !== "undefined") {
          window.alert("Удаление недоступно");
        }
      } else {
        if (typeof window !== "undefined") {
          window.alert("Не удалось удалить сообщение");
        }
      }
    } finally {
      closeMenu();
    }
  };

  const handleShowOriginal = (msg) => {
    const info = getOriginalInfo(msg);
    if (!info) {
      closeMenu();
      return;
    }
    setOriginalModal({
      open: true,
      title: info.title,
      text: info.text,
    });
    closeMenu();
  };

  // ===== отправка через socket =====
  const handleSend = async () => {
    const raw = text || "";
    const trimmed = raw.trim();
    const hasText = trimmed.length > 0;
    const hasAttachments = doneAttachments.length > 0;

    if (hasUploading) return;

    if (!hasText && !hasAttachments && !isEditMode) return;
    if (isEditMode && !hasText) return;

    if (sendError) setSendError(false);

    if (isEditMode && editTargetForRoom?.messageId) {
      try {
        await editMessage({
          roomId: editTargetForRoom.roomId,
          messageId: editTargetForRoom.messageId,
          text: trimmed,
        }).unwrap();

        cancelEdit();
      } catch (e) {
        const status = e?.status || e?.originalStatus;
        if (status === 403 || status === 404) {
          if (typeof window !== "undefined") {
            window.alert("Редактирование недоступно");
          }
        } else {
          if (typeof window !== "undefined") {
            window.alert("Не удалось сохранить изменения");
          }
        }
      }
      return;
    }

    const socket = getSocket();
    if (!socket) return;

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

    if (hasAttachments) {
      payload.attachments = doneAttachments.map((a) => ({
        fileId: a.fileId,
      }));
    }

    socket.emit("chat:send", payload, (res) => {
      if (res?.ok) {
        setText("");
        setAttachmentsDraft([]);
        setSendError(false);
        setComposerContext(null);
        dispatch(
          clearComposerDraft({
            roomId,
          })
        );
        setTimeout(() => scrollToBottom(true), 0);
      } else {
        console.error("[ChatRoomWindow] send error", res);
        setSendError(true);
        if (typeof window !== "undefined") {
          window.alert(t("chat.attach.sendFailed"));
        }
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
    if (sendError) setSendError(false);
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

  const handleOpenInfo = () => {
    if (!roomId || !room) return;
    const defaultTab = room.type === "group" ? "participants" : "profile";
    dispatch(openInfoPanel({ roomId, tab: defaultTab }));
  };

  const doneAttachments = attachmentsDraft.filter((d) => d.status === "done");
  const hasUploading = attachmentsDraft.some((d) => d.status === "uploading");
  const hasDoneAttachments = doneAttachments.length > 0;
  const canSend =
    (isEditMode
      ? text.trim().length > 0
      : text.trim().length > 0 || hasDoneAttachments) && !hasUploading;
  const replyContextToShow = isEditMode ? null : composerContext;
  const sendState = { isLoading: false };
  const isBusy = !!sendState.isLoading || (isEditMode && isEditing);

  const pinnedAuthor = currentPinned ? makeAuthorName(currentPinned) : "";
  const pinnedSnippetRaw = currentPinned ? getPinnedSnippet(currentPinned) : "";
  const pinnedSnippet =
    pinnedSnippetRaw.length > 80
      ? `${pinnedSnippetRaw.slice(0, 80)}…`
      : pinnedSnippetRaw;

  // анимация бара при смене currentPinned
  useEffect(() => {
    if (!currentPinned) return;
    const bar = document.querySelector(`.${s.pinnedBar}`);
    if (!bar) return;

    bar.classList.remove(s.pinnedBarSwitch);
    void bar.offsetWidth;
    bar.classList.add(s.pinnedBarSwitch);
  }, [activePinnedIndex, currentPinned]);

  return (
    <div className={s.window}>
      <ChatHeader
        initials={headerInfo.initials}
        avatar={headerInfo.avatar}
        title={headerInfo.title}
        subtitle={subtitleToShow}
        onBack={handleBack}
        onToggleSearch={toggleSearch}
        onTitleClick={handleOpenInfo}
      />

      <ChatInfoPanel
        roomId={roomId}
        room={room}
        messages={messages}
        participants={participants}
        meId={meId}
        currentUser={currentUser}
        companyUsers={companyUsers}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadOlderBatch}
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
          <div className={s.pinnedLeft} onClick={handlePinnedBarClick}>
            <div>📌 Закреплённое сообщение</div>
            {!collapsedPinned && (
              <div className={s.pinnedPreview}>
                <strong>{pinnedAuthor}</strong>
                {pinnedSnippet ? ` · ${pinnedSnippet}` : ""}
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
        canEdit={isMessageEditable(menuState.message)}
        canCopy={canCopyMessage(menuState.message)}
        canForward={canForwardMessage(menuState.message)}
        canDelete={canDeletePermission(menuState.message)}
        canShowOriginal={!!getOriginalInfo(menuState.message)}
        deleteDisabled={!!menuState.message?.deletedAt}
        isDeleting={isDeleting}
        onClose={closeMenu}
        onReply={handleReply}
        onCopy={handleCopy}
        onEdit={handleEdit}
        onPin={handlePin}
        onForward={handleForward}
        onSelect={handleSelect}
        onDelete={handleDelete}
        onShowOriginal={handleShowOriginal}
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

      <Modal
        open={originalModal.open}
        onClose={() =>
          setOriginalModal({ open: false, title: "", text: "" })
        }
        title={originalModal.title || "Оригинал"}
        size="sm"
        footer={
          <Modal.Button onClick={() =>
            setOriginalModal({ open: false, title: "", text: "" })
          }>
            Закрыть
          </Modal.Button>
        }
      >
        <div>{originalModal.text || "—"}</div>
      </Modal>

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
        isBusy={isBusy}
        canSend={canSend}
        onHeightChange={handleInputHeightChange}
        replyTo={replyContextToShow}
        onCancelReply={cancelComposerContext}
        editTarget={editTargetForRoom}
        onCancelEdit={cancelEdit}
        attachments={attachmentsDraft}
        onFilesSelected={handleFilesSelected}
        onRemoveAttachment={handleRemoveAttachment}
        onRetryAttachment={handleRetryAttachment}
        isUploading={hasUploading}
        disableAttachments={isEditMode}
        sendError={sendError}
        onRetrySend={handleSend}
      />
    </div>
  );
}
