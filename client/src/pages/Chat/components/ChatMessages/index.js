// src/pages/Chat/components/ChatMessages.jsx
// Message list renderer: grouping by day, bubble stacking, hover actions, and attachments.
// Keeps message interactions (reply jump, select mode) consistent with ChatWindow state.
import React, { useMemo, useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { useSignedFileUrl } from "../../../../hooks/useSignedFileUrl";
import s from "../../ChatPage.module.css";
import {
  getAuthorInfo,
  getMessageStatus,
  renderHighlightedText,
} from "../../utils/chatMessageUtils";
import ChatAttachment from "../ChatAttachment";

const MEDIA_PREFIXES = ["image/", "video/"];
const MAX_MEDIA_PREVIEW = 4;

/**
 * Normalize raw attachment object to unified shape.
 * @param {object} att
 * @returns {object}
 */
const normalizeAttachment = (att) => {
  if (!att) return null;
  return {
    fileId: att.fileId || att.id || null,
    filename: att.filename || att.name || "",
    mime: att.mime || att.mimeType || "",
    size: att.size || 0,
    url: att.url || att.downloadUrl || "",
  };
};

/**
 * Whether attachment should be treated as media (image/video).
 * @param {object} att
 * @returns {boolean}
 */
const isMediaAttachment = (att) => {
  if (!att?.mime) return false;
  return MEDIA_PREFIXES.some((prefix) => att.mime.startsWith(prefix));
};

/**
 * Single media tile used inside message grid.
 * @param {object} props
 */
function MessageMediaTile({ item, overlayText, onOpen }) {
  const { t } = useTranslation();
  const fileId = item?.fileId || "";
  const mime = item?.mime || "";
  const isVideo = mime.startsWith("video/");

  // Signed inline URL for media preview.
  const { url, onError } = useSignedFileUrl(fileId);

  return (
    <button
      type="button"
      className={s.mediaTile}
      onClick={onOpen}
      aria-label={item?.filename || t("chat.mediaItem")}
    >
      {url ? (
        isVideo ? (
          <video
            className={s.mediaTileMedia}
            src={url}
            preload="metadata"
            muted
          />
        ) : (
          <img
            className={s.mediaTileMedia}
            src={url}
            alt={item?.filename || ""}
            onError={onError}
          />
        )
      ) : (
        <div className={s.mediaTilePlaceholder} />
      )}

      {isVideo && <div className={s.mediaTilePlay}>▶</div>}
      {overlayText && (
        <div className={s.mediaTileOverlay}>{overlayText}</div>
      )}
    </button>
  );
}

export default function ChatMessages({
  listRef,
  messagesClass,
  isLoading,
  messages,
  groupedMessages,
  meId,
  isGroup,
  participants,
  room,
  companyUsers,
  searchQuery,
  onMessageActionsClick,
  onOpenMedia,
  onToggleReaction,
  activeOverlay,
  onToggleReactionPicker,
  onCloseReactionPicker,

  // режим выбора сообщений
  selectMode,
  selectedIds,
  onToggleSelect,

  // 🔼 пагинация вверх
  hasMore,
  isLoadingMore,
  onLoadMore,
}) {
  const { t } = useTranslation();

  // Reactions state mapped by messageId from Redux.
  const reactionsById = useSelector((st) => st.chat.reactions || {});
  // Picker ref for outside click handling.
  const pickerRef = useRef(null);

  // Map for quick lookup by id (reply preview).
  const byId = useMemo(() => {
    const map = new Map();
    (messages || []).forEach((msg) => {
      if (msg && msg._id) {
        map.set(String(msg._id), msg);
      }
    });
    return map;
  }, [messages]);

  // id сообщения, которое подсвечиваем после прыжка
  const [jumpHighlightId, setJumpHighlightId] = useState(null);

  // авто-сброс подсветки
  useEffect(() => {
    if (!jumpHighlightId) return;
    const tmo = setTimeout(() => setJumpHighlightId(null), 900);
    return () => clearTimeout(tmo);
  }, [jumpHighlightId]);

  // Close reaction picker on ESC or outside click.
  const isReactionOpen = activeOverlay?.type === "reaction";

  useEffect(() => {
    if (!isReactionOpen) return;
    const onClick = (e) => {
      if (e.target.closest("[data-reaction-trigger]")) return;
      if (e.target.closest("[data-reaction-picker]")) return;
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onCloseReactionPicker && onCloseReactionPicker();
      }
    };
    document.addEventListener("mousedown", onClick, true);
    return () => {
      document.removeEventListener("mousedown", onClick, true);
    };
  }, [isReactionOpen, onCloseReactionPicker]);

  // скролл к сообщению + подсветка
  const handleJumpToMessage = (targetMsg, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!targetMsg || !listRef?.current) return;

    const container = listRef.current;
    const el = document.getElementById(`msg-${targetMsg._id}`);
    if (!el) return;

    const cRect = container.getBoundingClientRect();
    const mRect = el.getBoundingClientRect();

    // позиция с небольшим отступом сверху
    const offset = mRect.top - cRect.top + container.scrollTop - 32;

    try {
      container.scrollTo({
        top: offset,
        behavior: "smooth",
      });
    } catch {
      container.scrollTop = offset;
    }

    setJumpHighlightId(String(targetMsg._id));
  };

  // Resolve reactions for a message using Redux state (counts + reacted).
  const getReactionEntries = (msg) => {
    const messageId = String(msg?._id || "");
    if (!messageId) return [];
    const raw =
      reactionsById[messageId] || msg?.reactions || msg?.meta?.reactions || {};
    const items = [];

    Object.entries(raw || {}).forEach(([emoji, value]) => {
      if (!emoji) return;
      if (typeof value === "number") {
        if (value > 0) items.push({ emoji, count: value, reacted: false });
        return;
      }
      if (value && typeof value === "object") {
        const count = Number(value.count || 0);
        if (!count) return;
        items.push({ emoji, count, reacted: Boolean(value.reacted) });
      }
    });

    return items.sort((a, b) => b.count - a.count);
  };

  // Emoji set for the quick picker.
  const REACTION_EMOJI = [
    "👍",
    "❤️",
    "😂",
    "😮",
    "😢",
    "🙏",
    "🎉",
    "🔥",
    "👏",
    "👀",
  ];

  // 🔼 обработчик скролла: если близко к верху — грузим ещё
  const handleScroll = (e) => {
    if (!hasMore || isLoadingMore || !onLoadMore) return;
    const el = e.currentTarget;
    if (!el) return;

    if (el.scrollTop <= 300) {
      onLoadMore();
    }
  };

  return (
    <div
      ref={listRef}
      className={messagesClass}
      onScroll={handleScroll}
    >
      {isLoading && !messages.length && (
        <div className={s.roomsEmpty}>{t("chat.messages.loading")}</div>
      )}

      {/* Лоадер при подгрузке старых сообщений */}
      {isLoadingMore && hasMore && (
        <div className={s.loadMoreSpinner}>{t("chat.messages.loadingMore")}</div>
      )}

      {!isLoading && !messages.length && (
        <div className={s.roomsEmpty}>{t("chat.messages.empty")}</div>
      )}

      {groupedMessages.map((group) => (
        <div key={group.key}>
          <div className={s.dayDivider} data-day-key={group.key}>
            <span>{group.label}</span>
          </div>

          {group.items.map((m, idx) => {
            const prev = group.items[idx - 1] || null;
            const next = group.items[idx + 1] || null;

            const sameAuthorPrev =
              prev &&
              !prev.isSystem &&
              !m.isSystem &&
              String(prev.authorId) === String(m.authorId);
            const sameAuthorNext =
              next &&
              !next.isSystem &&
              !m.isSystem &&
              String(next.authorId) === String(m.authorId);

            const stackClass = !sameAuthorPrev && !sameAuthorNext
              ? s.msgStackSingle
              : !sameAuthorPrev && sameAuthorNext
              ? s.msgStackStart
              : sameAuthorPrev && sameAuthorNext
              ? s.msgStackMiddle
              : s.msgStackEnd;

            const wrapStackClass = sameAuthorPrev ? s.messageWrapStacked : "";

            // ---------- СИСТЕМНОЕ СООБЩЕНИЕ ----------
            if (m.isSystem) {
              return (
                <div
                  key={m._id}
                  id={`msg-${m._id}`}
                  className={s.systemMessageWrap}
                >
                  <div className={s.systemMessageInner}>
                    {renderHighlightedText(
                      m.text || "",
                      searchQuery,
                      s.msgHighlight
                    )}
                  </div>
                </div>
              );
            }

            // ---------- Обычное сообщение ----------
            const isMe = meId && String(m.authorId) === meId;
            const isDeleted = !!m.deletedAt;

            const rawAttachments = isDeleted
              ? []
              : m?.meta?.attachments || m?.attachments || [];

            const normalizedAttachments = (Array.isArray(rawAttachments)
              ? rawAttachments
              : [])
              .map(normalizeAttachment)
              .filter(Boolean);

            const mediaAttachments = normalizedAttachments.filter(isMediaAttachment);
            const otherAttachments = normalizedAttachments.filter(
              (att) => !isMediaAttachment(att)
            );

            const hasAttachments =
              mediaAttachments.length > 0 || otherAttachments.length > 0;

            const {
              name: authorName,
              initials,
              color: authorColor,
            } = getAuthorInfo(m, companyUsers);

            const showAuthorName = isGroup && !isMe && !sameAuthorPrev;
            const showAvatar = !isMe && !sameAuthorNext;

            const status = isMe
              ? getMessageStatus(m, room, meId, participants)
              : null;

            const isDouble =
              status === "readSome" || status === "readAll" || false;

            const statusTitle = isMe
              ? status === "sent"
                ? t("chat.message.status.sent")
                : status === "readSome"
                ? isGroup
                  ? t("chat.message.status.readSome")
                  : t("chat.message.status.delivered")
                : isGroup
                ? t("chat.message.status.readAll")
                : t("chat.message.status.read")
              : "";

            // ---------- REPLY ----------
            let replyMsg = null;
            if (m.replyToMessageId) {
              replyMsg = byId.get(String(m.replyToMessageId)) || null;
            }

            const replyInfo = replyMsg
              ? getAuthorInfo(replyMsg, companyUsers)
              : null;

            const replyAuthorName = replyInfo?.name || t("chat.message.user");

            let replyTextRaw = replyMsg?.deletedAt
              ? t("chat.message.deleted")
              : replyMsg?.text || "";

            if (!replyTextRaw && replyMsg && !replyMsg.deletedAt) {
              const replyAttachments =
                replyMsg?.meta?.attachments || replyMsg?.attachments || [];
              if (Array.isArray(replyAttachments) && replyAttachments.length) {
                replyTextRaw =
                  replyAttachments[0]?.filename ||
                  replyAttachments[0]?.name ||
                  t("chat.message.attachment");
              }
            }

            const replyText =
              replyTextRaw.length > 140
                ? `${replyTextRaw.slice(0, 140)}…`
                : replyTextRaw || "";

            // ---------- FORWARD ----------
            const forwardData = m.forward ?? m.meta?.forward ?? null;
            const hasForward =
              forwardData !== null &&
              typeof forwardData === "object" &&
              Object.keys(forwardData).length > 0;
            const showForward = hasForward && !isDeleted;

            let forwardAuthorName = t("chat.message.user");

            if (hasForward) {
              const fwd = forwardData;

              if (fwd.originalAuthorName) {
                forwardAuthorName = fwd.originalAuthorName;
              } else if (fwd.originalAuthorId) {
                const { name } = getAuthorInfo(
                  { authorId: fwd.originalAuthorId },
                  companyUsers
                );
                if (name) forwardAuthorName = name;
              } else if (fwd.authorName) {
                forwardAuthorName = fwd.authorName;
              } else if (fwd.authorId) {
                const { name } = getAuthorInfo(
                  { authorId: fwd.authorId },
                  companyUsers
                );
                if (name) forwardAuthorName = name;
              }
            }

            // выбор сообщений
            const isSelected =
              selectMode && selectedIds.includes(String(m._id));

            const wrapClass = [
              s.messageWrap,
              isMe ? s.meWrap : s.otherWrap,
              isSelected ? s.messageWrapSelected : "",
              isReactionOpen && String(activeOverlay?.messageId) === String(m._id)
                ? s.messageWrapActionsOpen
                : "",
              wrapStackClass,
            ]
              .filter(Boolean)
              .join(" ");

            const bubbleClass = [
              s.msgBubble,
              stackClass,
              jumpHighlightId === String(m._id) ? s.msgBubbleHighlight : "",
            ]
              .filter(Boolean)
              .join(" ");

            const mediaPreview = mediaAttachments.slice(0, MAX_MEDIA_PREVIEW);
            const extraMediaCount = mediaAttachments.length - mediaPreview.length;
            const reactions = getReactionEntries(m);
            const showPicker =
              isReactionOpen &&
              String(activeOverlay?.messageId) === String(m._id);
            const bodyClass = [
              s.messageBody,
              isMe ? s.messageBodyMe : s.messageBodyOther,
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <div
                key={m._id}
                id={`msg-${m._id}`}
                className={wrapClass}
                onDoubleClick={(e) =>
                  onMessageActionsClick && onMessageActionsClick(m, e)
                }
                onContextMenu={(e) => {
                  if (selectMode) return;
                  e.preventDefault();
                  e.stopPropagation();
                  onMessageActionsClick && onMessageActionsClick(m, e, e.currentTarget);
                }}
                onClick={(e) => {
                  if (!selectMode) return;
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleSelect && onToggleSelect(m);
                }}
              >
                {/* СОБЕСЕДНИК: аватар слева */}
                {showAvatar && (
                  <div className={s.msgAvatar}>
                    <span>{initials || "U"}</span>
                  </div>
                )}

                <div className={bodyClass}>
                  {/* ПУЗЫРЬ */}
                  <div className={bubbleClass} data-role="msg-bubble">
                  {/* Hover actions */}
                  {!selectMode && !isDeleted && (
                    <div
                      className={`${s.msgActions} ${
                        isMe ? s.msgActionsMe : s.msgActionsOther
                      }`}
                    >
                      <button
                        type="button"
                        className={`${s.msgActionBtn} ${s.msgActionBtnReact}`}
                        aria-label={t("chat.actions.react")}
                        data-reaction-trigger
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleReactionPicker && onToggleReactionPicker(m._id);
                        }}
                      >
                        <span className={s.msgActionPlus}>+</span>
                        <span className={s.msgActionEmoji}>😊</span>
                      </button>
                      <button
                        type="button"
                        className={s.msgActionBtn}
                        aria-label={t("chat.actions.more")}
                        onClick={(e) => {
                          const anchor = e.currentTarget.closest(
                            '[data-role="msg-bubble"]'
                          );
                          onMessageActionsClick &&
                            onMessageActionsClick(m, e, anchor);
                        }}
                      >
                        ⋯
                      </button>
                    </div>
                  )}

                  {showPicker && (
                    <div
                      ref={pickerRef}
                      data-reaction-picker
                      className={`${s.reactionPicker} ${
                        isMe ? s.reactionPickerMe : s.reactionPickerOther
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {REACTION_EMOJI.map((emoji) => (
                        <button
                          key={`${m._id}-${emoji}`}
                          type="button"
                          className={s.reactionEmojiBtn}
                          onClick={() => {
                            onToggleReaction && onToggleReaction(m._id, emoji);
                            onCloseReactionPicker && onCloseReactionPicker();
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Переслано от ... */}
                  {showForward && (
                    <div className={s.msgForwardLabel}>
                      {t("chat.message.forwardedFrom", {
                        name: forwardAuthorName,
                      })}
                    </div>
                  )}

                  {/* Превью ответа (кликабельное: прыгаем к сообщению) */}
                  {replyMsg && (
                    <div
                      className={s.msgReplyPreview}
                      onClick={(e) => handleJumpToMessage(replyMsg, e)}
                    >
                      <div className={s.msgReplyPreviewBar} />
                      <div className={s.msgReplyPreviewContent}>
                        <div className={s.msgReplyPreviewTitle}>
                          {replyAuthorName}
                        </div>
                        {replyText && (
                          <div className={s.msgReplyPreviewText}>
                            {replyText}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Имя автора в группе */}
                  {showAuthorName && (
                    <div className={s.messageAuthorRow}>
                      <span
                        className={s.messageAuthorName}
                        style={authorColor ? { color: authorColor } : undefined}
                      >
                        {authorName}
                      </span>
                    </div>
                  )}

                  {/* Текст сообщения */}
                  {(isDeleted || (m.text || "").trim()) && (
                    <div
                      className={[
                        s.msgText,
                        isDeleted ? s.msgTextDeleted : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {renderHighlightedText(
                        isDeleted ? t("chat.message.deleted") : m.text || "",
                        searchQuery,
                        s.msgHighlight
                      )}
                    </div>
                  )}

                  {/* Медиа-вложения (grid) */}
                  {mediaPreview.length > 0 && (
                    <div
                      className={s.mediaGrid}
                      data-count={mediaPreview.length}
                    >
                      {mediaPreview.map((att, mediaIdx) => {
                        const overlay =
                          mediaIdx === mediaPreview.length - 1 &&
                          extraMediaCount > 0
                            ? `+${extraMediaCount}`
                            : "";

                        return (
                          <MessageMediaTile
                            key={`${m._id}-media-${att.fileId || mediaIdx}`}
                            item={att}
                            overlayText={overlay}
                            onOpen={() =>
                              onOpenMedia &&
                              onOpenMedia(mediaAttachments, mediaIdx)
                            }
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Прочие вложения (документы/аудио) */}
                  {otherAttachments.length > 0 && (
                    <div className={s.attachmentsWrap}>
                      {otherAttachments.map((att, idx) => (
                        <ChatAttachment
                          key={`${m._id}-att-${att.fileId || att.id || idx}`}
                          attachment={att}
                          mode="message"
                          forceFileCard
                        />
                      ))}
                    </div>
                  )}

                  {/* Время + галочки */}
                  <div className={s.msgMetaRow}>
                    {m.createdAt && (
                      <div className={s.msgTime}>
                        {new Date(m.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    )}

                    {isMe && status && (
                      <div className={s.msgStatus} title={statusTitle}>
                        <span
                          className={[
                            s.msgCheckIcon,
                            status === "sent"
                              ? s.msgCheckSent
                              : status === "readSome"
                              ? s.msgCheckPartial
                              : s.msgCheckRead,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {isDouble ? (
                            <>
                              <span className={s.msgCheckLayer}>✓</span>
                              <span className={s.msgCheckLayer}>✓</span>
                            </>
                          ) : (
                            <span className={s.msgCheckLayer}>✓</span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                  </div>

                  {reactions.length > 0 && (
                    <div
                      className={`${s.reactionRow} ${
                        isMe ? s.reactionRowMe : s.reactionRowOther
                      }`}
                    >
                      {reactions.map((r) => (
                        <button
                          key={`${m._id}-reaction-${r.emoji}`}
                          type="button"
                          className={`${s.reactionPill} ${
                            r.reacted ? s.reactionPillActive : ""
                          }`}
                          onClick={() =>
                            onToggleReaction && onToggleReaction(m._id, r.emoji)
                          }
                          aria-pressed={r.reacted}
                        >
                          <span className={s.reactionEmoji}>{r.emoji}</span>
                          <span className={s.reactionCount}>{r.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
