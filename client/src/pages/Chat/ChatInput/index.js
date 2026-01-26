// src/pages/Chat/ChatWindow/ChatInput.jsx
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSignedFileUrl } from "../../../hooks/useSignedFileUrl";
import s from "../ChatPage.module.css";

const getExtLabel = (filename = "", mime = "") => {
  const name = String(filename || "");
  const parts = name.split(".");
  const ext = parts.length > 1 ? parts.pop() : "";
  if (ext) return ext.toUpperCase();
  if (mime && mime.includes("/")) {
    return mime.split("/")[1].toUpperCase();
  }
  return "";
};

const MAX_PREVIEW = 6;

const ComposerAttachmentItem = ({ draft, onRemove, onRetry }) => {
  const { t } = useTranslation();
  const isDone = draft.status === "done";
  const isUploading = draft.status === "uploading";
  const isError = draft.status === "error";

  const mime = draft.mime || "";
  const isImage = mime.startsWith("image/");
  const isVideo = mime.startsWith("video/");
  const isAudio = mime.startsWith("audio/");

  const needsPreview = isDone && (isImage || isVideo);
  const { url } = useSignedFileUrl(needsPreview ? draft.fileId : null);

  return (
    <div className={s.composerAttachmentItem}>
      <div className={s.composerAttachmentThumb}>
        {isDone && isImage && url && (
          <img src={url} alt={draft.filename || ""} />
        )}
        {isDone && isVideo && url && (
          <video src={url} preload="metadata" muted />
        )}
        {isDone && !isImage && !isVideo && (
          <div className={s.composerAttachmentIcon}>
            {isAudio
              ? "🎧"
              : getExtLabel(draft.filename, mime) || "📄"}
          </div>
        )}

        {isVideo && isDone && (
          <div className={s.composerAttachmentPlay}>▶</div>
        )}

        {isUploading && (
          <div className={s.composerAttachmentOverlay}>
            {t("chat.attach.uploading")}
          </div>
        )}

        {isError && (
          <div className={s.composerAttachmentOverlayError}>
            {draft.error || t("chat.attach.sendFailed")}
          </div>
        )}
      </div>

      <button
        type="button"
        className={s.composerAttachmentRemove}
        onClick={() => onRemove && onRemove(draft.localId)}
      >
        ✕
      </button>

      {isError && (
        <div className={s.composerAttachmentActions}>
          <button
            type="button"
            className={s.attachmentBtn}
            onClick={() => onRetry && onRetry(draft.localId)}
          >
            {t("chat.attach.retry")}
          </button>
          <button
            type="button"
            className={s.attachmentBtnDanger}
            onClick={() => onRemove && onRemove(draft.localId)}
          >
            {t("chat.attach.remove")}
          </button>
        </div>
      )}
    </div>
  );
};

export default function ChatInput({
  text,
  onChangeText,
  onKeyDown,
  onSend,
  isBusy = false,
  canSend = true,
  onHeightChange, // delta px: >0 выросло, <0 сжалось

  // контекст: reply / forward
  replyTo,        // { type, id, authorName, text } | null
  onCancelReply,  // () => void
  // контекст: edit
  editTarget,     // { authorName, originalText } | null
  onCancelEdit,   // () => void
  // attachments
  attachments = [],
  onFilesSelected,
  onRemoveAttachment,
  onRetryAttachment,
  isUploading = false,
  disableAttachments = false,
  sendError = false,
  onRetrySend,
}) {
  const { t } = useTranslation();
  const textareaRef = useRef(null);
  const prevTextHeightRef = useRef(0);
  const baseHeightRef = useRef(0); // высота одной строки
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleSendClick = () => {
    if (isBusy || !canSend) return;
    onSend && onSend();
  };

  const autoResize = (silent = false) => {
    const el = textareaRef.current;
    if (!el) return;

    const prevH = prevTextHeightRef.current || el.offsetHeight || 0;

    el.style.height = "0px";

    const vh = typeof window !== "undefined" ? window.innerHeight : 0;
    const maxH = vh ? vh * 0.35 : 280;
    const rawScrollH = el.scrollHeight;
    const nextH = Math.min(rawScrollH, maxH);

    if (!baseHeightRef.current) {
      baseHeightRef.current = nextH;
    }

    el.style.height = `${nextH}px`;
    el.style.overflowY = rawScrollH > maxH ? "auto" : "hidden";

    const base = baseHeightRef.current || 0;
    const prevAboveBase = prevH > base + 1;
    const nextAboveBase = nextH > base + 1;

    prevTextHeightRef.current = nextH;

    if (silent || !onHeightChange) return;
    if (prevAboveBase && !nextAboveBase) return;

    const delta = nextH - prevH;
    if (delta !== 0) {
      onHeightChange(delta);
    }
  };

  const handleChange = (e) => {
    onChangeText && onChangeText(e);
    // высоту пересчитает useEffect по text
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape" && editTarget) {
      e.preventDefault();
      e.stopPropagation();
      onCancelEdit && onCancelEdit();
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
      return;
    }
    onKeyDown && onKeyDown(e);
  };

  const handleAttachClick = () => {
    if (disableAttachments || isBusy) return;
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFiles = (files) => {
    if (!files || !files.length) return;
    if (disableAttachments || isBusy) return;
    onFilesSelected && onFilesSelected(files);
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
    e.target.value = "";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (disableAttachments || isBusy) return;
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (disableAttachments || isBusy) return;
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    handleFiles(files);
  };

  useEffect(() => {
    autoResize(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    autoResize(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const isForward = replyTo?.type === "forward";

  const headerTitle = isForward
    ? replyTo?.authorName
      ? `Переслать от ${replyTo.authorName}`
      : "Переслать сообщение"
    : replyTo?.authorName
    ? `В ответ ${replyTo.authorName}`
    : "Ответ на сообщение";

  const iconSymbol = isForward ? "↪︎" : "↩︎";

  const showEdit = !!editTarget;
  const showReply = !showEdit && !!replyTo;

  const editSnippetRaw = (editTarget?.originalText || "").trim();
  const editSnippet =
    editSnippetRaw.length > 80
      ? `${editSnippetRaw.slice(0, 80)}…`
      : editSnippetRaw;

  const visibleAttachments = attachments.slice(0, MAX_PREVIEW);
  const hiddenCount =
    attachments.length > MAX_PREVIEW
      ? attachments.length - MAX_PREVIEW
      : 0;

  return (
    <div
      className={[s.input, isDragging ? s.inputDragging : ""]
        .filter(Boolean)
        .join(" ")}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* слева иконка вложений */}
      <button
        type="button"
        className={s.inputIconBtn}
        onClick={handleAttachClick}
        disabled={disableAttachments || isBusy}
      >
        📎
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className={s.inputFile}
        tabIndex={-1}
      />

      {/* правая часть: баннер + инпут в колонку */}
      <div className={s.inputMain}>
        {showEdit && (
          <div className={s.replyWrap}>
            <div className={s.replyLeft}>
              <div className={s.replyIcon}>✎</div>
              <div className={s.replyTexts}>
                <div className={s.replyTitle}>Редактирование</div>
                {editSnippet && (
                  <div className={s.replyText}>{editSnippet}</div>
                )}
              </div>
            </div>

            <button
              type="button"
              className={s.replyCloseBtn}
              onClick={onCancelEdit}
            >
              ✕
            </button>
          </div>
        )}

        {showReply && (
          <div className={s.replyWrap}>
            <div className={s.replyLeft}>
              <div className={s.replyIcon}>{iconSymbol}</div>
              <div className={s.replyTexts}>
                <div className={s.replyTitle}>{headerTitle}</div>
                {replyTo.text && (
                  <div className={s.replyText}>{replyTo.text}</div>
                )}
              </div>
            </div>

            <button
              type="button"
              className={s.replyCloseBtn}
              onClick={onCancelReply}
            >
              ✕
            </button>
          </div>
        )}

        {sendError && (
          <div className={s.sendErrorBar}>
            <span>{t("chat.attach.sendFailed")}</span>
            <button
              type="button"
              className={s.sendErrorBtn}
              onClick={() => onRetrySend && onRetrySend()}
            >
              {t("chat.attach.retry")}
            </button>
          </div>
        )}

        {(attachments.length > 0 || isUploading) && (
          <div className={s.composerAttachmentsRow}>
            {visibleAttachments.map((att) => (
              <ComposerAttachmentItem
                key={att.localId}
                draft={att}
                onRemove={onRemoveAttachment}
                onRetry={onRetryAttachment}
              />
            ))}
            {hiddenCount > 0 && (
              <div className={s.composerAttachmentMore}>+{hiddenCount}</div>
            )}
            {isUploading && attachments.length === 0 && (
              <div className={s.attachmentUploading}>
                {t("chat.attach.uploading")}
              </div>
            )}
          </div>
        )}

        <div className={s.inputRow}>
          <div className={s.inputTextWrap}>
            <textarea
              ref={textareaRef}
              className={s.textbox}
              rows={1}
              value={text}
              placeholder="Сообщение…"
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              disabled={isBusy}
            />
          </div>

          <button
            className={s.sendIconBtn}
            onClick={handleSendClick}
            disabled={isBusy || !canSend}
            type="button"
          >
            {isBusy ? "⏳" : "➤"}
          </button>
        </div>
      </div>
    </div>
  );
}
