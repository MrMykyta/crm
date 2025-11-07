// src/components/layout/UserMenu/UserMenu.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import { useSelector } from "react-redux";
import { User2, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useLogoutMutation } from "../../../store/rtk/sessionApi";
import { selectUser, selectAvatarUrl } from "../../../store/slices/authSlice";
import s from "./UserMenu.module.css";

export default function UserMenu({ onClose, onLogout }) {
  const ref = useRef(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const user = useSelector(selectUser);
  const avatarUrl = useSelector(selectAvatarUrl);

  const [logout] = useLogoutMutation();
  const [hasImg, setHasImg] = useState(Boolean(avatarUrl));

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose?.(); };
    const onEsc = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [onClose]);

  useEffect(() => { setHasImg(Boolean(avatarUrl)); }, [avatarUrl]);

  const goProfile = () => { onClose?.(); navigate("/main/user-profile"); };

  const doLogout = async () => {
    onClose?.();
    try { await logout().unwrap(); } catch {}
    if (onLogout) { try { await onLogout(); } catch {} ; return; }
    navigate("/auth", { replace: true });
  };

  const initials = useMemo(() => {
    const f = (user?.firstName?.[0] || "U").toUpperCase();
    const l = (user?.lastName?.[0] || "").toUpperCase();
    return `${f}${l}`;
  }, [user?.firstName, user?.lastName]);

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User";
  const email = user?.email || user?.emailNorm || user?.emailRaw || "";

  return (
    <div ref={ref} className={s.menu} role="menu">
      <div className={s.head}>
        <div className={s.avatar} data-has-img={hasImg ? "1" : "0"}>
          {hasImg ? (
            <img
              className={s.avatarImg}
              src={avatarUrl}
              alt={fullName}
              onError={() => setHasImg(false)}
            />
          ) : (
            <div className={s.initials}>{initials}</div>
          )}
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

      <button className={`${s.item} ${s.danger}`} onClick={doLogout}>
        <LogOut size={16} /> <span>{t("userMenu.logout")}</span>
      </button>
    </div>
  );
}