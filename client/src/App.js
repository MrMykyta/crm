import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

import AuthPage from './pages/AuthPage';
import VerifyEmail from './components/VerifyEmail';
import CompanySetupPage from './pages/CompanySetupPage';
import MainLayoutPage from './pages/MainLayoutPage';
import ThemeProvider from './Providers/ThemeProvider';
import ResetPasswordPage from './pages/ResetPasswordPage';
import UserSettingsPage from './pages/UserSettingsPage';
import UserProfilePage from './pages/UserProfilePage';

import Dashboard from './components/Dashboard';

import './reset.css';

/** Простая защита по accessToken */
const Protected = ({ children }) => {
  const token = localStorage.getItem('accessToken');
  if(token){
    return children;
  }else{
    localStorage.removeItem('user');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('companyId');
    return <Navigate to="/auth" replace />;
  }
};

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  // sync user <-> localStorage
  useEffect(() => {
    if (user) localStorage.setItem('user', JSON.stringify(user));
    else localStorage.removeItem('user');
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('companyId');
    localStorage.removeItem('user');
    setUser(null);
  };

  const hasToken = !!localStorage.getItem('accessToken');

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* умный редирект с корня */}
          <Route path="/" element={<Navigate to={hasToken ? "/main" : "/auth"} replace />} />

          {/* auth-стек получает setUser, чтобы SignIn мог поднять user наверх */}
          <Route path="/auth/*" element={<AuthPage setUser={setUser} />} />
          <Route path="/auth/verify" element={<VerifyEmail />} />
          <Route path="/auth/company-setup" element={<CompanySetupPage setUser={setUser}/>} />
          <Route path="/auth/reset" element={<ResetPasswordPage />} />

          {/* приложение — защищено и получает currentUser + onLogout */}
          <Route
            path="/main"
            element={
              <Protected>
                <MainLayoutPage currentUser={user} onLogout={handleLogout} />
              </Protected>
            }
          >

            <Route index element={<Dashboard currentUser={user} />} />
            <Route path="user-settings" element={<UserSettingsPage user={user} />} />
            <Route path="user-profile" element={<UserProfilePage user={user}/>} />
          </Route>
          <Route path="*" element={<div style={{ padding: 24 }}>Not found</div>} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}