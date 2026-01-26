import React, { useMemo } from "react";
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

export default function ChatAttachment({
  attachment,
  mode = "message", // 'message' | 'composer'
  onRemove,
}) {
  const { t } = useTranslation();
  const fileId = attachment?.fileId || attachment?.id || null;
  const filename = attachment?.filename || attachment?.name || "Файл";
  const mime = attachment?.mime || attachment?.mimeType || "";
  const size = attachment?.size || 0;
  const directUrl = attachment?.url || "";

  const isPreviewable = PREVIEW_MIME.includes(mime);
  const isImage = mime.startsWith("image/");
  const isPdf = mime === "application/pdf";
  const isAudio = mime.startsWith("audio/");
  const isVideo = mime.startsWith("video/");

  const shouldPreview = isPreviewable && !isAudio;
  const previewSource = shouldPreview ? fileId || directUrl || "" : "";
  const { url: previewUrl, onError } = useSignedFileUrl(
    shouldPreview ? previewSource : ""
  );

  const [getSignedDownload] = useLazyGetSignedDownloadUrlQuery();
  const sizeText = useMemo(() => prettySize(size), [size]);

  if (isAudio && mode === "message") {
    return <AudioMessagePlayer fileId={fileId} filename={filename} />;
  }

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
        window.alert("Не удалось получить ссылку для скачивания");
      }
    }
  };

  return (
    <div className={s.attachmentCard}>
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
        <div className={s.attachmentFileIcon}>📄</div>
      )}

      <div className={s.attachmentMeta}>
        <div className={s.attachmentName}>{filename}</div>
        <div className={s.attachmentSub}>
          {mime ? mime : "file"}
          {sizeText ? ` · ${sizeText}` : ""}
        </div>
      </div>

      <div className={s.attachmentActions}>
        {mode === "message" && (
          <button
            type="button"
            className={s.attachmentBtn}
            onClick={handleDownload}
          >
            {t("chat.attach.download")}
          </button>
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
    </div>
  );
}
