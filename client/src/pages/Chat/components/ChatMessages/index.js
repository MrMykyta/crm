// src/pages/Chat/components/ChatMessages/index.jsx
import React, { useMemo, useState, useEffect } from "react";
import s from "../../ChatPage.module.css";
import {
  getAuthorInfo,
  getMessageStatus,
  renderHighlightedText,
} from "../../utils/chatMessageUtils";

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

  // новый функционал выбора
  selectMode,
  selectedIds,
  onToggleSelect,
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
    const offset =
      mRect.top - cRect.top + container.scrollTop - 32;

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

  return (
    <div ref={listRef} className={messagesClass}>
      {isLoading && !messages.length && (
        <div className={s.roomsEmpty}>Загружаем сообщения…</div>
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
            const isMe = meId && String(m.authorId) === meId;

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

            // ---------- reply контекст ----------
            let replyMsg = null;
            if (m.replyToMessageId) {
              replyMsg = byId.get(String(m.replyToMessageId)) || null;
            }

            const replyInfo = replyMsg
              ? getAuthorInfo(replyMsg, companyUsers)
              : null;

            const replyAuthorName = replyInfo?.name || "Пользователь";

            const replyText =
              (replyMsg?.text || "").length > 140
                ? `${replyMsg.text.slice(0, 140)}…`
                : replyMsg?.text || "";

            // ---------- forward контекст ----------
            let forwardMsg = null;

            if (m.forwardFrom) {
              forwardMsg = byId.get(String(m.forwardFrom)) || null;
            } else if (m.forwardFromMessage) {
              forwardMsg = byId.get(String(m.forwardFromMessage)) || null;
            }

            const hasForwardMeta = !!m.meta?.forward;

            const forwardAuthorName = (() => {
              const mf = m.meta?.forward;
              if (mf?.originalAuthorName) return mf.originalAuthorName;
              if (mf?.authorName) return mf.authorName;

              if (mf?.originalAuthorId) {
                const { name } = getAuthorInfo(
                  { authorId: mf.originalAuthorId },
                  companyUsers
                );
                if (name) return name;
              }
              if (mf?.authorId) {
                const { name } = getAuthorInfo(
                  { authorId: mf.authorId },
                  companyUsers
                );
                if (name) return name;
              }

              if (forwardMsg?.meta?.forward) {
                const fm = forwardMsg.meta.forward;
                if (fm.originalAuthorName) return fm.originalAuthorName;
                if (fm.authorName) return fm.authorName;

                if (fm.originalAuthorId) {
                  const { name } = getAuthorInfo(
                    { authorId: fm.originalAuthorId },
                    companyUsers
                  );
                  if (name) return name;
                }
                if (fm.authorId) {
                  const { name } = getAuthorInfo(
                    { authorId: fm.authorId },
                    companyUsers
                  );
                  if (name) return name;
                }
              }

              if (forwardMsg) {
                const { name } = getAuthorInfo(forwardMsg, companyUsers);
                if (name) return name;
              }

              return "Пользователь";
            })();

            const hasForward = hasForwardMeta || !!forwardMsg;

            // выбор сообщений (режим "Выбрано N сообщений")
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
                  {/* Переслано от ... (БЕЗ превью) */}
                  {hasForward && (
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
                        style={
                          authorColor ? { color: authorColor } : undefined
                        }
                      >
                        {authorName}
                      </span>
                    </div>
                  )}

                  {/* Текст сообщения */}
                  <div className={s.msgText}>
                    {renderHighlightedText(
                      m.text || "",
                      searchQuery,
                      s.msgHighlight
                    )}
                  </div>

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