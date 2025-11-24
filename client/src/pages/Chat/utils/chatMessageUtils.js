// src/pages/Chat/utils/chatMessageUtils.js
import React from "react";

// детерминированный цвет по userId
export const getUserColor = (userId) => {
  if (!userId) return undefined;

  let hash = 0;
  const str = String(userId);
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }

  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 65%)`;
};

// helpers для автора / аватарки
export const getAuthorInfo = (m, companyUsers = []) => {
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
  const avatar = user?.avatarUrl || "";
  const color = getUserColor(authorId);

  return {
    authorId,
    name,
    avatar,
    initials,
    color,
  };
};

// расчёт статуса сообщений (sent / readSome / readAll)
export const getMessageStatus = (m, room, meId, participantsFromProps) => {
  if (!room || !meId) return "sent";

  const participants = participantsFromProps || room.participants || [];

  const others = participants.filter((p) => String(p.userId) !== meId);

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

// подсветка совпадений в тексте
export const renderHighlightedText = (text, query, highlightClass) => {
  if (!query) return text;
  const q = query.toLowerCase();
  const lower = (text || "").toLowerCase();

  let start = 0;
  let index;
  const parts = [];
  let key = 0;

  while ((index = lower.indexOf(q, start)) !== -1) {
    if (index > start) {
      parts.push(text.slice(start, index));
    }
    parts.push(
      <span key={`h-${key++}`} className={highlightClass}>
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