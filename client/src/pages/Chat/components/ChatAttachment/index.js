// src/pages/Chat/components/ChatAttachment.jsx
// Attachment renderer for chat messages and composer: handles audio, files, and previews.
import React, { useMemo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSignedFileUrl } from "../../../../hooks/useSignedFileUrl";
import { useLazyGetSignedDownloadUrlQuery } from "../../../../store/rtk/filesApi";
import AudioMessagePlayer from "../../../../components/chat/AudioMessagePlayer";
import s from "../../ChatPage.module.css";

const PREVIEW_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "video/mp4",
  "video/webm",
];

// Office document mime types for file-card preview.
const OFFICE_MIME = new Set([
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

// Zip mime types to force download-only behavior.
const ZIP_MIME = new Set(["application/zip"]);

const prettySize = (size) => {
  const n = Number(size || 0);
  if (!n || n <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let idx = 0;
  let val = n;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx += 1;
  }
  return `${val.toFixed(val >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
};

const normalizeUrl = (u) => {
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  const base =
    (process.env.REACT_APP_API_URL || "http://localhost:5001").replace(/\/+$/, "");
  if (u.startsWith("/")) return `${base}${u}`;
  return u;
};

// Extract file extension from filename for fallback checks.
const getExtension = (name) => {
  if (!name || typeof name !== "string") return "";
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
};

// Build Google Docs viewer URL for office previews.
const buildDocsViewerUrl = (url) =>
  `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`;

export default function ChatAttachment({
  attachment,
  mode = "message", // 'message' | 'composer'
  onRemove,
  forceFileCard = false,
  onOpenMedia,
  documentItems = [],
  documentIndex = 0,
}) {
  const { t } = useTranslation();
  const [docPreviewUrl, setDocPreviewUrl] = useState("");
  const [docPreviewError, setDocPreviewError] = useState(false);
  const fileId = attachment?.fileId || attachment?.id || null;
  const filename = attachment?.filename || attachment?.name || t("chat.attach.file");
  const mime = attachment?.mime || attachment?.mimeType || "";
  const size = attachment?.size || 0;
  const directUrl = attachment?.url || "";

  const ext = getExtension(filename);
  // Determine office document subtype for labels and preview.
  const isDoc =
    (OFFICE_MIME.has(mime) &&
      (mime.includes("word") || mime === "application/msword")) ||
    ["doc", "docx"].includes(ext);
  const isXls =
    (OFFICE_MIME.has(mime) &&
      (mime.includes("excel") || mime === "application/vnd.ms-excel")) ||
    ["xls", "xlsx"].includes(ext);
  const isPpt =
    (OFFICE_MIME.has(mime) &&
      (mime.includes("powerpoint") ||
        mime === "application/vnd.ms-powerpoint" ||
        mime.includes("presentation"))) ||
    ["ppt", "pptx"].includes(ext);
  // Flag for any office document.
  const isOfficeDoc = isDoc || isXls || isPpt;
  const isZip = ZIP_MIME.has(mime) || ext === "zip";
  const isPreviewable = PREVIEW_MIME.includes(mime);
  const isImage = mime.startsWith("image/");
  const isPdf = mime === "application/pdf";
  const isAudio = mime.startsWith("audio/");
  const isVideo = mime.startsWith("video/");

  const isDocument = isPdf || isOfficeDoc;
  const shouldPreview =
    !forceFileCard && isPreviewable && !isAudio && !isOfficeDoc && !isZip;
  const needsInlineUrl = Boolean(
    fileId && (shouldPreview || isPdf)
  );
  const previewSource = needsInlineUrl ? fileId || directUrl || "" : "";
  const { url: previewUrl, onError } = useSignedFileUrl(previewSource);
  const [getSignedDownload] = useLazyGetSignedDownloadUrlQuery();
  const sizeText = useMemo(() => prettySize(size), [size]);
  // Label used in the file badge for non-media items.
  const fileTypeLabel = isPdf
    ? "PDF"
    : isDoc
    ? ext === "doc"
      ? "DOC"
      : "DOCX"
    : isXls
    ? ext === "xls"
      ? "XLS"
      : "XLSX"
    : isPpt
    ? ext === "ppt"
      ? "PPT"
      : "PPTX"
    : isZip
    ? "ZIP"
    : "FILE";

  useEffect(() => {
    let isActive = true;
    if (!isOfficeDoc) {
      setDocPreviewUrl("");
      setDocPreviewError(false);
      return () => {
        isActive = false;
      };
    }

    const buildPreview = async () => {
      try {
        let url = directUrl ? normalizeUrl(directUrl) : "";
        if (!url && fileId) {
          const res = await getSignedDownload(fileId).unwrap();
          url = normalizeUrl(res?.data?.url || res?.url || "");
        }
        const viewerUrl = url ? buildDocsViewerUrl(url) : "";
        if (isActive) {
          setDocPreviewUrl(viewerUrl);
          setDocPreviewError(!viewerUrl);
        }
      } catch {
        if (isActive) {
          setDocPreviewError(true);
        }
      }
    };

    buildPreview();
    return () => {
      isActive = false;
    };
  }, [isOfficeDoc, directUrl, fileId, getSignedDownload]);

  if (isAudio && mode === "message") {
    return <AudioMessagePlayer fileId={fileId} filename={filename} />;
  }

  // Open office document via Google Docs Viewer (no auto-download).
  const handleOpenDocument = async () => {
    try {
      let url = directUrl ? normalizeUrl(directUrl) : "";
      if (fileId) {
        const res = await getSignedDownload(fileId).unwrap();
        url = normalizeUrl(res?.data?.url || res?.url || "");
      }
      const viewerUrl = url ? buildDocsViewerUrl(url) : "";
      if (viewerUrl) window.open(viewerUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      if (typeof window !== "undefined") {
        window.alert(t("chat.attach.downloadFailed"));
      }
    }
  };

  const handleDownload = async () => {
    try {
      if (fileId) {
        const res = await getSignedDownload(fileId).unwrap();
        const url = normalizeUrl(res?.data?.url || res?.url || "");
        if (url) window.open(url, "_blank");
        return;
      }
      if (directUrl) {
        window.open(directUrl, "_blank");
      }
    } catch (e) {
      if (typeof window !== "undefined") {
        window.alert(t("chat.attach.downloadFailed"));
      }
    }
  };

  const handleOpenPreview = () => {
    if (onOpenMedia && documentItems.length) {
      const safeIndex =
        typeof documentIndex === "number" ? documentIndex : 0;
      onOpenMedia(documentItems, safeIndex);
      return;
    }
    if (isPdf) {
      const urlToOpen =
        previewPdfUrl || (directUrl ? normalizeUrl(directUrl) : "");
      if (urlToOpen) window.open(urlToOpen, "_blank", "noopener,noreferrer");
      return;
    }
    if (isOfficeDoc) {
      handleOpenDocument();
    }
  };

  const previewPdfUrl = previewUrl || (directUrl ? normalizeUrl(directUrl) : "");
  const showDocPreview = mode === "message" && isDocument && !isZip;
  const hasPreview = !!(shouldPreview && previewUrl);
  const cardClassName = [
    s.attachmentCard,
    hasPreview || showDocPreview
      ? s.attachmentCardMedia
      : s.attachmentCardFile,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cardClassName}>
      {showDocPreview ? (
        <>
          <div className={s.attachmentDocHeader}>
            <div className={s.attachmentDocIcon}>
              <span className={s.attachmentFileBadge}>{fileTypeLabel}</span>
            </div>
            <div className={s.attachmentMeta}>
              <div className={s.attachmentName}>{filename}</div>
              <div className={s.attachmentSub}>
                {mime ? mime : t("chat.attach.fileType")}
                {sizeText ? ` · ${sizeText}` : ""}
              </div>
            </div>
            <div className={s.attachmentActions}>
              <button
                type="button"
                className={s.attachmentBtn}
                onClick={handleOpenPreview}
              >
                {t("chat.attach.open", "Open")}
              </button>
              <button
                type="button"
                className={s.attachmentBtn}
                onClick={handleDownload}
              >
                {t("chat.attach.download")}
              </button>
            </div>
          </div>

          <div
            className={s.attachmentDocPreview}
            role="button"
            tabIndex={0}
            onClick={handleOpenPreview}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleOpenPreview();
            }}
          >
            {isPdf && previewPdfUrl ? (
              <iframe
                title={filename}
                src={previewPdfUrl}
                className={s.attachmentDocFrame}
                loading="lazy"
              />
            ) : isOfficeDoc && docPreviewUrl && !docPreviewError ? (
              <iframe
                title={filename}
                src={docPreviewUrl}
                className={s.attachmentDocFrame}
                loading="lazy"
              />
            ) : (
              <div className={s.attachmentDocFallback}>
                {t("chat.attach.previewUnavailable", "Preview unavailable")}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {isPreviewable && previewUrl ? (
            <div className={s.attachmentPreview}>
              {isImage && (
                <img
                  src={previewUrl}
                  alt={filename}
                  className={s.attachmentImg}
                  onError={onError}
                />
              )}
              {isPdf && (
                <iframe
                  title={filename}
                  src={previewUrl}
                  className={s.attachmentPdf}
                  loading="lazy"
                />
              )}
              {isAudio && (
                <audio controls src={previewUrl} className={s.attachmentAudio} />
              )}
              {isVideo && (
                <video controls src={previewUrl} className={s.attachmentVideo} />
              )}
            </div>
          ) : (
            <div className={s.attachmentFileIcon}>
              <span className={s.attachmentFileBadge}>{fileTypeLabel}</span>
            </div>
          )}

          <div className={s.attachmentMeta}>
            <div className={s.attachmentName}>{filename}</div>
            <div className={s.attachmentSub}>
              {mime ? mime : t("chat.attach.fileType")}
              {sizeText ? ` · ${sizeText}` : ""}
            </div>
          </div>

          <div className={s.attachmentActions}>
            {mode === "message" && (
              <>
                {isOfficeDoc || isPdf ? (
                  <button
                    type="button"
                    className={s.attachmentBtn}
                    onClick={handleOpenPreview}
                  >
                    {t("chat.attach.open", "Open")}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={s.attachmentBtn}
                  onClick={handleDownload}
                >
                  {t("chat.attach.download")}
                </button>
              </>
            )}
            {mode === "composer" && (
              <button
                type="button"
                className={s.attachmentBtnDanger}
                onClick={() => onRemove && onRemove()}
              >
                {t("chat.attach.remove")}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
