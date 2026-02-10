// components/chat/MediaViewer.jsx
// Fullscreen media viewer for images/videos opened from Info Panel.
// Uses signed inline URLs and does not auto-download files.
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  inChat = false,
}) {
  const { t } = useTranslation();

  // Active media item based on index.
  const activeItem = items[activeIndex] || null;

  const fileExt = useMemo(() => {
    const name = activeItem?.filename || "";
    const parts = name.split(".");
    return parts.length > 1 ? parts.pop().toLowerCase() : "";
  }, [activeItem?.filename]);

  const isVideo = Boolean(activeItem?.mime?.startsWith("video/"));
  const isPdf =
    activeItem?.mime === "application/pdf" || fileExt === "pdf";
  const isOffice =
    ["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(fileExt) ||
    [
      "application/msword",
      "application/vnd.ms-excel",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ].includes(activeItem?.mime || "");

  const shouldFetchInline = Boolean(activeItem?.fileId) && !isOffice;
  // Signed inline URL for the active item only (prevents mass requests).
  const { url: mediaUrl, onError } = useSignedFileUrl(
    shouldFetchInline ? activeItem?.fileId || "" : ""
  );

  // Lazy signed download (only on explicit user action).
  const [getSignedDownload] = useLazyGetSignedDownloadUrlQuery();

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

  const [docViewerUrl, setDocViewerUrl] = useState("");

  useEffect(() => {
    let isActive = true;
    if (!isOffice || !activeItem) {
      setDocViewerUrl("");
      return () => {
        isActive = false;
      };
    }

    const build = async () => {
      try {
        let url = activeItem?.url ? normalizeUrl(activeItem.url) : "";
        if (!url && activeItem?.fileId) {
          const res = await getSignedDownload(activeItem.fileId).unwrap();
          url = normalizeUrl(res?.data?.url || res?.url || "");
        }
        const viewer = url
          ? `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(
              url
            )}`
          : "";
        if (isActive) setDocViewerUrl(viewer);
      } catch {
        if (isActive) setDocViewerUrl("");
      }
    };

    build();
    return () => {
      isActive = false;
    };
  }, [activeItem, getSignedDownload, isOffice]);

  if (!activeItem) return null;

  return (
    <div
      className={`${s.viewerLayer} ${inChat ? s.viewerLayerInChat : ""}`}
      onClick={onClose}
    >
      <div
        className={`${s.viewerPanel} ${inChat ? s.viewerPanelInChat : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={s.viewerClose}
          onClick={onClose}
          aria-label={t("common.close")}
        >
          ✕
        </button>

        <div className={s.viewerBody}>
          {isPdf ? (
            <iframe
              className={s.viewerDocFrame}
              title={activeItem?.filename || "document"}
              src={mediaUrl || normalizeUrl(activeItem?.url || "")}
            />
          ) : isOffice ? (
            docViewerUrl ? (
              <iframe
                className={s.viewerDocFrame}
                title={activeItem?.filename || "document"}
                src={docViewerUrl}
              />
            ) : (
              <div className={s.viewerPlaceholder}>
                {t("chat.attach.previewUnavailable", "Preview unavailable")}
              </div>
            )
          ) : mediaUrl ? (
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
            <div className={s.viewerPlaceholder}>{t("common.loading")}</div>
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
