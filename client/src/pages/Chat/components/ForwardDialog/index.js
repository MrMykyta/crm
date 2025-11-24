// src/pages/Chat/components/ForwardDialog.jsx
import React from "react";
import ReactDOM from "react-dom";
import s from "../../ChatPage.module.css";
import { getAuthorInfo } from "../../utils/chatMessageUtils";

function getRoomTitle(room, meId, companyUsers) {
  if (!room) return "Чат";

  if (room.type === "group") {
    const title = room.title || "Группа";
    const count = room.participants?.length || 0;
    return `${title} · ${count} уч.`;
  }

  const parts = room.participants || [];
  const otherPart =
    parts.find((p) => String(p.userId) !== String(meId)) || parts[0];

  if (!otherPart) return "Диалог";

  const fakeMsg = { authorId: otherPart.userId, author: otherPart };
  const { name } = getAuthorInfo(fakeMsg, companyUsers);
  return name || "Диалог";
}

export default function ForwardDialog({
  open,
  onClose,
  rooms,
  currentRoomId,
  meId,
  companyUsers,
  onSelectRoom,
}) {
  if (!open) return null;

  const root = document.getElementById("modal-root") || document.body;

  const handleItemClick = (roomId) => () => {
    onSelectRoom && onSelectRoom(roomId);
  };

  return ReactDOM.createPortal(
    <div className={s.ctxOverlay} onClick={onClose}>
      <div className={s.forwardModal} onClick={(e) => e.stopPropagation()}>
        <div className={s.forwardHeader}>
          <div className={s.forwardTitle}>Переслать сообщение</div>
          <button
            type="button"
            className={s.forwardCloseBtn}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className={s.forwardList}>
          {rooms.map((room) => {
            const title = getRoomTitle(room, meId, companyUsers);
            const isCurrent = String(room._id) === String(currentRoomId);

            return (
              <button
                key={room._id}
                type="button"
                className={`${s.forwardItem} ${
                  isCurrent ? s.forwardItemCurrent : ""
                }`}
                onClick={handleItemClick(room._id)}
              >
                <div className={s.forwardItemAvatar}>
                  {title[0] || "C"}
                </div>
                <div className={s.forwardItemTexts}>
                  <div className={s.forwardItemTitle}>{title}</div>
                  {isCurrent && (
                    <div className={s.forwardItemSub}>Текущий чат</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    root
  );
}