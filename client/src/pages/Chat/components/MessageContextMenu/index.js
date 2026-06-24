// src/pages/Chat/components/MessageContextMenu.jsx
// Context menu for message actions (reply/edit/pin/delete) with smart positioning.
import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  Reply,
  Copy,
  Pencil,
  Pin,
  PinOff,
  Forward,
  CheckSquare,
  Trash2,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
} from "lucide-react";
import s from "../../ChatPage.module.css";
import calcFloatingPosition from "../../utils/calcFloatingPosition";

// Компонент MessageContextMenu: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function MessageContextMenu({
  open,
  bubbleEl,
  containerEl,
  side = "other", // 'me' | 'other'
  message,
  attachmentActions,
  onToggleReaction,
  timeMeta,
  onClose,
  onReply,
  onCopy,
  onEdit,
  onPin,
  onForward,
  onSelect,
  onDelete,
  onShowOriginal,
  portalRoot,
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
  const reactionRef = useRef(null);
  // Calculated screen position for menu placement.
  const [pos, setPos] = useState({
    left: -9999,
    top: -9999,
    placement: "fallback",
    reactions: null,
  });
  const reactionStrip = ["👍", "❤️", "😂", "😮", "😢", "😡", "🎉", "🔥"];
  const showReactionStrip = Boolean(onToggleReaction && message && !message.deletedAt);

  useLayoutEffect(() => {
    if (!open || !bubbleEl || !containerEl) return;
    if (!menuRef.current) return;
    if (typeof window === "undefined") return;

    setPos({
      left: -9999,
      top: -9999,
      placement: "fallback",
      reactions: null,
    });

        // calc: вспомогательная логика компонента.
const calc = () => {
      const menuRect = menuRef.current
        ? menuRef.current.getBoundingClientRect()
        : { width: 200, height: 240 };
      const reactionsRect = showReactionStrip && reactionRef.current
        ? reactionRef.current.getBoundingClientRect()
        : null;

      const nextPos = calcFloatingPosition({
        bubbleEl,
        containerEl,
        prefer: side === "me" ? "right" : "left",
        menuSize: {
          width: menuRect.width,
          height: menuRect.height,
        },
        reactionsSize: showReactionStrip
          ? {
              width: reactionsRect?.width || 180,
              height: reactionsRect?.height || 40,
            }
          : null,
      });

      setPos(nextPos);
    };

    requestAnimationFrame(calc);
  }, [open, bubbleEl, containerEl, side, showReactionStrip]);

  if (!open || !message) return null;
  if (typeof document === "undefined") return null;

    // handle: обработчик пользовательского действия.
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
  const showSelect = !!onSelect;
  const showTimeMeta = !!timeMeta?.label;
  const showFooterSeparator = showTimeMeta || showDelete;

  const overlayClass = portalRoot
    ? `${s.ctxOverlay} ${s.ctxOverlayInChat}`
    : s.ctxOverlay;
  const wrapClass = portalRoot
    ? `${s.ctxMenuWrap} ${s.ctxMenuWrapInChat}`
    : s.ctxMenuWrap;

  const menuNode = (
    <div className={overlayClass} onClick={onClose}>
      {showReactionStrip && (
        <div
          ref={reactionRef}
          className={s.ctxMenuReactions}
          style={{
            left: `${pos.reactions?.left ?? pos.left}px`,
            top: `${pos.reactions?.top ?? pos.top}px`,
            maxWidth: `${pos.reactions?.maxWidth ?? 260}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {reactionStrip.map((emoji) => (
            <button
              key={`${message?._id || "msg"}-${emoji}`}
              type="button"
              className={s.ctxMenuReactionBtn}
              onClick={() => {
                onToggleReaction && onToggleReaction(message._id, emoji);
                onClose && onClose();
              }}
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            className={`${s.ctxMenuReactionBtn} ${s.ctxMenuReactionMore}`}
            aria-label={t("chat.menu.more", "More")}
          >
            ▼
          </button>
        </div>
      )}

      <div
        className={wrapClass}
        data-side={side}
        style={{
          left: `${pos.left}px`,
          top: `${pos.top}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div ref={menuRef} className={s.ctxMenu}>
          <button
            type="button"
            className={s.ctxMenuItem}
            onClick={handle(onReply)}
          >
            <span className={s.ctxMenuIcon}><Reply size={18} /></span>
            <span className={s.ctxMenuItemLabel}>{t("chat.menu.reply")}</span>
            <span className={s.ctxMenuItemSlot} />
          </button>

          {hasAttachmentActions && attachmentActions.canOpen && (
            <button
              type="button"
              className={s.ctxMenuItem}
              onClick={handle(attachmentActions.onOpen)}
            >
              <span className={s.ctxMenuIcon}><ExternalLink size={18} /></span>
              <span className={s.ctxMenuItemLabel}>
                {attachmentActions.openLabel || t("chat.menu.open")}
              </span>
              <span className={s.ctxMenuItemSlot} />
            </button>
          )}

          {hasAttachmentActions && attachmentActions.canDownload && (
            <button
              type="button"
              className={s.ctxMenuItem}
              onClick={handle(attachmentActions.onDownload)}
            >
              <span className={s.ctxMenuIcon}><Download size={18} /></span>
              <span className={s.ctxMenuItemLabel}>{t("chat.attach.download")}</span>
              <span className={s.ctxMenuItemSlot} />
            </button>
          )}

          {canCopy && (
            <button
              type="button"
              className={s.ctxMenuItem}
              onClick={copyDisabled ? undefined : handle(onCopy)}
              disabled={copyDisabled}
            >
              <span className={s.ctxMenuIcon}><Copy size={18} /></span>
              <span className={s.ctxMenuItemLabel}>{t("chat.menu.copy")}</span>
              <span className={s.ctxMenuItemSlot} />
            </button>
          )}

          {showOriginal && (
            <button
              type="button"
              className={s.ctxMenuItem}
              onClick={handle(onShowOriginal)}
            >
              <span className={s.ctxMenuIcon}><Copy size={18} /></span>
              <span className={s.ctxMenuItemLabel}>
                {showOriginalLabel || t("chat.menu.showOriginal")}
              </span>
              <span className={s.ctxMenuItemSlot} />
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              className={s.ctxMenuItem}
              onClick={editDisabled ? undefined : handle(onEdit)}
              disabled={editDisabled}
            >
              <span className={s.ctxMenuIcon}><Pencil size={18} /></span>
              <span className={s.ctxMenuItemLabel}>{t("chat.menu.edit")}</span>
              <span className={s.ctxMenuItemSlot} />
            </button>
          )}

          {onPin ? (
            <button
              type="button"
              className={s.ctxMenuItem}
              onClick={handle(onPin)}
            >
              <span className={s.ctxMenuIcon}>
                {isPinned ? <PinOff size={18} /> : <Pin size={18} />}
              </span>
              <span className={s.ctxMenuItemLabel}>{pinLabel}</span>
              <span className={s.ctxMenuItemSlot} />
            </button>
          ) : null}

          {canForward && (
            <button
              type="button"
              className={s.ctxMenuItem}
              onClick={forwardDisabled ? undefined : handle(onForward)}
              disabled={forwardDisabled}
            >
              <span className={s.ctxMenuIcon}><Forward size={18} /></span>
              <span className={s.ctxMenuItemLabel}>{t("chat.menu.forward")}</span>
              <span className={s.ctxMenuItemChevron}>
                <ChevronRight size={16} />
              </span>
            </button>
          )}

          {showSelect && (
            <button
              type="button"
              className={s.ctxMenuItem}
              onClick={handle(onSelect)}
            >
              <span className={s.ctxMenuIcon}><CheckSquare size={18} /></span>
              <span className={s.ctxMenuItemLabel}>{t("chat.menu.select")}</span>
              <span className={s.ctxMenuItemSlot} />
            </button>
          )}

          {showFooterSeparator && <div className={s.ctxMenuSeparator} />}

          {showTimeMeta && (
            <div className={`${s.ctxMenuItem} ${s.ctxMenuItemMeta}`}>
              <span className={s.ctxMenuIcon}><Clock size={18} /></span>
              <span className={s.ctxMenuMetaText}>{timeMeta.label}</span>
              {timeMeta.status && (
                <span className={s.ctxMenuMetaChecks}>
                  {timeMeta.status === "sent" ? "✓" : "✓✓"}
                </span>
              )}
            </div>
          )}

          {showDelete && (
            <>
              {showTimeMeta && <div className={s.ctxMenuSeparator} />}
              <button
                type="button"
                className={`${s.ctxMenuItem} ${s.ctxMenuItemDanger}`}
                onClick={deleteIsDisabled ? undefined : handle(onDelete)}
                disabled={deleteIsDisabled}
              >
              <span className={s.ctxMenuIcon}><Trash2 size={18} /></span>
                <span className={s.ctxMenuItemLabel}>
                  {isDeleting ? t("chat.menu.deleting") : t("chat.menu.delete")}
                </span>
                <span className={s.ctxMenuItemSlot} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(menuNode, portalRoot || document.body);
}
