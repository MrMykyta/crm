// src/pages/Chat/components/ChatHeader.jsx
// Chat header with avatar, title/subtitle. Actions removed per UI kit polish.
import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSignedFileUrl } from "../../../../hooks/useSignedFileUrl";
import s from "../../ChatPage.module.css";

export default function ChatHeader({
  initials,
  avatar,
  title,
  subtitle,
  isArchived = false,
  onBack,
  onTitleClick,
  isSearchMode = false,
  searchQuery = "",
  currentMatch = 0,
  totalMatches = 0,
  onSearchChange,
  onSearchOpen,
  onSearchClose,
  onSearchPrev,
  onSearchNext,
}) {
  const { t } = useTranslation();
  const { url: avatarUrl, onError: onAvatarError } = useSignedFileUrl(avatar || "");
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (isSearchMode && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, [isSearchMode]);

  return (
    <div className={s.chatHeader} data-ui="chat-header">
      <button className={s.backBtn} type="button" onClick={onBack}>
        ←
      </button>

      {isSearchMode ? (
        <div className={s.chatHeaderSearch}>
          <span className={s.chatHeaderSearchIcon}>🔍</span>
          <input
            ref={searchInputRef}
            className={s.chatHeaderSearchInput}
            placeholder={t("chat.search.placeholder")}
            value={searchQuery}
            onChange={onSearchChange}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (e.shiftKey) {
                onSearchPrev?.();
              } else {
                onSearchNext?.();
              }
            }}
          />
          <div className={s.chatHeaderSearchMeta}>
            <span className={s.chatHeaderSearchCounter}>
              {currentMatch}/{totalMatches}
            </span>
            <button
              type="button"
              className={s.chatHeaderSearchNavBtn}
              onClick={onSearchPrev}
              disabled={!totalMatches}
              aria-label={t("chat.search.prev", "Previous match")}
            >
              ↑
            </button>
            <button
              type="button"
              className={s.chatHeaderSearchNavBtn}
              onClick={onSearchNext}
              disabled={!totalMatches}
              aria-label={t("chat.search.next", "Next match")}
            >
              ↓
            </button>
            <button
              type="button"
              className={s.chatHeaderSearchClose}
              onClick={onSearchClose}
              aria-label={t("common.close")}
            >
              ✕
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`${s.chatHeaderMain} ${
            onTitleClick ? s.chatHeaderMainClickable : ""
          }`}
          onClick={(e) => {
            if (!onTitleClick) return;
            onTitleClick(e);
          }}
          role={onTitleClick ? "button" : undefined}
          tabIndex={onTitleClick ? 0 : undefined}
          onKeyDown={(e) => {
            if (!onTitleClick) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onTitleClick(e);
            }
          }}
        >
          <div className={s.chatAvatar}>
            {avatarUrl ? (
              <img src={avatarUrl} className={s.avatarImg} onError={onAvatarError} />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <div className={s.chatHeaderTexts}>
            <div className={s.chatTitle}>{title}</div>
            {(subtitle || isArchived) && (
              <div className={s.chatSubtitleRow}>
                {subtitle ? (
                  <div className={s.chatSubtitle}>{subtitle}</div>
                ) : null}
                {isArchived && (
                  <span className={s.chatArchivedBadge}>
                    {t("chat.header.archived")}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {!isSearchMode && (
        <button
          type="button"
          className={s.chatHeaderSearchBtn}
          onClick={onSearchOpen}
          aria-label={t("chat.search.placeholder")}
        >
          🔍
        </button>
      )}
    </div>
  );
}
