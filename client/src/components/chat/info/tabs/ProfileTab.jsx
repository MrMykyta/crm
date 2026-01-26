// components/chat/info/tabs/ProfileTab.jsx
// Direct chat profile view (avatar, name, basic metadata).
import React from "react";
import s from "../ChatInfoPanel.module.css";

export default function ProfileTab({ profile, emptyText }) {
  if (!profile) {
    return <div className={s.infoEmpty}>{emptyText}</div>;
  }

  return (
    <div className={s.infoList}>
      <div className={s.infoRow}>
        <div className={s.infoAvatar}>
          {profile.avatar ? (
            <img src={profile.avatar} alt="" />
          ) : (
            <span>{profile.initials || "U"}</span>
          )}
        </div>
        <div className={s.infoRowTexts}>
          <div className={s.infoRowTitle}>{profile.name || "—"}</div>
          <div className={s.infoRowSub}>
            {[profile.email, profile.department, profile.role]
              .filter(Boolean)
              .join(" · ") || "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
