import { useEffect, useRef, useState } from "react";
import { User2, Settings, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import s from "./UserMenu.module.css";

export default function UserMenu({ user, onClose, onLogout }) {
  const ref = useRef(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Есть ли аватар (user.avatarUrl или уже прогружен hook'ом)
  const [hasImg, setHasImg] = useState(Boolean(user?.avatarUrl));

  // Подписка на клики вне меню
  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    };
    const onEsc = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [onClose]);

  // Отслеживаем событие от hook'а — картинка прогружена
  useEffect(() => {
    const onReady = (e) => {
      const url = e?.detail?.url;
      if (url) setHasImg(true);
    };
    window.addEventListener("user:avatar-ready", onReady);
    return () => window.removeEventListener("user:avatar-ready", onReady);
  }, []);

  // если user.avatarUrl появился после логина — сразу включаем
  useEffect(() => {
    if (user?.avatarUrl) setHasImg(true);
  }, [user?.avatarUrl]);

  // ===== Логика навигации =====
  const goProfile  = () => { onClose?.(); navigate("/main/user-profile"); };
  const logout     = () => { onClose?.(); onLogout?.(); };

  const initials = `${(user?.firstName?.[0] || "U").toUpperCase()}${(user?.lastName?.[0] || "").toUpperCase()}`;
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User";
  const email = user?.email || user?.emailNorm || user?.emailRaw || "";

  // Источник картинки: приоритет — user.avatarUrl, иначе var от hook'а
  const bgImage = user?.avatarUrl
    ? `url("${user.avatarUrl}")`
    : "var(--user-avatar-url)";

  return (
    <div ref={ref} className={s.menu} role="menu">
      <div className={s.head}>
        <div className={s.avatar} data-has-img={hasImg ? "1" : "0"}>
          <div className={s.avatarImg} style={{ backgroundImage: bgImage }} />
          <div className={s.initials}>{initials}</div>
        </div>
        <div className={s.meta}>
          <div className={s.name} title={fullName}>{fullName}</div>
          <div className={s.email} title={email}>{email}</div>
        </div>
      </div>

      <button className={s.item} onClick={goProfile}>
        <User2 size={16} /> <span>{t("userMenu.account")}</span>
      </button>

      <div className={s.sep} />

      <button className={`${s.item} ${s.danger}`} onClick={logout}>
        <LogOut size={16} /> <span>{t("userMenu.logout")}</span>
      </button>
    </div>
  );
}