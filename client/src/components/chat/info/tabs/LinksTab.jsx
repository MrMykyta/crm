// components/chat/info/tabs/LinksTab.jsx
// Links list extracted from message text.
import React from "react";
import s from "../ChatInfoPanel.module.css";

export default function LinksTab({
  items = [],
  emptyText,
  openLabel,
  loadMoreLabel,
  hasMore,
  isLoading,
  onLoadMore,
}) {
  return (
    <div>
      {!items.length ? (
        <div className={s.infoEmpty}>{emptyText}</div>
      ) : (
        <div className={s.infoLinksList}>
          {items.map((l) => (
            <div key={l.url} className={s.infoLinkRow}>
              <div className={s.infoLinkUrl}>{l.url}</div>
              <a href={l.url} target="_blank" rel="noreferrer">
                {openLabel}
              </a>
            </div>
          ))}
        </div>
      )}

      {hasMore && onLoadMore && (
        <button
          type="button"
          className={s.infoLoadMore}
          disabled={isLoading}
          onClick={onLoadMore}
        >
          {isLoading ? "…" : loadMoreLabel}
        </button>
      )}
    </div>
  );
}
