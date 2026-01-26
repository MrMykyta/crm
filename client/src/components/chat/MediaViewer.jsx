// components/chat/MediaViewer.jsx
// Fullscreen media viewer for images/videos opened from Info Panel.
// Uses signed inline URLs and does not auto-download files.
import React, { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSignedFileUrl } from "../../hooks/useSignedFileUrl";
import { useLazyGetSignedDownloadUrlQuery } from "../../store/rtk/filesApi";
import s from "./MediaViewer.module.css";

/**
 * Normalize API-relative URL to absolute (works for same-origin and proxied APIs).
 * @param {string} u
 * @returns {string}
 */
const normalizeUrl = (u) => {
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  const base =
    (process.env.REACT_APP_API_URL || "http://localhost:5001").replace(/\/+$/, "");
  if (u.startsWith("/")) return `${base}${u}`;
  return u;
};

/**
 * Media viewer overlay.
 * @param {Object} props
 * @param {Array} props.items - Array of media items { fileId, mime, filename }.
 * @param {number} props.activeIndex - Current index in items.
 * @param {Function} props.onChangeIndex - Update active index.
 * @param {Function} props.onClose - Close viewer.
 */
export default function MediaViewer({
  items = [],
  activeIndex = 0,
  onChangeIndex,
  onClose,
}) {
  const { t } = useTranslation();

  // Active media item based on index.
  const activeItem = items[activeIndex] || null;

  // Signed URL for the active item only (prevents mass requests).
  const { url: mediaUrl, onError } = useSignedFileUrl(
    activeItem?.fileId || ""
  );

  // Lazy signed download (only on explicit user action).
  const [getSignedDownload] = useLazyGetSignedDownloadUrlQuery();

  const isVideo = Boolean(activeItem?.mime?.startsWith("video/"));

  const canNavigate = items.length > 1;

  /** Navigate to previous media item. */
  const goPrev = useCallback(() => {
    if (!canNavigate) return;
    const next = activeIndex <= 0 ? items.length - 1 : activeIndex - 1;
    onChangeIndex && onChangeIndex(next);
  }, [activeIndex, canNavigate, items.length, onChangeIndex]);

  /** Navigate to next media item. */
  const goNext = useCallback(() => {
    if (!canNavigate) return;
    const next = activeIndex >= items.length - 1 ? 0 : activeIndex + 1;
    onChangeIndex && onChangeIndex(next);
  }, [activeIndex, canNavigate, items.length, onChangeIndex]);

  /**
   * Close on overlay click or ESC.
   * Uses capture to prevent global ESC handlers from closing chat.
   */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose && onClose();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [goNext, goPrev, onClose]);

  /**
   * Optional download action (no auto-download).
   */
  const handleDownload = useCallback(async () => {
    if (!activeItem?.fileId) return;
    try {
      const res = await getSignedDownload(activeItem.fileId).unwrap();
      const url = normalizeUrl(res?.data?.url || res?.url || "");
      if (url) window.open(url, "_blank");
    } catch {
      // minimal feedback, no hard failure
      if (typeof window !== "undefined") {
        window.alert(t("common.error"));
      }
    }
  }, [activeItem?.fileId, getSignedDownload, t]);

  if (!activeItem) return null;

  return (
    <div className={s.viewerLayer} onClick={onClose}>
      <div className={s.viewerPanel} onClick={(e) => e.stopPropagation()}>
        <div className={s.viewerHeader}>
          <button type="button" className={s.viewerBtn} onClick={onClose}>
            ✕
          </button>
          <div className={s.viewerTitle}>
            {activeItem.filename || t("chat.info.media.open")}
          </div>
          <button type="button" className={s.viewerBtn} onClick={handleDownload}>
            {t("chat.info.documents.download")}
          </button>
        </div>

        <div className={s.viewerBody}>
          {mediaUrl ? (
            isVideo ? (
              <video
                className={s.viewerMedia}
                src={mediaUrl}
                controls
                onError={onError}
              />
            ) : (
              <img
                className={s.viewerMedia}
                src={mediaUrl}
                alt=""
                onError={onError}
              />
            )
          ) : (
            <div className={s.viewerPlaceholder}>…</div>
          )}

          {canNavigate && (
            <>
              <button
                type="button"
                className={`${s.viewerNav} ${s.viewerNavLeft}`}
                onClick={goPrev}
              >
                ←
              </button>
              <button
                type="button"
                className={`${s.viewerNav} ${s.viewerNavRight}`}
                onClick={goNext}
              >
                →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
