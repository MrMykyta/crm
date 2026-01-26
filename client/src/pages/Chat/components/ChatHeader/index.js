import React from "react";
import { useSignedFileUrl } from "../../../../hooks/useSignedFileUrl";
import s from "../../ChatPage.module.css";

export default function ChatHeader({
  initials,
  avatar,
  title,
  subtitle,
  onBack,
  onToggleSearch,
  onTitleClick,
}) {
  const { url: avatarUrl, onError: onAvatarError } = useSignedFileUrl(avatar || "");

  return (
    <div className={s.chatHeader}>
      <button className={s.backBtn} type="button" onClick={onBack}>
        ←
      </button>

      <div
        className={`${s.chatHeaderMain} ${
          onTitleClick ? s.chatHeaderMainClickable : ""
        }`}
        onClick={onTitleClick}
        role={onTitleClick ? "button" : undefined}
        tabIndex={onTitleClick ? 0 : undefined}
        onKeyDown={(e) => {
          if (!onTitleClick) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onTitleClick();
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
          {subtitle ? <div className={s.chatSubtitle}>{subtitle}</div> : null}
        </div>
      </div>

      <div className={s.chatHeaderActions}>
        <button
          className={s.chatHeaderBtn}
          type="button"
          onClick={onToggleSearch}
        >
          🔍
        </button>
        <button className={s.chatHeaderBtn} type="button">
          ⋯
        </button>
      </div>
    </div>
  );
}
