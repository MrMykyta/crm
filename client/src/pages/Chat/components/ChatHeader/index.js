import React from "react";
import s from "../../ChatPage.module.css";

export default function ChatHeader({
  initials,
  avatar,
  title,
  subtitle,
  onBack,
  onToggleSearch,
}) {
  return (
    <div className={s.chatHeader}>
      <button className={s.backBtn} type="button" onClick={onBack}>
        ←
      </button>

      <div className={s.chatHeaderMain}>
        <div className={s.chatAvatar}>
          {avatar ? <img src={avatar} className={s.avatarImg}/> : <span>{initials}</span>}
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