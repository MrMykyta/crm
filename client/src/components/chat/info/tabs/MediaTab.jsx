// components/chat/info/tabs/MediaTab.jsx
// Media grid for Info Panel, opens MediaViewer on item click.
import React from "react";
import { useSignedFileUrl } from "../../../../hooks/useSignedFileUrl";
import s from "../ChatInfoPanel.module.css";

/**
 * Small media thumbnail tile.
 * @param {Object} props
 */
function MediaThumb({ item, shouldLoad, onOpen }) {
  const isVideo = item?.mime?.startsWith("video/");
  // Signed URL for the preview tile (only when shouldLoad=true).
  const { url, onError } = useSignedFileUrl(shouldLoad ? item?.fileId : "");

  return (
    <button
      type="button"
      className={s.infoMediaItem}
      onClick={onOpen}
      aria-label={item?.filename || "media"}
    >
      {url ? (
        isVideo ? (
          <video src={url} muted playsInline />
        ) : (
          <img src={url} alt={item?.filename || "media"} onError={onError} />
        )
      ) : (
        <div className={s.infoMediaPlaceholder}>…</div>
      )}
    </button>
  );
}

export default function MediaTab({
  items = [],
  maxPreview = 30,
  emptyText,
  loadMoreLabel,
  hasMore,
  isLoading,
  onLoadMore,
  onOpen,
}) {
  return (
    <div>
      {!items.length ? (
        <div className={s.infoEmpty}>{emptyText}</div>
      ) : (
        <div className={s.infoMediaGrid}>
          {items.map((item, idx) => (
            <MediaThumb
              key={`${item.fileId}-${idx}`}
              item={item}
              shouldLoad={idx < maxPreview}
              onOpen={() => onOpen && onOpen(idx)}
            />
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
