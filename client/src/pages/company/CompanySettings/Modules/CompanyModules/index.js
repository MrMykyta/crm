// src/pages/company/CompanySettings/CompanyModules/index.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { useGetCompanyQuery } from "../../../../../store/rtk/companyApi";
import { useTranslation } from "react-i18next";
import s from "./CompanyModules.module.css";

function Switch({ checked, onChange, color = "success", ariaLabel, disabled = false }) {
  const handleClick = () => { if (!disabled) onChange?.(!checked); };
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={checked}
      aria-disabled={disabled}
      disabled={disabled}
      className={`${s.switch} ${checked ? s.on : ""} ${color === "danger" ? s.red : s.green} ${disabled ? s.disabled : ""}`}
      onClick={handleClick}
    >
      <span className={s.knob} />
    </button>
  );
}

export default function CompanyModules() {
  const { t } = useTranslation();
  const companyId = useSelector((s) => s.auth.companyId);
  // прогрев /companies/:id (используем для ready-состояния/авторизации)
  const { isFetching } = useGetCompanyQuery(undefined, { skip: !companyId });

  const [loading, setLoading] = useState(true);
  const [mods, setMods] = useState([]);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      try {
        // когда появится настоящий бэкенд: подгружаем company.modules
        // сейчас — демо-конфиг
        setMods([
          {
            key: "crm",
            name: t("companySettings.module.crm"),
            icon: "🧩",
            enabled: true,
            extras: [
              { key: "crm-f1", label: "Доп. функция", enabled: true },
              { key: "crm-f2", label: "Доп. функция", enabled: false },
              { key: "crm-f3", label: "Доп. функция", enabled: false },
            ],
          },
          {
            key: "warehouse",
            name: t("companySettings.module.warehouse"),
            icon: "📦",
            enabled: true,
            extras: [
              { key: "wh-f1", label: "Партионный учёт", enabled: true },
              { key: "wh-f2", label: "Серийные номера", enabled: false },
            ],
          },
          { key: "automation", name: t("companySettings.module.automation"), icon: "⚙️", enabled: false, extras: [] },
          { key: "integrations", name: t("companySettings.module.integrations"), icon: "🔗", enabled: true, extras: [] },
          { key: "products", name: t("companySettings.module.catalog"), icon: "🏷️", enabled: true, extras: [] },
        ]);
      } finally {
        setLoading(false);
      }
    })();
  }, [companyId, t]);

  const persist = async (next) => {
    setMods(next);
    // TODO: вызвать RTK-мутацию saveCompanyModules({ modules: next })
  };

  const toggleMain = useCallback((mKey, v) => {
    const next = mods.map(m => {
      if (m.key !== mKey) return m;
      return {
        ...m,
        enabled: v,
        extras: v ? m.extras : m.extras.map(e => ({ ...e, enabled: false })),
      };
    });
    persist(next);
  }, [mods]);

  const toggleExtra = useCallback((mKey, eKey, v) => {
    const next = mods.map(m => {
      if (m.key !== mKey) return m;
      if (!m.enabled) return m;
      return {
        ...m,
        extras: m.extras.map(e => e.key === eKey ? { ...e, enabled: v } : e)
      };
    });
    persist(next);
  }, [mods]);

  const grid = useMemo(() => (
    <div className={s.grid}>
      {mods.map(m => {
        const locked = !m.enabled;
        return (
          <section key={m.key} className={s.card} aria-labelledby={`mod-${m.key}`}>
            <header className={s.cardHead}>
              <h3 id={`mod-${m.key}`} className={s.cardTitle}>{m.name}</h3>
            </header>

            <div className={s.iconBox}><div className={s.icon}>{m.icon ?? "🧩"}</div></div>

            <div className={s.mainToggle}>
              <Switch
                checked={m.enabled}
                onChange={(v)=>toggleMain(m.key, v)}
                color="success"
                ariaLabel={`${m.name}: основной переключатель`}
              />
            </div>

            {m.extras?.length > 0 && (
              <ul className={`${s.extras} ${locked ? s.locked : ""}`}>
                {m.extras.map(ex => (
                  <li key={ex.key} className={s.extraRow}>
                    <span className={s.extraLabel}>{ex.label}</span>
                    <Switch
                      checked={ex.enabled}
                      onChange={(v)=>toggleExtra(m.key, ex.key, v)}
                      color={ex.enabled ? "success" : "danger"}
                      ariaLabel={`${m.name}: ${ex.label}`}
                      disabled={locked}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  ), [mods, toggleMain, toggleExtra]);

  if (!companyId) return null;
  if (loading || isFetching) return <div className={s.skeleton}>Загрузка…</div>;

  return (
    <div className={s.wrap}>
      <div className={s.header}>
        <h2 className={s.title}>Модули</h2>
        <p className={s.subtitle}>Включайте нужные блоки и их дополнительные функции.</p>
      </div>
      {grid}
    </div>
  );
}