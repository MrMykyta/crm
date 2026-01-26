// components/chat/info/ChatInfoPanel.jsx
// Slide-down Info Panel for the current chat: participants/media/links/documents,
// plus optional group edit (title/avatar) and media viewer integration.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { useUploadFileMutation } from "../../../store/rtk/filesApi";
import { useUpdateRoomMutation } from "../../../store/rtk/chatApi";
import { useSignedFileUrl } from "../../../hooks/useSignedFileUrl";
import MediaViewer from "../MediaViewer";
import {
  closeInfoPanel,
  setInfoPanelTab,
} from "../../../store/slices/chatSlice";
import { getAuthorInfo } from "../../../pages/Chat/utils/chatMessageUtils";
import ImagePicker from "../../inputs/ImagePicker";
import ChatInfoHeader from "./ChatInfoHeader";
import ChatInfoTabs from "./ChatInfoTabs";
import ParticipantsTab from "./tabs/ParticipantsTab";
import ProfileTab from "./tabs/ProfileTab";
import MediaTab from "./tabs/MediaTab";
import LinksTab from "./tabs/LinksTab";
import DocumentsTab from "./tabs/DocumentsTab";
import s from "./ChatInfoPanel.module.css";

// How many media thumbnails should request signed URLs immediately.
const MAX_MEDIA_PREVIEW = 30;
// Max history load attempts for tabs.
const MAX_LOAD_ATTEMPTS = 6;

/**
 * Extract http(s) links from text.
 * @param {string} text
 * @returns {string[]}
 */
const extractLinks = (text) => {
  const res = [];
  if (!text) return res;
  const regex = /https?:\/\/[^\s)]+/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    let url = match[0];
    url = url.replace(/[),.]+$/, "");
    res.push(url);
  }
  return res;
};

export default function ChatInfoPanel({
  roomId,
  room,
  messages,
  participants,
  meId,
  currentUser,
  companyUsers,
  hasMore,
  isLoadingMore,
  onLoadMore,
}) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  // Open state for the slide-down panel.
  const isOpen = useSelector(
    (st) => st.chat.infoPanelOpenByRoomId?.[String(roomId)]
  );
  // Active tab for the current room panel.
  const activeTab = useSelector(
    (st) => st.chat.infoPanelActiveTabByRoomId?.[String(roomId)]
  );

  // Editing mode for group title/avatar.
  const [isEditing, setIsEditing] = useState(false);
  // Draft title value while editing group name.
  const [titleDraft, setTitleDraft] = useState("");
  // Draft avatar fileId while editing group avatar.
  const [avatarDraftId, setAvatarDraftId] = useState("");
  // Local loading state for info panel pagination.
  const [isInfoLoading, setIsInfoLoading] = useState(false);
  // Media viewer state (overlay for images/videos).
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Keep last known message count to detect if load-more added anything.
  const messagesCountRef = useRef(messages?.length || 0);

  // Files upload for group avatar (signed files API).
  const [uploadFile, { isLoading: isAvatarUploading }] = useUploadFileMutation();
  // Update room (title/avatar/archive) via chat API.
  const [updateRoom, { isLoading: isSaving }] = useUpdateRoomMutation();

  const isGroup = room?.type === "group";
  const defaultTab = isGroup ? "participants" : "profile";

  // Signed URL source for group avatar (only when panel open).
  const avatarSource = isOpen
    ? avatarDraftId || room?.avatarUrl || ""
    : "";
  const { url: avatarPreviewUrl, onError: onAvatarError } =
    useSignedFileUrl(avatarSource);

  // Current user's global role.
  const currentUserRole = currentUser?.role || null;
  const isSystemPrivileged =
    currentUserRole === "admin" || currentUserRole === "owner";

  // Current participant entry for permissions in this room.
  const myParticipant = useMemo(() => {
    if (!meId || !Array.isArray(participants)) return null;
    return (
      participants.find((p) => String(p.userId) === String(meId)) || null
    );
  }, [participants, meId]);

  const canEditGroup =
    isGroup &&
    (isSystemPrivileged ||
      myParticipant?.role === "admin" ||
      String(room?.createdBy || "") === String(meId));

  useEffect(() => {
    messagesCountRef.current = messages?.length || 0;
  }, [messages?.length]);

  useEffect(() => {
    if (!isOpen) return;
    if (!activeTab) {
      dispatch(setInfoPanelTab({ roomId, tab: defaultTab }));
    }
  }, [dispatch, isOpen, activeTab, roomId, defaultTab]);

  useEffect(() => {
    if (!roomId) return;
    setIsEditing(false);
    setTitleDraft(room?.title || "");
    setAvatarDraftId(room?.avatarUrl || "");
    setViewerOpen(false);
    setViewerIndex(0);
  }, [roomId]);

  useEffect(() => {
    if (isEditing) return;
    setTitleDraft(room?.title || "");
    setAvatarDraftId(room?.avatarUrl || "");
  }, [room?.title, room?.avatarUrl, isEditing]);

  /** Close panel and reset editing state. */
  const handleClose = useCallback(() => {
    if (!roomId) return;
    dispatch(closeInfoPanel(roomId));
    setIsEditing(false);
    setViewerOpen(false);
  }, [dispatch, roomId]);

  /** Upload new group avatar via Files API and store fileId locally. */
  const handleAvatarUpload = useCallback(
    async (file) => {
      if (!roomId || !file) return { url: "" };
      const res = await uploadFile({
        ownerType: "chatMessage",
        ownerId: roomId,
        file,
        purpose: "avatar",
        visibility: "private",
      }).unwrap();

      const fileId = res?.data?.id || res?.id;
      if (fileId) {
        setAvatarDraftId(String(fileId));
      }
      return { url: "" };
    },
    [roomId, uploadFile]
  );

  /** Persist group name/avatar changes. */
  const handleSave = useCallback(async () => {
    if (!roomId || !room) return;
    const nextTitle = titleDraft.trim();
    const patch = {};
    if (nextTitle && nextTitle !== (room.title || "")) {
      patch.title = nextTitle;
    }
    if ((avatarDraftId || "") !== (room.avatarUrl || "")) {
      patch.avatarUrl = avatarDraftId || null;
    }
    if (!Object.keys(patch).length) {
      setIsEditing(false);
      return;
    }
    try {
      await updateRoom({ roomId, patch }).unwrap();
      setIsEditing(false);
    } catch (e) {
      if (typeof window !== "undefined") {
        window.alert(t("common.error"));
      }
    }
  }, [roomId, room, titleDraft, avatarDraftId, updateRoom, t]);

  /** Load more messages to enrich Media/Links/Documents lists. */
  const handleLoadMore = useCallback(async () => {
    if (!onLoadMore || isInfoLoading || isLoadingMore || !hasMore) return;
    setIsInfoLoading(true);
    let attempts = 0;
    let prevCount = messagesCountRef.current;

    while (attempts < MAX_LOAD_ATTEMPTS) {
      // eslint-disable-next-line no-await-in-loop
      const res = await onLoadMore();
      attempts += 1;

      // allow state to update
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 0));

      const nextCount = messagesCountRef.current;
      const changed = nextCount > prevCount;
      if (changed) prevCount = nextCount;

      if (!res?.ok || res?.done) break;
      if (!changed) break;
    }

    setIsInfoLoading(false);
  }, [onLoadMore, isInfoLoading, isLoadingMore, hasMore]);

  // Normalize participants for display (name/email/role/avatar).
  const participantsList = useMemo(() => {
    if (!Array.isArray(participants)) return [];
    return participants.map((p) => {
      const user =
        companyUsers?.find(
          (u) => String(u.userId || u.id) === String(p.userId)
        ) || null;
      const fullName = user
        ? [user.firstName, user.lastName].filter(Boolean).join(" ")
        : "";
      const name = fullName || user?.email || "—";
      const baseInitial =
        user?.firstName?.[0] || (name && name !== "—" ? name[0] : "U");
      const initials = baseInitial + (user?.lastName?.[0] || "");
      return {
        userId: p.userId,
        role: p.role,
        name,
        email: user?.email || "",
        department: user?.departmentName || user?.department || "",
        avatarUrl: user?.avatarUrl || "",
        initials,
      };
    });
  }, [participants, companyUsers]);

  const otherUserInfo = useMemo(() => {
    if (!participantsList.length || !meId) return null;
    const other = participantsList.find(
      (p) => String(p.userId) !== String(meId)
    );
    if (!other) return null;
    const authorInfo = getAuthorInfo(
      { authorId: other.userId, author: { avatarUrl: other.avatarUrl } },
      companyUsers
    );
    return {
      ...other,
      avatar: authorInfo.avatar || other.avatarUrl,
      initials: authorInfo.initials || other.initials,
      subtitle:
        [other.department, other.role].filter(Boolean).join(" · ") || "",
    };
  }, [participantsList, meId, companyUsers]);

  const { url: otherAvatarUrl, onError: onOtherAvatarError } = useSignedFileUrl(
    isOpen ? otherUserInfo?.avatar || "" : ""
  );

  // Flatten all attachments from current message list.
  const attachments = useMemo(() => {
    const list = [];
    (messages || []).forEach((m) => {
      if (!m || m.isSystem || m.deletedAt) return;
      const arr = m?.meta?.attachments || m?.attachments || [];
      if (!Array.isArray(arr) || !arr.length) return;
      arr.forEach((a) => {
        const fileId = a?.fileId || a?.id;
        if (!fileId) return;
        list.push({
          fileId,
          filename: a?.filename || a?.name || "File",
          mime: a?.mime || a?.mimeType || "",
          size: a?.size || 0,
          messageId: m._id,
          createdAt: m.createdAt,
        });
      });
    });
    list.sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return tb - ta;
    });
    return list;
  }, [messages]);

  // Media = images/videos only.
  const mediaItems = useMemo(() => {
    return attachments.filter((a) =>
      a.mime ? a.mime.startsWith("image/") || a.mime.startsWith("video/") : false
    );
  }, [attachments]);

  // Documents = everything except image/video.
  const documentItems = useMemo(() => {
    return attachments.filter((a) => {
      if (!a.mime) return true;
      if (a.mime.startsWith("image/")) return false;
      if (a.mime.startsWith("video/")) return false;
      return true;
    });
  }, [attachments]);

  // Extract links from message texts.
  const linkItems = useMemo(() => {
    const map = new Map();
    (messages || []).forEach((m) => {
      if (!m || m.isSystem || m.deletedAt) return;
      const links = extractLinks(m.text || "");
      links.forEach((url) => {
        if (!map.has(url)) {
          map.set(url, {
            url,
            messageId: m._id,
            createdAt: m.createdAt,
          });
        }
      });
    });
    const list = Array.from(map.values());
    list.sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return tb - ta;
    });
    return list;
  }, [messages]);

  /** Open media viewer at a given index. */
  const handleOpenMedia = useCallback(
    (idx) => {
      if (!Array.isArray(mediaItems) || !mediaItems.length) return;
      const safeIdx = Math.max(0, Math.min(idx, mediaItems.length - 1));
      setViewerIndex(safeIdx);
      setViewerOpen(true);
    },
    [mediaItems]
  );

  if (!isOpen || !room) return null;

  const groupInitials = room?.title
    ? String(room.title).trim().slice(0, 1).toUpperCase()
    : "#";

  const tabs = isGroup
    ? [
        { key: "participants", label: t("chat.info.tabs.participants") },
        { key: "media", label: t("chat.info.tabs.media") },
        { key: "links", label: t("chat.info.tabs.links") },
        { key: "documents", label: t("chat.info.tabs.documents") },
      ]
    : [
        { key: "profile", label: t("chat.info.tabs.profile") },
        { key: "media", label: t("chat.info.tabs.media") },
        { key: "links", label: t("chat.info.tabs.links") },
        { key: "documents", label: t("chat.info.tabs.documents") },
      ];

  const currentTab = activeTab || defaultTab;

  return (
    <div className={s.infoLayer}>
      <div className={s.infoOverlay} onClick={handleClose} />
      <div className={s.infoPanel} onClick={(e) => e.stopPropagation()}>
        <div className={s.infoPanelInner}>
          <ChatInfoHeader
            isGroup={isGroup}
            title={room.title || t("chat.info.title")}
            subtitle={room.subtitle || ""}
            avatarUrl={avatarPreviewUrl}
            initials={groupInitials}
            onAvatarError={isGroup ? onAvatarError : onOtherAvatarError}
            otherUser={
              otherUserInfo
                ? { ...otherUserInfo, avatar: otherAvatarUrl }
                : null
            }
            canEdit={canEditGroup}
            isEditing={isEditing}
            titleDraft={titleDraft}
            onTitleChange={setTitleDraft}
            onEdit={() => setIsEditing(true)}
            onCancel={() => {
              setIsEditing(false);
              setTitleDraft(room?.title || "");
              setAvatarDraftId(room?.avatarUrl || "");
            }}
            onSave={handleSave}
            isSaving={isSaving}
            onClose={handleClose}
            avatarUploader={handleAvatarUpload}
            isAvatarUploading={isAvatarUploading}
          />

          <ChatInfoTabs
            tabs={tabs}
            activeTab={currentTab}
            onChange={(tab) => dispatch(setInfoPanelTab({ roomId, tab }))}
          />

          <div className={s.infoContent}>
            {currentTab === "participants" && (
              <ParticipantsTab
                participants={participantsList}
                emptyText={t("chat.info.empty.participants")}
                searchPlaceholder={t("chat.info.fields.searchParticipants")}
              />
            )}

            {currentTab === "profile" && (
              <ProfileTab
                profile={otherUserInfo}
                emptyText={t("chat.info.empty.profile")}
              />
            )}

            {currentTab === "media" && (
              <MediaTab
                items={mediaItems}
                maxPreview={MAX_MEDIA_PREVIEW}
                emptyText={t("chat.info.empty.media")}
                loadMoreLabel={t("chat.info.actions.loadMore")}
                hasMore={hasMore}
                isLoading={isInfoLoading}
                onLoadMore={handleLoadMore}
                onOpen={handleOpenMedia}
              />
            )}

            {currentTab === "links" && (
              <LinksTab
                items={linkItems}
                emptyText={t("chat.info.empty.links")}
                openLabel={t("chat.info.links.open")}
                loadMoreLabel={t("chat.info.actions.loadMore")}
                hasMore={hasMore}
                isLoading={isInfoLoading}
                onLoadMore={handleLoadMore}
              />
            )}

            {currentTab === "documents" && (
              <DocumentsTab
                items={documentItems}
                emptyText={t("chat.info.empty.documents")}
                downloadLabel={t("chat.info.documents.download")}
                loadMoreLabel={t("chat.info.actions.loadMore")}
                hasMore={hasMore}
                isLoading={isInfoLoading}
                onLoadMore={handleLoadMore}
              />
            )}
          </div>
        </div>
      </div>

      {viewerOpen && (
        <MediaViewer
          items={mediaItems}
          activeIndex={viewerIndex}
          onChangeIndex={setViewerIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  );
}
