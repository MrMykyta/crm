// src/components/company/CompanyMenu/index.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import { Settings, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useGetCompanyQuery } from "../../../store/rtk/companyApi";
import { useSignedFileUrl } from "../../../hooks/useSignedFileUrl";
import s from "./CompanyMenu.module.css";

export default function CompanyMenu({ company: companyProp, onClose }) {
  const ref = useRef(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  // companyId из Redux
  const companyId = useSelector((s) => s.auth.companyId);
  const { data: companyRtk } = useGetCompanyQuery(undefined, {
    // если companyId ещё не установлен — хук сам пропустит запрос (prepareHeaders не поставит X-Company-Id)
    // и сделает его, как только setApiSession получит companyId после логина/refresh.
    skip: !companyId,
  });

  // итоговый источник данных
  const company = useMemo(() => companyRtk || companyProp || null, [companyRtk, companyProp]);

  // быстрый фолбэк: CSS-переменная из useBrandAndBackground
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

  const rawAvatar =
    company?.avatarUrl ||
    company?.logoUrl ||
    cssAvatar ||
    "";
  const { url: avatar, onError: onAvatarError } = useSignedFileUrl(rawAvatar);

  return (
    <div ref={ref} className={s.menu} role="menu" aria-label="Company menu">
      <div className={s.head}>
        <div className={s.logoWrap}>
          {avatar ? (
            <img src={avatar} alt={name} className={s.logo} onError={onAvatarError} />
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
