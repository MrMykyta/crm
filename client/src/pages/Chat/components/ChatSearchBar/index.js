// src/pages/Chat/components/ChatSearchBar.jsx
// Search bar for message search with navigation between matches.
import React from "react";
import { useTranslation } from "react-i18next";
import s from "../../ChatPage.module.css";

export default function ChatSearchBar({
  open,
  query,
  currentMatch,
  totalMatches,
  onChange,
  onPrev,
  onNext,
  onClose,
}) {
  const { t } = useTranslation();
  if (!open) return null;

  const showCounter = query.trim();

  return (
    <div className={s.chatSearchBar}>
      <input
        className={s.chatSearchInput}
        type="text"
        placeholder={t("chat.search.placeholder")}
        value={query}
        onChange={onChange}
      />

      <div className={s.chatSearchCounter}>
        {showCounter ? `${currentMatch}/${totalMatches || 0}` : ""}
      </div>

      <button
        type="button"
        className={s.chatSearchNavBtn}
        onClick={onPrev}
        disabled={!totalMatches}
      >
        ◀
      </button>

      <button
        type="button"
        className={s.chatSearchNavBtn}
        onClick={onNext}
        disabled={!totalMatches}
      >
        ▶
      </button>

      <button
        type="button"
        className={s.chatSearchCloseBtn}
        onClick={onClose}
      >
        ✕
      </button>
    </div>
  );
}
