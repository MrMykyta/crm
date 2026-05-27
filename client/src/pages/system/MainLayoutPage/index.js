// src/pages/MainLayout/MainLayoutPage.jsx (путь у тебя свой, я по твоему примеру)

import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';

import s from './MainLayout.module.css';
import Sidebar from '../../../components/layout/Sidebar';
import Topbar from '../../../components/layout/Topbar';
import { MENU } from '../../../config/menu';
import { TopbarProvider } from '../../../Providers/TopbarProvider';
import { useLogoutMutation } from '../../../store/rtk/sessionApi';
import { useGetMeQuery } from '../../../store/rtk/userApi';
import { applyUserPatch } from '../../../store/slices/authSlice';

// 🔌 добавляем
import { initSocket } from '../../../sockets/io';
import { useChatSocket } from '../../../sockets/useChatSocket';

// Компонент MainLayoutPage: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function MainLayoutPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [collapsed, setCollapsed] = useState(false);
  const [hasWallpaper, setHasWallpaper] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // берем юзера из Redux
  const currentUser = useSelector(s => s.auth?.currentUser);
  const accessToken = useSelector(s => s.auth?.accessToken);
  const companyId = useSelector(s => s.auth?.companyId);
  const activeRoomId = useSelector(s => s.chat?.activeRoomId);

  const [logout] = useLogoutMutation();

  const { data: me, refetch: refetchMe } = useGetMeQuery(undefined, {
    skip: !accessToken,
  });

    // handleLogout: обработчик пользовательского действия.
const handleLogout = async () => {
    try { await logout().unwrap(); } catch {}
    navigate('/auth', { replace: true });
  };

  // ⚡ глобальная инициализация socket.io по accessToken
  useEffect(() => {
    if (!accessToken) return;
    initSocket(accessToken);
  }, [accessToken]);

  // Перезапросить /me при смене токена/компании (после company-setup)
  useEffect(() => {
    if (!accessToken) return;
    refetchMe();
  }, [accessToken, companyId, refetchMe]);

  // Синхронизируем /me в authSlice, чтобы Topbar/UserMenu не были пустыми
  useEffect(() => {
    if (me?.id) dispatch(applyUserPatch(me));
  }, [me?.id, dispatch]);

  // 🎧 глобальный чат-сокет: слушает всё, JOIN делает только для activeRoomId
  useChatSocket(activeRoomId);

  // корректно считываем --custom-bg-layer после маунта + реагируем на изменения
  useEffect(() => {
    if (typeof window === 'undefined') return;

        // checkWallpaper: вспомогательная логика компонента.
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
    return match
      ? (t ? t(match.labelKey) : match.labelKey)
      : (t ? t('menu.pulpit') : 'Рабочий стол');
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
              user={me || currentUser}
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
