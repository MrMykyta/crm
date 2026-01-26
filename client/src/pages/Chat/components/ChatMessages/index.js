// src/pages/Chat/ChatWindow/components/ChatMessages.jsx
import React, { useMemo, useState, useEffect } from "react";
import s from "../../ChatPage.module.css";
import {
  getAuthorInfo,
  getMessageStatus,
  renderHighlightedText,
} from "../../utils/chatMessageUtils";
import ChatAttachment from "../ChatAttachment";

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

  // режим выбора сообщений
  selectMode,
  selectedIds,
  onToggleSelect,

  // 🔼 пагинация вверх
  hasMore,
  isLoadingMore,
  onLoadMore,
}) {
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
    const t = setTimeout(() => setJumpHighlightId(null), 900);
    return () => clearTimeout(t);
  }, [jumpHighlightId]);

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

  // 🔼 обработчик скролла: если близко к верху — грузим ещё
  const handleScroll = (e) => {
    if (!hasMore || isLoadingMore || !onLoadMore) return;
    const el = e.currentTarget;
    if (!el) return;

    // раньше было <= 80 — можно сделать чуть больше
    if (el.scrollTop <= 300) {
      onLoadMore();
    }
  };

  return (
    <div
      ref={listRef}
      className={messagesClass}
      onScroll={handleScroll} // 👈 вешаем скролл
    >
      {isLoading && !messages.length && (
        <div className={s.roomsEmpty}>Загружаем сообщения…</div>
      )}

      {/* Лоадер при подгрузке старых сообщений */}
      {isLoadingMore && hasMore && (
        <div className={s.loadMoreSpinner}>
          Загрузка более ранних сообщений…
        </div>
      )}

      {!isLoading && !messages.length && (
        <div className={s.roomsEmpty}>В этом чате ещё нет сообщений</div>
      )}

      {groupedMessages.map((group) => (
        <div key={group.key}>
          <div className={s.dayDivider} data-day-key={group.key}>
            <span>{group.label}</span>
          </div>

          {group.items.map((m) => {
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
            const attachments = isDeleted
              ? []
              : m?.meta?.attachments || m?.attachments || [];
            const hasAttachments =
              Array.isArray(attachments) && attachments.length > 0;

            const {
              name: authorName,
              initials,
              color: authorColor,
            } = getAuthorInfo(m, companyUsers);

            const showAuthorName = isGroup && !isMe;

            const status = isMe
              ? getMessageStatus(m, room, meId, participants)
              : null;

            const isDouble =
              status === "readSome" || status === "readAll" || false;

            const statusTitle = isMe
              ? status === "sent"
                ? "Отправлено"
                : status === "readSome"
                ? isGroup
                  ? "Прочитано кем-то"
                  : "Доставлено"
                : isGroup
                ? "Прочитано всеми"
                : "Прочитано"
              : "";

            // ---------- REPLY ----------
            let replyMsg = null;
            if (m.replyToMessageId) {
              replyMsg = byId.get(String(m.replyToMessageId)) || null;
            }

            const replyInfo = replyMsg
              ? getAuthorInfo(replyMsg, companyUsers)
              : null;

            const replyAuthorName = replyInfo?.name || "Пользователь";

            let replyTextRaw = replyMsg?.deletedAt
              ? "Сообщение удалено"
              : replyMsg?.text || "";

            if (!replyTextRaw && replyMsg && !replyMsg.deletedAt) {
              const replyAttachments =
                replyMsg?.meta?.attachments || replyMsg?.attachments || [];
              if (Array.isArray(replyAttachments) && replyAttachments.length) {
                replyTextRaw =
                  replyAttachments[0]?.filename ||
                  replyAttachments[0]?.name ||
                  "Вложение";
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

            let forwardAuthorName = "Пользователь";

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
            ]
              .filter(Boolean)
              .join(" ");

            const bubbleClass = [
              s.msgBubble,
              jumpHighlightId === String(m._id) ? s.msgBubbleHighlight : "",
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
                onClick={(e) => {
                  if (!selectMode) return;
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleSelect && onToggleSelect(m);
                }}
              >
                {/* СОБЕСЕДНИК: аватар слева */}
                {!isMe && (
                  <div className={s.msgAvatar}>
                    <span>{initials || "U"}</span>
                  </div>
                )}

                {/* ПУЗЫРЬ */}
                <div className={bubbleClass} data-role="msg-bubble">
                  {/* Переслано от ... */}
                  {showForward && (
                    <div className={s.msgForwardLabel}>
                      Переслано от {forwardAuthorName}
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
                        isDeleted ? "Сообщение удалено" : m.text || "",
                        searchQuery,
                        s.msgHighlight
                      )}
                    </div>
                  )}

                  {/* Вложения */}
                  {hasAttachments && (
                    <div className={s.attachmentsWrap}>
                      {attachments.map((att, idx) => (
                        <ChatAttachment
                          key={`${m._id}-att-${att.fileId || att.id || idx}`}
                          attachment={att}
                          mode="message"
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
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
