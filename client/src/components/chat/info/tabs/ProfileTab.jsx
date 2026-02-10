// components/chat/info/tabs/ProfileTab.jsx
// Direct chat profile view (avatar, name, basic metadata).
import React from "react";
import { useTranslation } from "react-i18next";
import { useSignedFileUrl } from "../../../../hooks/useSignedFileUrl";
import s from "../ChatInfoPanel.module.css";

export default function ProfileTab({ profile, emptyText }) {
  const { t } = useTranslation();
  const fallback = t("common.none");
  const { url, onError } = useSignedFileUrl(profile?.avatar || "");

  if (!profile) {
    return <div className={s.infoEmpty}>{emptyText}</div>;
  }

  return (
    <div className={s.infoList}>
      <div className={s.infoRow}>
        <div className={s.infoAvatar}>
          {url ? (
            <img src={url} alt="" onError={onError} />
          ) : (
            <span>{profile.initials || "U"}</span>
          )}
        </div>
        <div className={s.infoRowTexts}>
          <div className={s.infoRowTitle}>{profile.name || fallback}</div>
          <div className={s.infoRowSub}>
            {[profile.email, profile.department, profile.role]
              .filter(Boolean)
              .join(" · ") || fallback}
          </div>
        </div>
      </div>
    </div>
  );
}
