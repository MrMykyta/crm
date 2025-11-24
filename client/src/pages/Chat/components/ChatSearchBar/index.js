import React from "react";
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
  if (!open) return null;

  const showCounter = query.trim();

  return (
    <div className={s.chatSearchBar}>
      <input
        className={s.chatSearchInput}
        type="text"
        placeholder="Поиск по сообщениям…"
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