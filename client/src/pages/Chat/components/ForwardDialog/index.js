// src/pages/Chat/components/ForwardDialog.jsx
// Dialog for forwarding a message to another room.
import React from "react";
import ReactDOM from "react-dom";
import { useTranslation } from "react-i18next";
import s from "../../ChatPage.module.css";
import { getAuthorInfo } from "../../utils/chatMessageUtils";

function getRoomTitle(room, meId, companyUsers, t) {
  if (!room) return t("chat.sidebar.roomFallback");

  if (room.type === "group") {
    const title = room.title || t("chat.header.groupFallback");
    const count = room.participants?.length || 0;
    return t("chat.forward.groupTitle", { title, count });
  }

  const parts = room.participants || [];
  const otherPart =
    parts.find((p) => String(p.userId) !== String(meId)) || parts[0];

  if (!otherPart) return t("chat.forward.directFallback");

  const fakeMsg = { authorId: otherPart.userId, author: otherPart };
  const { name } = getAuthorInfo(fakeMsg, companyUsers);
  return name || t("chat.forward.directFallback");
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
  const { t } = useTranslation();
  if (!open) return null;

  const root = document.getElementById("modal-root") || document.body;

  const handleItemClick = (roomId) => () => {
    onSelectRoom && onSelectRoom(roomId);
  };

  return ReactDOM.createPortal(
    <div className={s.ctxOverlay} onClick={onClose}>
      <div className={s.forwardModal} onClick={(e) => e.stopPropagation()}>
        <div className={s.forwardHeader}>
          <div className={s.forwardTitle}>{t("chat.forward.title")}</div>
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
            const title = getRoomTitle(room, meId, companyUsers, t);
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
                    <div className={s.forwardItemSub}>
                      {t("chat.forward.currentRoom")}
                    </div>
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
