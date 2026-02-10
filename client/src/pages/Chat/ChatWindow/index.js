// src/pages/Chat/ChatWindow/index.jsx
// Main chat window: header, pinned bar, messages list, composer, and right info panel.
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
  useToggleMessageReactionMutation,
} from "../../../store/rtk/chatApi";
import {
  useUploadFileMutation,
  useLazyGetSignedDownloadUrlQuery,
} from "../../../store/rtk/filesApi";

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
  setInfoPanelTab,
  closeInfoPanel,
  updateReaction,
} from "../../../store/slices/chatSlice";

import ChatCreateDirect from "../ChatCreateDirect";
import ChatInput from "../ChatInput";
import s from "../ChatPage.module.css";

import { groupMessagesByDay } from "../utils/chatDateUtils";
import { useChatTyping } from "../hooks/useChatTyping";
import { useChatSearch } from "../hooks/useChatSearch";
import { useChatScrollFloatingDay } from "../hooks/useChatScrollFloatingDay";

import ChatHeader from "../components/ChatHeader";
import ChatMessages from "../components/ChatMessages";
import MessageContextMenu from "../components/MessageContextMenu";
import ForwardDialog from "../components/ForwardDialog";
import { getAuthorInfo } from "../utils/chatMessageUtils";
import Modal from "../../../components/Modal";
import ConfirmDialog from "../../../components/dialogs/ConfirmDialog";
import ChatInfoPanel from "../../../components/chat/info/ChatInfoPanel";
import MediaViewer from "../../../components/chat/MediaViewer";

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

const OFFICE_MIME = new Set([
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const DOC_EXTS = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"]);

const normalizeUrl = (u) => {
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  const base =
    (process.env.REACT_APP_API_URL || "http://localhost:5001").replace(/\/+$/, "");
  if (u.startsWith("/")) return `${base}${u}`;
  return u;
};

const normalizeAttachment = (att) => {
  if (!att) return null;
  return {
    fileId: att.fileId || att.id || null,
    filename: att.filename || att.name || "",
    mime: att.mime || att.mimeType || "",
    size: att.size || 0,
    url: att.url || att.downloadUrl || "",
  };
};

const getAttachmentExt = (name) => {
  if (!name || typeof name !== "string") return "";
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
};

const isMediaAttachment = (att) => {
  if (!att?.mime) return false;
  return att.mime.startsWith("image/") || att.mime.startsWith("video/");
};

const isAudioAttachment = (att) => {
  if (!att?.mime) return false;
  return att.mime.startsWith("audio/");
};

const isPdfAttachment = (att) =>
  att?.mime === "application/pdf" || getAttachmentExt(att?.filename) === "pdf";

const isOfficeAttachment = (att) => {
  const ext = getAttachmentExt(att?.filename);
  if (OFFICE_MIME.has(att?.mime)) return true;
  return ["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext);
};

const buildDocsViewerUrl = (url) =>
  `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`;

// ================= ОБЁРТКА =================
export default function ChatWindow({ roomId, mode = "room", onExitCreate }) {
  const { t } = useTranslation();
  if (mode === "createDirect" || mode === "createGroup") {
    return (
      <div className={s.window}>
        <div className={s.chatMain}>
          <ChatCreateDirect
            mode={mode === "createGroup" ? "group" : "direct"}
            onChatCreated={onExitCreate}
          />
        </div>
      </div>
    );
  }

  if (!roomId) {
    return (
      <div className={s.window}>
        <div className={s.chatMain}>
          <div className={s.empty}>{t("chat.emptyRoom")}</div>
        </div>
      </div>
    );
  }

  return <ChatRoomWindow roomId={roomId} />;
}

// ================= ВНУТРЕННИЙ КОМПОНЕНТ =================
function ChatRoomWindow({ roomId }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const chatMainRef = useRef(null);

  // Redux: current user and rooms list.
  const currentUser = useSelector((st) => st.auth.user || st.auth.currentUser);
  const rooms = useSelector((st) => st.chat.rooms);
  // Redux: bootstrap users for avatar/name resolution.
  const companyUsers = useSelector((st) => st.bootstrap.companyUsers || []);
  // Redux: info panel open flag for this room.
  const isInfoOpen = useSelector(
    (st) => st.chat.infoPanelOpenByRoomId?.[String(roomId)]
  );
  // Redux: composer draft for this room.
  const composerDraft = useSelector(
    (st) => st.chat.composerDrafts?.[String(roomId)] || null
  );
  // Redux: composer mode + edit target.
  const composerMode = useSelector((st) => st.chat.composerMode);
  const editTarget = useSelector((st) => st.chat.editTarget);

  const meId = currentUser
    ? String(currentUser.userId || currentUser.id)
    : null;

  // первоначальная загрузка истории
  const { data, isLoading } = useGetMessagesQuery(
    { roomId },
    { skip: !roomId, refetchOnMountOrArgChange: true }
  );
  const [markRead] = useMarkReadMutation();
  const [editMessage, { isLoading: isEditing }] = useEditMessageMutation();
  const [deleteMessage, { isLoading: isDeleting }] =
    useDeleteMessageMutation();
  // Mutation for toggling message reactions.
  const [toggleReaction] = useToggleMessageReactionMutation();
  const [uploadFile] = useUploadFileMutation();
  const [getSignedDownload] = useLazyGetSignedDownloadUrlQuery();

  // lazy-хук для подгрузки старых сообщений
  const [loadMoreMessages] = useLazyGetMessagesQuery();
  const { data: pinnedData } = useGetPinnedQuery(
    { roomId },
    { skip: !roomId }
  );

  // Composer input value.
  const [text, setText] = useState("");
  // Reply/forward context for composer.
  const [composerContext, setComposerContext] = useState(null); // только reply
  // Draft attachments before sending.
  const [attachmentsDraft, setAttachmentsDraft] = useState([]);
  // Send error flag (used for retry UI).
  const [sendError, setSendError] = useState(false);

  // Refs for message list and scroll logic.
  const listRef = useRef(null);
  const lastReadIdRef = useRef(null);
  const jumpTokenRef = useRef(0);

  // флаг «мы уже сделали первичный скролл для этой комнаты»
  const initialScrollDoneRef = useRef(false);

  // Selection mode (multi-select messages).
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  // Forward modal state.
  const [forwardMessages, setForwardMessages] = useState([]);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  // Audit modal (show original text).
  const [originalModal, setOriginalModal] = useState({
    open: false,
    title: "",
    text: "",
  });
  // Confirm delete dialog state.
  const [deleteConfirm, setDeleteConfirm] = useState({
    open: false,
    message: null,
  });
  // Scroll-to-bottom button visibility.
  const [showScrollDown, setShowScrollDown] = useState(false);
  // Media viewer for message attachments.
  const [messageViewer, setMessageViewer] = useState({
    open: false,
    items: [],
    index: 0,
  });

  // Collapsed state for pinned bar.
  const [collapsedPinned, setCollapsedPinned] = useState(false);

  // Messages list from Redux for current room.
  const messages = useSelector((st) => st.chat.messages[String(roomId)] || []);
  // Active pinned index for current room.
  const activePinnedIndex = useSelector(
    (st) => st.chat.activePinnedIndexByRoomId?.[String(roomId)] ?? 0
  );

  // Refs to avoid stale closures while paging/jumping.
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
  // Pagination flags for loading older messages.
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
  // Local clock to auto-hide edit action after time window.
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
  // Track previous edit mode to sync composer text.
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
    setMessageViewer({ open: false, items: [], index: 0 });
    setDeleteConfirm({ open: false, message: null });
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
      return {
        title: t("chat.sidebar.roomFallback"),
        subtitle: "",
        initials: "C",
        avatar: "",
      };
    }

    if (room.type === "group") {
      const groupTitle = room.title || t("chat.header.groupFallback");
      const count = room.participants?.length || 0;

      return {
        title: groupTitle,
        subtitle: t("chat.header.groupMembersCount", { count }),
        initials: groupTitle[0] || "G",
        avatar: room.avatarUrl || "",
      };
    }

    const parts = room.participants || [];
    const otherPart = parts.find((p) => String(p.userId) !== meId) || parts[0];

    if (!otherPart) {
      return {
        title: t("chat.sidebar.roomFallback"),
        subtitle: "",
        initials: "C",
        avatar: "",
      };
    }

    const user =
      companyUsers.find(
        (u) => String(u.userId || u.id) === String(otherPart.userId)
      ) || otherPart;

    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");

    const displayName =
      fullName || user.email || t("chat.message.user");
    const init =
      (user.firstName?.[0] || displayName[0] || "U") +
      (user.lastName?.[0] || "");

    return {
      title: displayName,
      subtitle: t("chat.header.directSubtitle"),
      initials: init,
      avatar: user.avatarUrl || "",
    };
  }, [room, companyUsers, meId, t]);

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

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const update = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollDown(distance > 160);
    };
    update();
    el.addEventListener("scroll", update);
    return () => el.removeEventListener("scroll", update);
  }, [roomId, listRef, messages.length]);

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
        window.alert(t("chat.pinned.notFound"));
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

  // Active overlay controller (menu / reaction / dialog / viewer).
  const [activeOverlay, setActiveOverlay] = useState(null);

  const openMessageMenu = (message, e, anchorEl) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (selectMode) return;

    const wrapEl = anchorEl || e?.currentTarget;
    if (!wrapEl) return;

    const bubbleEl =
      wrapEl.closest?.('[data-role="msg-bubble"]') ||
      wrapEl.querySelector?.('[data-role="msg-bubble"]');
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

    setForwardDialogOpen(false);
    setForwardMessages([]);
    setDeleteConfirm({ open: false, message: null });
    setOriginalModal({ open: false, title: "", text: "" });
    setMessageViewer({ open: false, items: [], index: 0 });

    setActiveOverlay({ type: "menu", messageId: String(message._id) });
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

  const closeMenu = () => {
    setMenuState((prev) => ({
      ...prev,
      open: false,
    }));
    setActiveOverlay((prev) =>
      prev?.type === "menu" ? null : prev
    );
  };

  const toggleReactionPicker = useCallback(
    (messageId) => {
      if (!messageId) return;
      if (selectMode) return;
      if (activeOverlay?.type === "dialog" || activeOverlay?.type === "viewer") {
        return;
      }
      closeMenu();
      setActiveOverlay((prev) => {
        if (
          prev?.type === "reaction" &&
          String(prev.messageId) === String(messageId)
        ) {
          return null;
        }
        return { type: "reaction", messageId: String(messageId) };
      });
    },
    [closeMenu, selectMode, activeOverlay]
  );

  const closeReactionPicker = useCallback(() => {
    setActiveOverlay((prev) => (prev?.type === "reaction" ? null : prev));
  }, []);

  const handleOpenMediaViewer = useCallback(
    (items, index = 0) => {
      if (!Array.isArray(items) || !items.length) return;
      const safeIndex = Math.max(0, Math.min(index, items.length - 1));
      setMessageViewer({ open: true, items, index: safeIndex });
      setActiveOverlay({ type: "viewer" });
      closeMenu();
    },
    [closeMenu]
  );

  const handleCloseMediaViewer = useCallback(() => {
    setMessageViewer({ open: false, items: [], index: 0 });
    setActiveOverlay((prev) => (prev?.type === "viewer" ? null : prev));
  }, []);

  const getMessageAttachments = useCallback((msg) => {
    if (!msg) return [];
    const raw = msg?.meta?.attachments || msg?.attachments || [];
    const list = Array.isArray(raw) ? raw : [];
    return list.map(normalizeAttachment).filter(Boolean);
  }, []);

  const handleDownloadAttachment = useCallback(
    async (att) => {
      if (!att) return;
      try {
        let url = att.url ? normalizeUrl(att.url) : "";
        if (!url && att.fileId) {
          const res = await getSignedDownload(att.fileId).unwrap();
          url = normalizeUrl(res?.data?.url || res?.url || "");
        }
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      } catch {
        if (typeof window !== "undefined") {
          window.alert(t("chat.attach.downloadFailed"));
        }
      }
    },
    [getSignedDownload, t]
  );

  const handleOpenAttachment = useCallback(
    async (att, mediaItems, docItems) => {
      if (!att) return;
      if (mediaItems && mediaItems.length) {
        handleOpenMediaViewer(mediaItems, 0);
        return;
      }
      if (isPdfAttachment(att)) {
        handleOpenMediaViewer([att], 0);
        return;
      }

      try {
        let url = att.url ? normalizeUrl(att.url) : "";
        if (!url && att.fileId) {
          const res = await getSignedDownload(att.fileId).unwrap();
          url = normalizeUrl(res?.data?.url || res?.url || "");
        }
        if (!url) return;
        if (isOfficeAttachment(att)) {
          window.open(buildDocsViewerUrl(url), "_blank", "noopener,noreferrer");
        } else {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      } catch {
        if (typeof window !== "undefined") {
          window.alert(t("chat.attach.downloadFailed"));
        }
      } finally {
        closeMenu();
      }
    },
    [getSignedDownload, handleOpenMediaViewer, closeMenu, t]
  );

  // ====== ВСПОМОГАТЕЛЬНОЕ ======

  const makeAuthorName = (msg) => {
    try {
      const { name } = getAuthorInfo(msg, companyUsers);
      return name || t("chat.message.user");
    } catch {
      return t("chat.message.user");
    }
  };

  const getPinnedSnippet = (msg) => {
    if (!msg) return "";
    if (msg.deletedAt) return t("chat.message.deleted");

    const text = (msg.text || "").trim();
    if (text) return text;

    if (msg.forward?.textSnippet) return msg.forward.textSnippet;

    const metaAttachments = msg?.meta?.attachments;
    if (Array.isArray(metaAttachments) && metaAttachments.length) {
      return metaAttachments[0]?.filename || t("chat.message.attachment");
    }

    if (Array.isArray(msg.attachments) && msg.attachments.length) {
      return msg.attachments[0]?.name || t("chat.message.attachment");
    }

    return t("chat.message.fallback");
  };

  const getCurrentUserName = () => {
    if (!currentUser) return t("chat.message.someone");
    const full = [currentUser.firstName, currentUser.lastName]
      .filter(Boolean)
      .join(" ");
    return full || currentUser.email || t("chat.message.user");
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
      return { title: t("chat.modal.beforeDelete"), text: audit.textBeforeDelete };
    }

    if (msg.editedAt && audit.prevText) {
      return { title: t("chat.modal.beforeEdit"), text: audit.prevText };
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
          t("chat.message.attachment");
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
    setActiveOverlay({ type: "dialog", kind: "forward" });
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
    setActiveOverlay({ type: "dialog", kind: "forward" });
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
        setActiveOverlay((prev) =>
          prev?.type === "dialog" && prev?.kind === "forward" ? null : prev
        );
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
        : t("chat.message.fallback");

      const systemText = t("chat.system.pin", {
        name: actorName,
        text: preview,
      });

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

  const handleDelete = (msg) => {
    if (!msg || !msg._id) {
      closeMenu();
      return;
    }
    if (!isMessageDeletable(msg)) {
      closeMenu();
      return;
    }
    setDeleteConfirm({ open: true, message: msg });
    setActiveOverlay({
      type: "dialog",
      kind: "delete",
      messageId: String(msg._id),
    });
    closeMenu();
  };

  // Toggle reaction for a message and sync response into Redux.
  const handleToggleReaction = async (messageId, emoji) => {
    if (!messageId || !emoji) return;
    try {
      const res = await toggleReaction({
        messageId: String(messageId),
        emoji,
      }).unwrap();

      const payload = res?.emoji ? res : res?.data || null;
      if (!payload) return;

      dispatch(
        updateReaction({
          messageId: String(payload.messageId || messageId),
          emoji: payload.emoji || emoji,
          count: typeof payload.count === "number" ? payload.count : undefined,
          reacted:
            typeof payload.reacted === "boolean" ? payload.reacted : undefined,
        })
      );
    } catch (e) {
      if (typeof window !== "undefined") {
        window.alert(t("common.error"));
      }
    }
  };

  const confirmDelete = async () => {
    const msg = deleteConfirm.message;
    if (!msg || !msg._id) {
      setDeleteConfirm({ open: false, message: null });
      setActiveOverlay((prev) =>
        prev?.type === "dialog" && prev?.kind === "delete" ? null : prev
      );
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
          window.alert(t("chat.errors.deleteForbidden"));
        }
      } else {
        if (typeof window !== "undefined") {
          window.alert(t("chat.errors.deleteFailed"));
        }
      }
    } finally {
      setDeleteConfirm({ open: false, message: null });
      setActiveOverlay((prev) =>
        prev?.type === "dialog" && prev?.kind === "delete" ? null : prev
      );
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
    setActiveOverlay({ type: "dialog", kind: "original" });
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
            window.alert(t("chat.errors.editForbidden"));
          }
        } else {
          if (typeof window !== "undefined") {
            window.alert(t("chat.errors.editFailed"));
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

  const openSearchMode = () => {
    if (searchOpen) return;
    closeMenu();
    closeReactionPicker();
    setDeleteConfirm({ open: false, message: null });
    setForwardDialogOpen(false);
    setForwardMessages([]);
    setOriginalModal({ open: false, title: "", text: "" });
    setMessageViewer({ open: false, items: [], index: 0 });
    setActiveOverlay(null);
    dispatch(closeInfoPanel(roomId));
    toggleSearch();
  };

  const closeSearchMode = () => {
    if (!searchOpen) return;
    closeSearch();
  };

  const handleSearchInputChange = (e) => {
    if (!searchOpen) toggleSearch();
    handleSearchChange(e);
  };

  // ESC closes the top layer: overlays first, then search.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (e.defaultPrevented) return;

      if (activeOverlay) {
        e.preventDefault();
        e.stopPropagation();

        if (activeOverlay.type === "menu") {
          closeMenu();
          return;
        }
        if (activeOverlay.type === "reaction") {
          closeReactionPicker();
          return;
        }
        if (activeOverlay.type === "dropdown") {
          setActiveOverlay(null);
          return;
        }
        if (activeOverlay.type === "viewer") {
          handleCloseMediaViewer();
          return;
        }
        if (activeOverlay.type === "dialog") {
          if (activeOverlay.kind === "delete") {
            setDeleteConfirm({ open: false, message: null });
          }
          if (activeOverlay.kind === "forward") {
            setForwardDialogOpen(false);
            setForwardMessages([]);
          }
          if (activeOverlay.kind === "original") {
            setOriginalModal({ open: false, title: "", text: "" });
          }
          setActiveOverlay(null);
        }
        return;
      }

      if (searchOpen) {
        e.preventDefault();
        e.stopPropagation();
        closeSearchMode();
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [
    activeOverlay,
    searchOpen,
    closeSearchMode,
    closeMenu,
    closeReactionPicker,
    handleCloseMediaViewer,
  ]);

  // ================= РЕНДЕР =================
  const attachmentActions = useMemo(() => {
    const msg = menuState.message;
    if (!msg || msg.deletedAt) return null;
    const attachments = getMessageAttachments(msg);
    if (!attachments.length) return null;

    const mediaItems = attachments.filter(isMediaAttachment);
    const docItems = attachments.filter(
      (att) => !isMediaAttachment(att) && !isAudioAttachment(att)
    );

    const primaryDoc = docItems[0] || null;
    const primaryMedia = mediaItems[0] || null;

    const canOpen = Boolean(primaryMedia || primaryDoc);
    const canDownload = Boolean(primaryMedia || primaryDoc);

    const openLabel = primaryDoc
      ? t("chat.attach.preview", "Preview")
      : t("chat.attach.open", "Open");

    return {
      canOpen,
      canDownload,
      openLabel,
      onOpen: () =>
        handleOpenAttachment(
          primaryMedia || primaryDoc,
          mediaItems,
          docItems
        ),
      onDownload: () =>
        handleDownloadAttachment(primaryMedia || primaryDoc),
    };
  }, [
    menuState.message,
    getMessageAttachments,
    handleOpenAttachment,
    handleDownloadAttachment,
    t,
  ]);

  const messagesClass = [
    s.messages,
    scrollState.scrollable ? s.messagesScrollable : "",
    scrollState.scrollable && scrollState.scrolled ? s.messagesScrolled : "",
    messageViewer.open ? s.messagesBlocked : "",
  ]
    .filter(Boolean)
    .join(" ");

  const pinnedVisible = !!currentPinned && !searchOpen;
  const floatingDayTop = searchOpen ? 104 : pinnedVisible ? 104 : 64;

  const handleBack = () => {
    dispatch(setActiveRoom(null));
  };

  const handleToggleDropdown = (e) => {
    if (!roomId || !room) return;
    const anchorRect = e?.currentTarget?.getBoundingClientRect?.() || null;
    const defaultTab = room.type === "group" ? "participants" : "profile";
    if (activeOverlay?.type === "dropdown") {
      setActiveOverlay(null);
      return;
    }
    closeMenu();
    closeReactionPicker();
    setDeleteConfirm({ open: false, message: null });
    setForwardDialogOpen(false);
    setForwardMessages([]);
    setOriginalModal({ open: false, title: "", text: "" });
    setMessageViewer({ open: false, items: [], index: 0 });
    dispatch(setInfoPanelTab({ roomId, tab: defaultTab }));
    setActiveOverlay({ type: "dropdown", anchorRect });
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

  useEffect(() => {
    const node = chatMainRef.current;
    if (!node) return;
    node.classList.remove(s.chatMainSwap);
    void node.offsetWidth;
    node.classList.add(s.chatMainSwap);
  }, [roomId]);

  return (
    <div className={s.window}>
      {/* Center column */}
      <div className={s.chatMain} ref={chatMainRef}>
        <ChatHeader
          initials={headerInfo.initials}
          avatar={headerInfo.avatar}
          title={headerInfo.title}
          subtitle={subtitleToShow}
          isArchived={
            room?.isArchived === true || room?.status === "archived"
          }
          onBack={handleBack}
          isSearchMode={searchOpen}
          searchQuery={searchQuery}
          currentMatch={currentMatch}
          totalMatches={totalMatches}
          onSearchChange={handleSearchInputChange}
          onSearchOpen={openSearchMode}
          onSearchClose={closeSearchMode}
          onSearchPrev={gotoPrevMatch}
          onSearchNext={gotoNextMatch}
          onTitleClick={handleToggleDropdown}
        />

        {pinnedVisible && (
          <div
            className={`${s.pinnedBar} ${
              collapsedPinned ? s.pinnedCollapsed : ""
            }`}
          >
          <div className={s.pinnedLeft} onClick={handlePinnedBarClick}>
              <div>{t("chat.pinned.title")}</div>
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

        <div className={s.messagesSurface} data-ui="chat-messages">
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
            onOpenMedia={handleOpenMediaViewer}
            onToggleReaction={handleToggleReaction}
            activeOverlay={activeOverlay}
            onToggleReactionPicker={toggleReactionPicker}
            onCloseReactionPicker={closeReactionPicker}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={handleLoadMore}
          />

          {messageViewer.open && activeOverlay?.type === "viewer" && (
            <MediaViewer
              items={messageViewer.items}
              activeIndex={messageViewer.index}
              onChangeIndex={(idx) =>
                setMessageViewer((prev) => ({ ...prev, index: idx }))
              }
              onClose={handleCloseMediaViewer}
              inChat
            />
          )}
        </div>

        {showScrollDown && (
          <button
            type="button"
            className={s.scrollToBottom}
            onClick={() => scrollToBottom(true)}
            aria-label={t("chat.actions.scrollToBottom")}
          >
            ↓
          </button>
        )}

        <MessageContextMenu
          open={menuState.open && activeOverlay?.type === "menu"}
          anchorRect={menuState.anchorRect}
          boundsRect={menuState.boundsRect}
          side={menuState.side}
          clickY={menuState.clickY}
          message={menuState.message}
          attachmentActions={attachmentActions}
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
          showOriginalLabel={t("chat.menu.showOriginal")}
        />

        <ForwardDialog
          open={
            forwardDialogOpen &&
            activeOverlay?.type === "dialog" &&
            activeOverlay?.kind === "forward"
          }
          onClose={() => {
            setForwardDialogOpen(false);
            setForwardMessages([]);
            setActiveOverlay((prev) =>
              prev?.type === "dialog" && prev?.kind === "forward" ? null : prev
            );
          }}
          rooms={rooms}
          currentRoomId={roomId}
          meId={meId}
          companyUsers={companyUsers}
          onSelectRoom={handleForwardSelectRoom}
        />

        <Modal
          open={
            originalModal.open &&
            activeOverlay?.type === "dialog" &&
            activeOverlay?.kind === "original"
          }
          onClose={() => {
            setOriginalModal({ open: false, title: "", text: "" });
            setActiveOverlay((prev) =>
              prev?.type === "dialog" && prev?.kind === "original" ? null : prev
            );
          }}
          title={originalModal.title || t("chat.modal.originalTitle")}
          size="sm"
          footer={
            <Modal.Button
              onClick={() => {
                setOriginalModal({ open: false, title: "", text: "" });
                setActiveOverlay((prev) =>
                  prev?.type === "dialog" && prev?.kind === "original"
                    ? null
                    : prev
                );
              }}
            >
              {t("common.close")}
            </Modal.Button>
          }
        >
          <div>{originalModal.text || t("common.none")}</div>
        </Modal>

        <ConfirmDialog
          open={
            deleteConfirm.open &&
            activeOverlay?.type === "dialog" &&
            activeOverlay?.kind === "delete"
          }
          title={t("chat.delete.title")}
          text={t("chat.delete.text")}
          okText={t("common.delete")}
          cancelText={t("common.cancel")}
          onOk={confirmDelete}
          onCancel={() => {
            setDeleteConfirm({ open: false, message: null });
            setActiveOverlay((prev) =>
              prev?.type === "dialog" && prev?.kind === "delete" ? null : prev
            );
          }}
        />

        {selectMode && (
          <div className={s.selectBar}>
            <button
              type="button"
              className={s.selectBarBtnDanger}
              onClick={clearSelection}
            >
              {t("chat.select.clear")}
            </button>

            <div className={s.selectBarLabel}>
              {t("chat.select.selectedCount", { count: selectedIds.length })}
            </div>

            <button
              type="button"
              className={s.selectBarBtnPrimary}
              disabled={!selectedIds.length}
              onClick={handleForwardSelected}
            >
              {t("chat.select.forward")}
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

      {/* Right info column (kept, but not used in dropdown mode) */}
      <div className={`${s.chatSide} ${isInfoOpen ? s.chatSideOpen : ""}`}>
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
          variant="side"
        />
      </div>

      {/* Header dropdown (overlay) */}
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
        variant="layer"
        openOverride={activeOverlay?.type === "dropdown"}
        anchorRect={activeOverlay?.anchorRect || null}
        onRequestClose={() => setActiveOverlay(null)}
      />
    </div>
  );
}
