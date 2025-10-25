import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import s from './MainLayout.module.css';
import Sidebar from '../../components/layout/Sidebar';
import Topbar from '../../components/layout/Topbar';
import { MENU } from '../../config/menu';
import { TopbarProvider } from '../../Providers/TopbarProvider';

export default function MainLayoutPage({ currentUser, onLogout }) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [hasWallpaper, setHasWallpaper] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // корректно считываем --custom-bg-layer после маунта + реагируем на изменения
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkWallpaper = () => {
      const val = getComputedStyle(document.documentElement)
        .getPropertyValue('--custom-bg-layer')
        .trim();
      setHasWallpaper(Boolean(val) && val !== 'none');
    };

    // первый тик — когда стили уже применились
    const raf = requestAnimationFrame(checkWallpaper);

    // на случай ленивой загрузки/переключения тем
    window.addEventListener('load', checkWallpaper, { once: true });

    // реагируем на изменение class/style у <html>
    const observer = new MutationObserver(checkWallpaper);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    // если переменная меняется из JS через setProperty
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