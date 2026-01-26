import React from "react";
import { useTranslation } from "react-i18next";
import ImagePicker from "../../inputs/ImagePicker";
import s from "./ChatInfoPanel.module.css";

export default function ChatInfoHeader({
  isGroup,
  title,
  subtitle,
  avatarUrl,
  initials,
  onAvatarError,
  otherUser,
  canEdit,
  isEditing,
  titleDraft,
  onTitleChange,
  onEdit,
  onCancel,
  onSave,
  isSaving,
  onClose,
  avatarUploader,
  isAvatarUploading,
}) {
  const { t } = useTranslation();

  if (!isGroup) {
    return (
      <div className={s.infoHeader}>
        <div className={s.infoHeaderRow}>
          <div className={s.infoHeaderLeft}>
            <div className={s.infoAvatar}>
              {otherUser?.avatar ? (
                <img src={otherUser.avatar} alt="" onError={onAvatarError} />
              ) : (
                <span>{otherUser?.initials || "U"}</span>
              )}
            </div>
            <div className={s.infoHeaderTexts}>
              <div className={s.infoTitle}>{otherUser?.name || title}</div>
              {otherUser?.subtitle ? (
                <div className={s.infoSubtitle}>{otherUser.subtitle}</div>
              ) : null}
            </div>
          </div>
          <div className={s.infoHeaderActions}>
            <button type="button" className={s.infoCloseBtn} onClick={onClose}>
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={s.infoHeader}>
      <div className={s.infoHeaderRow}>
        <div className={s.infoHeaderLeft}>
          <div className={s.infoAvatar}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" onError={onAvatarError} />
            ) : (
              <span>{initials || "#"}</span>
            )}
          </div>
          <div className={s.infoHeaderTexts}>
            {!isEditing ? (
              <>
                <div className={s.infoTitle}>{title}</div>
                {subtitle ? (
                  <div className={s.infoSubtitle}>{subtitle}</div>
                ) : null}
              </>
            ) : (
              <div className={s.infoEditRow}>
                <input
                  className={s.infoEditInput}
                  value={titleDraft}
                  onChange={(e) => onTitleChange(e.target.value)}
                  placeholder={t("chat.info.fields.groupName")}
                />
              </div>
            )}
          </div>
        </div>

        <div className={s.infoHeaderActions}>
          {!isEditing && canEdit && (
            <button
              type="button"
              className={s.infoActionBtn}
              onClick={onEdit}
            >
              {t("chat.info.actions.edit")}
            </button>
          )}

          {isEditing && (
            <div className={s.infoEditActions}>
              <button
                type="button"
                className={s.infoActionBtnPrimary}
                disabled={isSaving}
                onClick={onSave}
              >
                {t("chat.info.actions.save")}
              </button>
              <button
                type="button"
                className={s.infoActionBtn}
                disabled={isSaving}
                onClick={onCancel}
              >
                {t("chat.info.actions.cancel")}
              </button>
            </div>
          )}

          <button type="button" className={s.infoCloseBtn} onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      {isEditing && (
        <div className={s.infoEditRow}>
          <ImagePicker
            value={avatarUrl}
            onChange={() => {}}
            uploader={avatarUploader}
            allowUrlInput={false}
            label={t("chat.info.actions.edit")}
            disabled={isAvatarUploading}
          />
        </div>
      )}
    </div>
  );
}
