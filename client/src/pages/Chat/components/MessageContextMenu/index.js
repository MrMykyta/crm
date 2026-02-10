// src/pages/Chat/components/MessageContextMenu.jsx
// Context menu for message actions (reply/edit/pin/delete) with smart positioning.
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import s from "../../ChatPage.module.css";

export default function MessageContextMenu({
  open,
  anchorRect, // DOMRect пузыря
  boundsRect, // DOMRect зоны сообщений (listRef)
  side = "other", // 'me' | 'other'
  clickY, // clientY клика
  message,
  attachmentActions,
  onClose,
  onReply,
  onCopy,
  onEdit,
  onPin,
  onForward,
  onSelect,
  onDelete,
  onShowOriginal,
  canEdit = true,
  canCopy = true,
  canForward = true,
  canDelete = true,
  canShowOriginal = false,
  showOriginalLabel,
  deleteDisabled = false,
  isDeleting = false,
}) {
  const { t } = useTranslation();
  // Menu DOM ref for measuring size.
  const menuRef = useRef(null);
  // Calculated screen position for menu placement.
  const [pos, setPos] = useState({ x: -9999, y: -9999 });

  useEffect(() => {
    if (!open || !anchorRect) return;
    const el = menuRef.current;
    if (!el) return;
    if (typeof window === "undefined") return;

    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    const margin = 8;
    const gap = 8;

    setPos({ x: -9999, y: -9999 });

    const calc = () => {
      const menuRect = el.getBoundingClientRect();
      const menuW = menuRect.width || 220;
      const menuH = menuRect.height || 260;

      // ===== Y =====
      const baseY =
        typeof clickY === "number"
          ? clickY
          : anchorRect.top + anchorRect.height / 2;

      let y = baseY - menuH / 2;

      let topLimit = margin;
      let bottomLimit = vh - menuH - margin;

      if (boundsRect) {
        topLimit = boundsRect.top + margin;
        bottomLimit = boundsRect.bottom - menuH - margin;
      }

      if (bottomLimit < topLimit) {
        bottomLimit = topLimit;
      }

      if (y < topLimit) y = topLimit;
      if (y > bottomLimit) y = bottomLimit;

      // ===== X =====
      let x;
      if (side === "me") {
        x = anchorRect.left - gap - menuW;
        if (x < margin) x = margin;
        if (x + menuW + margin > vw) x = vw - menuW - margin;
      } else {
        x = anchorRect.right + gap;
        if (x + menuW + margin > vw) x = vw - menuW - margin;
        if (x < margin) x = margin;
      }

      setPos({ x, y });
    };

    requestAnimationFrame(calc);
  }, [open, anchorRect, boundsRect, side, clickY]);

  if (!open || !message) return null;
  if (typeof document === "undefined") return null;

  const handle = (cb) => () => {
    if (cb) cb(message);
  };

  const isPinned = !!message?.isPinned;
  const pinLabel = isPinned ? t("chat.menu.unpin") : t("chat.menu.pin");
  const editDisabled = !canEdit;
  const copyDisabled = !canCopy;
  const forwardDisabled = !canForward;
  const showDelete = !!canDelete;
  const showOriginal = !!canShowOriginal;
  const deleteIsDisabled = deleteDisabled || isDeleting;
  const hasAttachmentActions =
    attachmentActions &&
    (attachmentActions.canOpen || attachmentActions.canDownload);

  const menuNode = (
    <div className={s.ctxOverlay} onClick={onClose}>
      <div
        ref={menuRef}
        className={s.ctxMenu}
        data-side={side}
        style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={s.ctxMenuItem}
          onClick={handle(onReply)}
        >
          {t("chat.menu.reply")}
        </button>

        {canForward && (
          <button
            type="button"
            className={s.ctxMenuItem}
            onClick={forwardDisabled ? undefined : handle(onForward)}
            disabled={forwardDisabled}
          >
            {t("chat.menu.forward")}
          </button>
        )}

        {canEdit && (
          <button
            type="button"
            className={s.ctxMenuItem}
            onClick={editDisabled ? undefined : handle(onEdit)}
            disabled={editDisabled}
          >
            {t("chat.menu.edit")}
          </button>
        )}

        <button
          type="button"
          className={s.ctxMenuItem}
          onClick={handle(onPin)}
        >
          {pinLabel}
        </button>

        {hasAttachmentActions && (
          <>
            <div className={s.ctxMenuSeparator} />
            {attachmentActions.canOpen && (
              <button
                type="button"
                className={s.ctxMenuItem}
                onClick={handle(attachmentActions.onOpen)}
              >
                {attachmentActions.openLabel || t("chat.menu.open")}
              </button>
            )}
            {attachmentActions.canDownload && (
              <button
                type="button"
                className={s.ctxMenuItem}
                onClick={handle(attachmentActions.onDownload)}
              >
                {t("chat.attach.download")}
              </button>
            )}
          </>
        )}

        {showDelete && (
          <button
            type="button"
            className={`${s.ctxMenuItem} ${s.ctxMenuItemDanger}`}
            onClick={deleteIsDisabled ? undefined : handle(onDelete)}
            disabled={deleteIsDisabled}
          >
            {isDeleting ? t("chat.menu.deleting") : t("chat.menu.delete")}
          </button>
        )}

        {(canCopy || showOriginal || onSelect) && (
          <div className={s.ctxMenuSeparator} />
        )}

        {canCopy && (
          <button
            type="button"
            className={s.ctxMenuItem}
            onClick={copyDisabled ? undefined : handle(onCopy)}
            disabled={copyDisabled}
          >
            {t("chat.menu.copy")}
          </button>
        )}

        {showOriginal && (
          <button
            type="button"
            className={s.ctxMenuItem}
            onClick={handle(onShowOriginal)}
          >
            {showOriginalLabel || t("chat.menu.showOriginal")}
          </button>
        )}

        <button
          type="button"
          className={s.ctxMenuItem}
          onClick={handle(onSelect)}
        >
          {t("chat.menu.select")}
        </button>
      </div>
    </div>
  );

  return createPortal(menuNode, document.body);
}
