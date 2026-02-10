// components/chat/info/tabs/ParticipantsTab.jsx
// Participants list with local search and signed avatars.
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSignedFileUrl } from "../../../../hooks/useSignedFileUrl";
import s from "../ChatInfoPanel.module.css";

/**
 * Single participant row.
 * @param {Object} props
 */
function ParticipantRow({ item }) {
  const { t } = useTranslation();
  const fallback = t("common.none");
  const { url, onError } = useSignedFileUrl(item?.avatarUrl || "");
  return (
    <div className={s.infoRow}>
      <div className={s.infoAvatar}>
        {url ? (
          <img src={url} alt="" onError={onError} />
        ) : (
          <span>{item?.initials || "U"}</span>
        )}
      </div>
      <div className={s.infoRowTexts}>
        <div className={s.infoRowTitle}>{item?.name || fallback}</div>
        <div className={s.infoRowSub}>
          {[item?.email, item?.department, item?.role]
            .filter(Boolean)
            .join(" · ") || fallback}
        </div>
      </div>
    </div>
  );
}

export default function ParticipantsTab({
  participants = [],
  emptyText,
  searchPlaceholder,
}) {
  // Search query for local filtering.
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter((p) => {
      const hay = [p?.name, p?.email, p?.department, p?.role]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [participants, query]);

  return (
    <div className={s.infoList}>
      <input
        className={s.infoSearchInput}
        placeholder={searchPlaceholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filtered.length ? (
        filtered.map((p) => <ParticipantRow key={p.userId} item={p} />)
      ) : (
        <div className={s.infoEmpty}>{emptyText}</div>
      )}
    </div>
  );
}
