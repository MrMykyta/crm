import { NavLink, Outlet } from "react-router-dom";
import { useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTopbar } from "../../../Providers/TopbarProvider";
import useAclPermissions, { hasAclRequirements } from "../../../hooks/useAclPermissions";
import s from "./CompanySettings.module.css";

// Компонент CompanySettings: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function CompanySettings(){
  const { setTitle, reset } = useTopbar(); // ← получаем методы провайдера
  const { t } = useTranslation();
  const acl = useAclPermissions();


  useEffect(() => {
    setTitle(t("companySettings.title"));  // можно ключ перевода: 'company.settings'
    return () => reset();            // при выходе вернуть дефолтное значение
  }, [reset, setTitle, t]);

   const items = useMemo(() => [
    { key: "modules",      label: t("companySettings.modules"),      to: "modules", requiredPermission: "company:settings:read" },
    { key: "lists",        label: t("companySettings.lists"),        to: "lists" },
    { key: "deals",        label: t("companySettings.deals"),        to: "deals", requiredPermission: "company:settings:read" },
    { key: "offers",       label: t("companySettings.offers"),       to: "offers" },
    { key: "orders",       label: t("companySettings.orders"),       to: "orders" },
    { key: "invoices",     label: t("companySettings.invoices"),     to: "invoices", requiredPermission: "company:settings:read" },
    { key: "warehouseDoc", label: t("companySettings.warehouseDoc"), to: "warehouse-docs", requiredPermission: "company:settings:read" },
    { key: "automation",   label: t("companySettings.automation"),   to: "automation" },
    { key: "integrations", label: t("companySettings.integrations"), to: "integrations" },
    { key: "catalog",      label: t("companySettings.catalog"),      to: "catalog" },
    { key: "warehouse",    label: t("companySettings.warehouse"),    to: "warehouse", requiredPermission: "company:settings:read" },
    { key: "other",        label: t("companySettings.other"),        to: "other" },
  ].filter((item) => hasAclRequirements(acl, item)), [acl, t]);

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
