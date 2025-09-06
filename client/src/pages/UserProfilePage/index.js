import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { X, CheckCircle2, CircleAlert } from "lucide-react";
import s from "./UserProfilePage.module.css";

/** Берёт значение по типу из contacts (email/phone), с приоритетом primary/public */
const pickFromContacts = (contacts = [], type, { primary = false, pub = false } = {}) => {
  const list = contacts.filter(c => c?.channel === type);
  if (!list.length) return null;
  if (primary) return list.find(c => c.isPrimary)?.value ?? list[0]?.value ?? null;
  if (pub) return list.find(c => c.isPublic)?.value ?? null;
  return list[0]?.value ?? null;
};

export default function UserProfilePage({ user }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const handleClose = () => navigate(-1);

  if (!user) return <div className={s.wrap}>{t("common.loading")}</div>;

  // ===== Нормализация полей под разные схемы БД
  const emailVerified = Boolean(user.emailVerifiedAt ?? user.emailVerified);

  const initials =
    ((user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")).toUpperCase() ||
    (user.emailNorm?.[0]?.toUpperCase() ||
     user.emailRaw?.[0]?.toUpperCase() || "U");

  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.emailNorm || user.emailRaw || user.email || "";

  const contacts = Array.isArray(user.contacts) ? user.contacts : [];

  const accountEmail =
    user.email || user.emailNorm || user.emailRaw ||
    pickFromContacts(contacts, "email", { primary: true }) ||
    pickFromContacts(contacts, "email");

  const publicEmail =
    user.emailPublic ||
    pickFromContacts(contacts, "email", { pub: true });

  const publicPhone =
    user.phonePublic || user.phoneNorm || user.phoneRaw ||
    pickFromContacts(contacts, "phone", { pub: true });

  const fmtDateTime = (d) => (d ? new Date(d).toLocaleString(i18n.language || undefined) : null);

  return (
    <div className={s.wrap}>
      <div className={s.card}>
        {/* close */}
        <button className={s.closeBtn} onClick={handleClose} aria-label={t("common.close")}>
          <X size={18} />
        </button>

        {/* header */}
        <div className={s.header}>
          <div className={s.avatar}>{initials}</div>
          <div>
            <h2 className={s.name}>{fullName}</h2>

            <div className={s.badges}>
              {emailVerified ? (
                <span className={`${s.badge} ${s.ok}`}>
                  <CheckCircle2 size={14} />
                  {t("settings.profile.emailVerified")}
                </span>
              ) : (
                <span className={s.badge}>
                  <CircleAlert size={14} />
                  {t("settings.profile.emailNotVerified")}
                </span>
              )}

              {user.isActive ? (
                <span className={`${s.badge} ${s.ok}`}>{t("settings.profile.active")}</span>
              ) : (
                <span className={s.badge}>{t("settings.profile.inactive")}</span>
              )}

              {user.lastLoginAt && (
                <span className={s.muted}>
                  {t("settings.profile.lastLogin")}: {fmtDateTime(user.lastLoginAt)}
                </span>
              )}
              {user.createdAt && (
                <span className={s.muted}>
                  {t("settings.profile.joined")}: {fmtDateTime(user.createdAt)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* contacts */}
        <div className={s.section}>
          <h3>{t("settings.profile.contacts")}</h3>
          <div className={s.list}>
            <div className={s.row}>
              <div className={s.label}>{t("common.email")}</div>
              <div className={s.value}>{publicEmail || accountEmail || "—"}</div>
            </div>

            {publicPhone && (
              <div className={s.row}>
                <div className={s.label}>{t("settings.profile.phone")}</div>
                <div className={s.value}>{publicPhone}</div>
              </div>
            )}

            {contacts.some(c => c.channel === "phone") && (
              <>
                <div className={s.phonesTitle}>{t("settings.profile.phones")}</div>
                <ul className={s.phones}>
                  {contacts
                    .filter(c => c.channel === "phone")
                    .map(c => (
                      <li key={c.id || `${c.channel}-${c.value}`}>
                        {c.value}
                        {c.isPrimary && <small> ({t("settings.profile.primary")})</small>}
                        {c.isPublic && <small> ({t("settings.profile.public")})</small>}
                      </li>
                    ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}