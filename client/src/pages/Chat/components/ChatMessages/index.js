// src/pages/Chat/ChatWindow/components/ChatMessages.jsx
import React, { useMemo } from "react";
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

  // режим выбора сообщений
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

            // ---------- REPLY ----------
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

            // ---------- FORWARD ----------
            // новая схема: m.forward (null или объект)
            // fallback на старую: m.meta?.forward
            const forwardData = m.forward ?? m.meta?.forward ?? null;
            const hasForward =
              forwardData !== null &&
              typeof forwardData === "object" &&
              Object.keys(forwardData).length > 0;

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
                <div className={s.msgBubble} data-role="msg-bubble">
                  {/* Переслано от ... (если forward != null) */}
                  {hasForward && (
                    <div className={s.msgForwardLabel}>
                      Переслано от {forwardAuthorName}
                    </div>
                  )}

                  {/* Превью ответа */}
                  {replyMsg && (
                    <div className={s.msgReplyPreview}>
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