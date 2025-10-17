import { useEffect, useRef } from "react";
import { Building2, Settings, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import s from "./CompanyMenu.module.css";

export default function CompanyMenu({ company, onClose }) {
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose?.(); };
    const onEsc = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [onClose]);

  const goDetails = () => { onClose?.(); navigate("/main/company/details"); };
  const goSettings = () => { onClose?.(); navigate("/main/company-settings"); };

  const name = company?.shortName || company?.name || "Company";
  const sub  = [company?.domain, company?.vat].filter(Boolean).join(" • ");
  const initials = (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");


  return (
    <div ref={ref} className={s.menu} role="menu" aria-label="Company menu">
      <div className={s.head}>
        <div className={s.logoWrap}>
          {company?.logoUrl ? (
            <img src={company.logoUrl} alt={name} className={s.logo} />
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
        <Info size={16}/><span>Podgląd firmy</span>
      </button>
      <button className={s.item} onClick={goSettings}>
        <Settings size={16}/><span>Ustawienia firmy</span>
      </button>
    </div>
  );
}