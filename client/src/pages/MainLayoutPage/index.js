import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import s from './MainLayout.module.css';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { MENU } from '../../config/menu';
import { TopbarProvider } from '../../Providers/TopbarProvider';

export default function MainLayoutPage({ currentUser, onLogout }) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Заголовок слева в топбаре (как у тебя было)
  const pageTitle = useMemo(() => {
    const path = location.pathname.replace(/\/+$/, '');
    const flat = MENU.filter(i => i.type === 'item' && i.route);
    const match = flat.find(i => path && path.startsWith(i.route));
    return match ? (t ? t(match.labelKey) : match.labelKey) : (t ? t('menu.pulpit') : 'Рабочий стол');
  }, [location.pathname, t]);

  return (
    <div className={s.bg}>
      <div className={`${s.shell} ${collapsed ? s.collapsed : ''}`}>
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(v => !v)}
          onNavigate={(route) => route && navigate(route)}
          t={t}
        />
        <div className={s.content}>
          {/* ↓↓↓ ВАЖНО: провайдер оборачивает Topbar + Outlet.
              defaultTitle берём из твоего pageTitle, чтобы переводы не сломать */}
          <TopbarProvider defaultTitle={pageTitle}>
            <Topbar
              collapsed={collapsed}
              // title теперь берётся из контекста, проп оставим для бэкапа
              title={pageTitle}
              user={currentUser}
              onSearch={(q)=>{}}
              onNotifications={()=>{}}
              onLogout={onLogout}
            />
            <div className={s.body}>
              <Outlet />
            </div>
          </TopbarProvider>
        </div>
      </div>
    </div>
  );
}