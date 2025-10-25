import { NavLink, Outlet } from "react-router-dom";
import { useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTopbar } from "../../../Providers/TopbarProvider";
import s from "./CompanySettings.module.css";

export default function CompanySettings(){
  const { setTitle, setSubtitle, reset } = useTopbar(); // ← получаем методы провайдера
  const { t } = useTranslation();


  useEffect(() => {
    setTitle(t("companySettings.title"));  // можно ключ перевода: 'company.settings'
    return () => reset();            // при выходе вернуть дефолтное значение
  }, [setTitle, setSubtitle, reset]);

   const items = useMemo(() => [
    { key: "modules",      label: t("companySettings.modules"),      to: "modules" },
    { key: "lists",        label: t("companySettings.lists"),        to: "lists" },
    { key: "deals",        label: t("companySettings.deals"),        to: "deals" },
    { key: "offers",       label: t("companySettings.offers"),       to: "offers" },
    { key: "orders",       label: t("companySettings.orders"),       to: "orders" },
    { key: "invoices",     label: t("companySettings.invoices"),     to: "invoices" },
    { key: "warehouseDoc", label: t("companySettings.warehouseDoc"), to: "warehouse-docs" },
    { key: "automation",   label: t("companySettings.automation"),   to: "automation" },
    { key: "integrations", label: t("companySettings.integrations"), to: "integrations" },
    { key: "catalog",      label: t("companySettings.catalog"),      to: "catalog" },
    { key: "warehouse",    label: t("companySettings.warehouse"),    to: "warehouse" },
    { key: "other",        label: t("companySettings.other"),        to: "other" },
  ], [t]);

  return (
    <div className={s.wrap}>
      <aside className={s.menu}>
        <div className={s.menuPanel}>
          {items.map(it=>(
            <NavLink
              key={it.key}
              to={it.to}
              className={({isActive}) => `${s.item} ${isActive ? s.active : ""}`}
            >
              {it.label}
            </NavLink>
          ))}
        </div>
      </aside>

      <main className={s.content}>
        <div className={s.contentPanel}>
          <div className={s.scrollArea}>
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}