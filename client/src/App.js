import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

import AuthPage from './pages/auth/AuthPage';
import VerifyEmail from './components/auth/VerifyEmail';
import CompanySetupPage from './pages/auth/CompanySetupPage';
import MainLayoutPage from './pages/MainLayoutPage';
import ThemeProvider from './Providers/ThemeProvider';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import UserSettingsPage from './pages/users/UserSettingsPage';
import UserProfilePage from './pages/users/UserProfilePage';

//-------------------CRM Pages----------------------------------
import LeadsPage from './pages/CRM/LeadsPage';
import CounterpartiesPage from './pages/CRM/CounterpartiesPage';
import CounterpartyDetailPage from './pages/CRM/CounterpartyDetailPage';

//-------------------Company Pages----------------------------------
import CompanySettings from './pages/company/CompanySettings';
import CompanyModules from './pages/company/CompanySettings/Modules/CompanyModules';
import CompanyDeals from './pages/company/CompanySettings/Modules/CompanyDeals';
import CompanyInfoPage from './pages/company/CompanyInfoPage';


//-------------------Systems Pages----------------------------------
import CompanyUsers from './pages/company/CompanyUsers';
import InviteAcceptPage from './pages/auth/InviteAcceptPage';

import Dashboard from './components/Dashboard';

import './reset.css';
// import './styles/base.css'

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

          <Route path="/invite/accept" element={<InviteAcceptPage setUser={setUser} />} />

          {/* приложение — защищено и получает currentUser + onLogout */}
          <Route
            path="/main"
            element={
              <Protected>
                <MainLayoutPage currentUser={user} onLogout={handleLogout} />
              </Protected>
            }
          >

            <Route path="pulpit" element={<Dashboard currentUser={user} />} />

            <Route path="/main/company/details" element={<CompanyInfoPage />} />
            <Route path="/main/company-settings" element={<CompanySettings />}>
              <Route index element={<Navigate to="modules" replace />} />
              <Route path="modules" element={<CompanyModules />} />
              <Route path="deals" element={<CompanyDeals />} />
              
              {/* <Route path="lists" element={<Stub title="Списки" />} />
              
              <Route path="offers" element={<Stub title="Предложения" />} />
              <Route path="orders" element={<Stub title="Заказы" />} />
              <Route path="invoices" element={<Stub title="Фактуры" />} />
              <Route path="warehouse-docs" element={<Stub title="Складские документы" />} />
              <Route path="automation" element={<Stub title="Автоматизация" />} />
              <Route path="integrations" element={<Stub title="Интеграции" />} />
              <Route path="catalog" element={<Stub title="Продукты/Услуги" />} />
              <Route path="warehouse" element={<Stub title="Склад" />} />
              <Route path="other" element={<Stub title="Прочее" />} /> */}
            </Route>

            {/* CRM */}
            <Route path="crm/counterparties" element={<CounterpartiesPage />} />
            <Route path="crm/counterparties/:id" element={<CounterpartyDetailPage />} />
            <Route path="crm/leads" element={<LeadsPage />} />

            <Route path="user-settings" element={<UserSettingsPage user={user} />} />
            <Route path="user-profile" element={<UserProfilePage user={user}/>} />

            <Route path="company-users" element={<CompanyUsers />} />
          </Route>
          <Route path="*" element={<div style={{ padding: 24 }}>Not found</div>} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}