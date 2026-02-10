// src/pages/Chat/ChatSidebar.jsx
// Chat sidebar with room list, search, and avatar rendering via signed URLs.
// Important: avatars always come from current RTK sources (company users / room),
// so list updates immediately after avatar changes.
import React, { useMemo, useState, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import { useSignedFileUrl } from "../../../hooks/useSignedFileUrl";
import { useListCompanyUsersQuery } from "../../../store/rtk/companyUsersApi";
import { setActiveRoom } from "../../../store/slices/chatSlice";
import {
  MessageSquarePlus,
  Users,
  MessageSquare,
  Search,
  Settings,
} from "lucide-react";

import s from "../ChatPage.module.css";

/**
 * Compute fallback initials for avatars.
 * @param {string} name
 * @returns {string}
 */
function getInitials(name = "") {
  const trimmed = name.trim();
  if (!trimmed) return "C";

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return trimmed.slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + (parts[1][0] || "")).toUpperCase();
}

/**
 * Compact room time label (HH:MM).
 * @param {string|Date} value
 * @returns {string}
 */
function formatRoomTime(value) {
  if (!value) return "";
  const dt = typeof value === "string" ? new Date(value) : value;
  if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Room list item with signed avatar rendering.
 * @param {object} props
 */
function ChatRoomItem({
  room,
  isActive,
  unread,
  onClick,
}) {
  const { t } = useTranslation();
  // Signed inline URL for avatar (auto-refetch on expiration).
  const { url: avatarUrl, onError } = useSignedFileUrl(room.avatarSource || "");
  return (
    <div
      className={isActive ? s.roomActive : s.room}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick();
      }}
    >
      <div className={s.roomAvatar}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className={s.roomAvatarImg}
            onError={onError}
          />
        ) : (
          <span>{room.avatarInitials}</span>
        )}
      </div>

      <div className={s.roomText}>
        <div className={s.roomTitle}>{room.displayName}</div>
        <div className={s.roomPreview}>
          {room.lastMessagePreview || t("chat.sidebar.noMessages")}
        </div>
      </div>

      <div className={s.roomMeta}>
        <div className={s.roomTime}>{room.timeLabel || ""}</div>
        {unread > 0 && (
          <div className={s.roomUnread}>
            {unread > 99 ? t("chat.sidebar.unreadMax") : unread}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatSidebar({
  onCreateDirect,
  onCreateGroup,
  onSelectRoom,
}) {
  const { t } = useTranslation();
  const rooms = useSelector((state) => state.chat.rooms);
  const activeRoomId = useSelector((state) => state.chat.activeRoomId);
  const currentUser = useSelector(
    (state) => state.auth.user || state.auth.currentUser
  );

  // Current user id for filtering direct chats.
  const currentUserId = useMemo(() => {
    if (!currentUser) return null;
    return String(currentUser.userId || currentUser.id);
  }, [currentUser]);

  // Company members from RTK query (auto-refetch on invalidation).
  const { data: companyUsersData } = useListCompanyUsersQuery(
    { page: 1, limit: 200, sort: "lastName", dir: "ASC" },
    {
      skip: !currentUserId,
      refetchOnFocus: false,
      refetchOnReconnect: false,
    }
  );

  // Fallback snapshot from bootstrap for first paint.
  const rawCompanyUsers = useSelector(
    (state) => state.bootstrap.companyUsers || []
  );

  const companyUsers = useMemo(() => {
    const queryItems = companyUsersData?.items || companyUsersData?.data || [];
    if (Array.isArray(queryItems) && queryItems.length) return queryItems;
    if (Array.isArray(rawCompanyUsers)) return rawCompanyUsers;
    if (Array.isArray(rawCompanyUsers.items)) return rawCompanyUsers.items;
    return [];
  }, [rawCompanyUsers, companyUsersData]);

  const dispatch = useDispatch();

  // Search input value in sidebar.
  const [search, setSearch] = useState("");
  // Dropdown for create chat/group.
  const [menuOpen, setMenuOpen] = useState(false);
  // Refs for menu positioning and outside click detection.
  const menuRef = useRef(null);
  const btnRef = useRef(null);

  const userMap = useMemo(() => {
    const map = {};
    companyUsers.forEach((u) => {
      const key = String(u.userId || u.id);
      map[key] = u;
    });
    return map;
  }, [companyUsers]);

  // Decorate rooms: displayName + initials + avatar source + time label.
  const decoratedRooms = useMemo(() => {
    if (!Array.isArray(rooms)) return [];

    return rooms.map((room) => {
      let displayName = t("chat.sidebar.roomFallback");
      let avatarSource = "";

      if (room.type === "direct") {
        const participants = room.participants || [];
        const other =
          participants.find(
            (p) =>
              p.userId &&
              (!currentUserId ||
                String(p.userId) !== String(currentUserId))
          ) || participants[0];

        if (other) {
          const u = userMap[String(other.userId)] || other;
          const fullName = [u.firstName, u.lastName]
            .filter(Boolean)
            .join(" ");
          displayName =
            fullName || u.email || u.userId || t("chat.message.user");
          avatarSource = u.avatarUrl || room.avatarUrl || "";
        }
      } else {
        displayName = room.title || t("chat.header.groupFallback");
        avatarSource = room.avatarUrl || "";
      }

      const avatarInitials = getInitials(displayName);

      return {
        ...room,
        displayName,
        avatarInitials,
        avatarSource,
        timeLabel: formatRoomTime(room.lastMessageAt),
        myUnreadCount:
          typeof room.myUnreadCount === "number" ? room.myUnreadCount : 0,
      };
    });
  }, [rooms, userMap, currentUserId, t]);

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return decoratedRooms;

    return decoratedRooms.filter((room) => {
      const title = (room.displayName || "").toLowerCase();
      const preview = (room.lastMessagePreview || "").toLowerCase();
      return title.includes(q) || preview.includes(q);
    });
  }, [decoratedRooms, search]);

  /** Toggle create menu. */
  const toggleMenu = () => setMenuOpen((v) => !v);
  /** Close create menu. */
  const closeMenu = () => setMenuOpen(false);

  /** Start direct chat creation flow. */
  const handleCreateDirectClick = () => {
    closeMenu();
    onCreateDirect && onCreateDirect();
  };

  /** Start group chat creation flow. */
  const handleCreateGroupClick = () => {
    closeMenu();
    onCreateGroup && onCreateGroup();
  };

  /** Placeholder settings action (UI only). */
  const handleSettingsClick = () => {
    closeMenu();
  };

  useEffect(() => {
    if (!menuOpen) return;

    const onClick = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        btnRef.current &&
        !btnRef.current.contains(e.target)
      ) {
        closeMenu();
      }
    };

    const onKey = (e) => {
      if (e.key === "Escape") closeMenu();
    };

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div className={s.sidebar} data-ui="chat-sidebar">
      {/* HEADER */}
      <div className={s.sidebarHeader}>
        <div className={s.sidebarTitle}>{t("chat.sidebar.title")}</div>

        <div className={s.sidebarHeaderRight}>
          <button
            ref={btnRef}
            type="button"
            className={s.newChatBtn}
            onClick={toggleMenu}
          >
            <MessageSquarePlus size={20} className={s.newChatBtnIcon} />
          </button>

          {menuOpen && (
            <div ref={menuRef} className={s.newChatMenu}>
              <button
                type="button"
                className={s.newChatItem}
                onClick={handleCreateGroupClick}
              >
                <Users size={18} /> {t("chat.sidebar.newGroup")}
              </button>
              <button
                type="button"
                className={s.newChatItem}
                onClick={handleCreateDirectClick}
              >
                <MessageSquare size={18} /> {t("chat.sidebar.newDirect")}
              </button>
              <button
                type="button"
                className={s.newChatItem}
                onClick={handleSettingsClick}
              >
                <Settings size={18} /> {t("chat.sidebar.settings")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SEARCH */}
      <div className={s.headerSearchWrap}>
        <div className={s.searchInputWrap}>
          <Search size={16} className={s.searchIcon} />
          <input
            type="text"
            className={s.searchInputHeader}
            placeholder={t("chat.sidebar.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ROOMS LIST */}
      <div className={s.roomsList}>
        {filteredRooms.length === 0 && (
          <div className={s.roomsEmpty}>
            <MessageSquare size={32} className={s.roomsEmptyIcon} />
            <div className={s.roomsEmptyTitle}>
              {t("chat.sidebar.emptyTitle")}
            </div>
            <div className={s.roomsEmptySubtitle}>
              {t("chat.sidebar.emptySubtitle")}
            </div>
          </div>
        )}

        {filteredRooms.map((room) => {
          const idStr = String(room._id);
          const isActive = idStr === String(activeRoomId);
          const unread = room.myUnreadCount || 0;

          return (
            <ChatRoomItem
              key={idStr}
              room={room}
              isActive={isActive}
              unread={unread}
              onClick={() => {
                if (onSelectRoom) {
                  onSelectRoom(idStr);
                  return;
                }
                dispatch(setActiveRoom(idStr));
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
