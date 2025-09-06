import { useEffect, useRef } from "react";
import { User2, Settings, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import s from "./UserMenu.module.css";

export default function UserMenu({ user, onClose, onLogout }) {
  const ref = useRef(null);
  const navigate = useNavigate();
  const { t } = useTranslation();
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose?.(); };
    const onEsc = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, [onClose]);

  const goSettings = () => { onClose?.(); navigate("/main/user-settings"); };
  const goProfile = () => { onClose?.(); navigate("/main/user-profile"); };
  const logout = () => { onClose?.(); onLogout?.(); };

  return (
    <div ref={ref} className={s.menu} role="menu">
      <div className={s.head}>
        <div className={s.initials}>{(user?.firstName?.[0]||"U").toUpperCase()}{(user?.lastName?.[0]||"").toUpperCase()}</div>
        <div className={s.meta}>
          <div className={s.name}>{[user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User"}</div>
          <div className={s.email}>{user?.email}</div>
        </div>
      </div>

      <button className={s.item} onClick={goProfile}>
        <User2 size={16}/> <span>{t('userMenu.profile')}</span>
      </button>
      <button className={s.item} onClick={goSettings}>
        <Settings size={16}/> <span>{t('userMenu.settings')}</span>
      </button>

      <div className={s.sep} />

      <button className={`${s.item} ${s.danger}`} onClick={logout}>
        <LogOut size={16}/> <span>{t('userMenu.logout')}</span>
      </button>
    </div>
  );
}