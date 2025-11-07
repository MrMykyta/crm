import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import s from './MainLayout.module.css';
import Sidebar from '../../../components/layout/Sidebar';
import Topbar from '../../../components/layout/Topbar';
import { MENU } from '../../../config/menu';
import { TopbarProvider } from '../../../Providers/TopbarProvider';
import { useLogoutMutation } from '../../../store/rtk/sessionApi';

export default function MainLayoutPage() {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [hasWallpaper, setHasWallpaper] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // берем юзера из Redux
  const currentUser = useSelector(s => s.auth?.currentUser);

  const [logout] = useLogoutMutation();

  const handleLogout = async () => {
    try { await logout().unwrap(); } catch {}
    navigate('/auth', { replace: true });
  };

  // корректно считываем --custom-bg-layer после маунта + реагируем на изменения
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkWallpaper = () => {
      const val = getComputedStyle(document.documentElement)
        .getPropertyValue('--custom-bg-layer')
        .trim();
      setHasWallpaper(Boolean(val) && val !== 'none');
    };

    const raf = requestAnimationFrame(checkWallpaper);
    window.addEventListener('load', checkWallpaper, { once: true });

    const observer = new MutationObserver(checkWallpaper);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener?.('change', checkWallpaper);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      mediaQuery.removeEventListener?.('change', checkWallpaper);
    };
  }, []);

  const pageTitle = useMemo(() => {
    const path = location.pathname.replace(/\/+$/, '');
    const flat = MENU.filter(i => i.type === 'item' && i.route);
    const match = flat.find(i => path && path.startsWith(i.route));
    return match ? (t ? t(match.labelKey) : match.labelKey) : (t ? t('menu.pulpit') : 'Рабочий стол');
  }, [location.pathname, t]);

  return (
    <div className={`${s.bg} ${hasWallpaper ? s.noBlobs : ''}`}>
      <div className={`${s.shell} ${collapsed ? s.collapsed : ''}`}>
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(v => !v)}
          onNavigate={(route) => route && navigate(route)}
          t={t}
        />
        <div className={s.content}>
          <TopbarProvider defaultTitle={pageTitle}>
            <Topbar
              collapsed={collapsed}
              title={pageTitle}
              user={currentUser}
              onLogout={handleLogout}
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