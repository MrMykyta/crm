// src/components/company/CompanyMenu/index.jsx
import { useEffect, useRef, useState } from "react";
import { Settings, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import s from "./CompanyMenu.module.css";

export default function CompanyMenu({ company, onClose }) {
  const ref = useRef(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  // быстрый фолбэк: пробуем вытащить --company-avatar-url, если уже прогрето хуком
  const [cssAvatar, setCssAvatar] = useState(() => {
    try {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue("--company-avatar-url")
        .trim();
      const m = raw && raw.match(/^url\("(.+)"\)$/);
      return m ? m[1] : "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    };
    const onEsc = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);

    // слушаем событие от useBrandAndBackground, чтобы обновить аватар моментально
    const onAvatarReady = (e) => setCssAvatar(e?.detail?.url || "");
    window.addEventListener("company:avatar-ready", onAvatarReady);

    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
      window.removeEventListener("company:avatar-ready", onAvatarReady);
    };
  }, [onClose]);

  const goDetails = () => { onClose?.(); navigate("/main/company/details"); };
  const goSettings = () => { onClose?.(); navigate("/main/company-settings"); };

  const name = company?.shortName || company?.name || "Company";
  const sub  = [company?.domain, company?.vat].filter(Boolean).join(" • ");
  const initials = (name || "")
    .split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");

  // порядок фолбэков на случай, если чего-то нет
  const avatar =
    company?.avatarUrl ||
    company?.logoUrl ||
    cssAvatar ||
    "";

  return (
    <div ref={ref} className={s.menu} role="menu" aria-label="Company menu">
      <div className={s.head}>
        <div className={s.logoWrap}>
          {avatar ? (
            <img src={avatar} alt={name} className={s.logo} />
          ) : (
            <div className={s.logoFallback}>{(initials || "C").toUpperCase()}</div>
          )}
        </div>
        <div className={s.meta}>
          <div className={s.name} title={name}>{name}</div>
          {sub && <div className={s.sub} title={sub}>{sub}</div>}
        </div>
      </div>

      <button className={s.item} onClick={goDetails}>
        <Info size={16} /><span>{t("companyMenu.info")}</span>
      </button>
      <button className={s.item} onClick={goSettings}>
        <Settings size={16} /><span>{t("companyMenu.settings")}</span>
      </button>
    </div>
  );
}