// src/pages/Chat/ChatSidebar.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { setActiveRoom } from "../../../store/slices/chatSlice";
import { MessageSquarePlus, Users, MessageSquare } from "lucide-react";

import s from "../ChatPage.module.css";

function getInitials(name = "") {
  const trimmed = name.trim();
  if (!trimmed) return "C";

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return trimmed.slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + (parts[1][0] || "")).toUpperCase();
}

export default function ChatSidebar({ onCreateDirect, onCreateGroup }) {
  const rooms = useSelector((state) => state.chat.rooms);
  const activeRoomId = useSelector((state) => state.chat.activeRoomId);
  const currentUser = useSelector(
    (state) => state.auth.user || state.auth.currentUser
  );

  const rawCompanyUsers = useSelector(
    (state) => state.bootstrap.companyUsers || []
  );

  const companyUsers = useMemo(() => {
    if (Array.isArray(rawCompanyUsers)) return rawCompanyUsers;
    if (Array.isArray(rawCompanyUsers.items)) return rawCompanyUsers.items;
    return [];
  }, [rawCompanyUsers]);

  const dispatch = useDispatch();

  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const btnRef = useRef(null);

  const currentUserId = useMemo(() => {
    if (!currentUser) return null;
    return String(currentUser.userId || currentUser.id);
  }, [currentUser]);

  const userMap = useMemo(() => {
    const map = {};
    companyUsers.forEach((u) => {
      const key = String(u.userId || u.id);
      map[key] = u;
    });
    return map;
  }, [companyUsers]);

  // обогащаем комнаты: displayName + initials
  const decoratedRooms = useMemo(() => {
    if (!Array.isArray(rooms)) return [];

    return rooms.map((room) => {
      let displayName = "Чат";

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
            fullName || u.email || u.userId || "Пользователь";
        }
      } else {
        displayName = room.title || "Группа";
      }

      const avatarInitials = getInitials(displayName);

      return {
        ...room,
        displayName,
        avatarInitials,
      };
    });
  }, [rooms, userMap, currentUserId]);

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return decoratedRooms;

    return decoratedRooms.filter((room) => {
      const title = (room.displayName || "").toLowerCase();
      const preview = (room.lastMessagePreview || "").toLowerCase();
      return title.includes(q) || preview.includes(q);
    });
  }, [decoratedRooms, search]);

  const toggleMenu = () => setMenuOpen((v) => !v);
  const closeMenu = () => setMenuOpen(false);

  const handleCreateDirectClick = () => {
    closeMenu();
    onCreateDirect && onCreateDirect();
  };

  const handleCreateGroupClick = () => {
    closeMenu();
    onCreateGroup && onCreateGroup();
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
    <div className={s.sidebar}>
      {/* HEADER */}
      <div className={s.sidebarHeader}>
        <div className={s.sidebarTitle}>Чаты</div>

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
                <Users size={18} /> Создать группу
              </button>
              <button
                type="button"
                className={s.newChatItem}
                onClick={handleCreateDirectClick}
              >
                <MessageSquare size={18} /> Создать чат
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SEARCH */}
      <div className={s.headerSearchWrap}>
        <input
          type="text"
          className={s.searchInputHeader}
          placeholder="Поиск (⌘K)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ROOMS LIST */}
      <div className={s.roomsList}>
        {filteredRooms.length === 0 && (
          <div className={s.roomsEmpty}>Нет чатов</div>
        )}

        {filteredRooms.map((room) => {
          const idStr = String(room._id);
          const isActive = idStr === String(activeRoomId);

          return (
            <div
              key={idStr}
              className={isActive ? s.roomActive : s.room}
              onClick={() => dispatch(setActiveRoom(idStr))}
            >
              <div className={s.roomAvatar}>
                <span>{room.avatarInitials}</span>
              </div>

              <div className={s.roomText}>
                <div className={s.roomTitle}>{room.displayName}</div>
                <div className={s.roomPreview}>
                  {room.lastMessagePreview || "Нет сообщений"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}