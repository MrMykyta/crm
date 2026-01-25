import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { Provider, useSelector, useDispatch } from "react-redux";
import store, { startRealtime } from "./store";

import AuthPage from "./pages/auth/AuthPage";
import VerifyEmail from "./components/auth/VerifyEmail";
import CompanySetupPage from "./pages/auth/CompanySetupPage";
import MainLayoutPage from "./pages/system/MainLayoutPage";
import ThemeProvider from "./Providers/ThemeProvider";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import UserProfilePage from "./pages/users/UserProfilePage";
import UserEntityPage from "./pages/users/UserEntityPage";

import LeadsPage from "./pages/CRM/Lead/LeadsPage";
import CounterpartiesPage from "./pages/CRM/Counterparty/CounterpartiesPage";
import CounterpartyDetailPage from "./pages/CRM/Counterparty/CounterpartyDetailPage";
import CompanySettings from "./pages/company/CompanySettings";
import CompanyModules from "./pages/company/CompanySettings/Modules/CompanyModules";
import CompanyDeals from "./pages/company/CompanySettings/Modules/CompanyDeals";
import CompanyInfoPage from "./pages/company/CompanyInfoPage";
import CompanyUsers from "./pages/company/CompanyUsers";
import InviteAcceptPage from "./pages/auth/InviteAcceptPage";
import CalendarPage from "./pages/system/CalendarPage";
import TaskPage from "./pages/system/TaskPage";
import TaskDetailPage from "./pages/system/TaskPage/TaskDetailPage";
import Dashboard from "./components/Dashboard";
import DealsListPage from "./pages/CRM/Deal/DealsListPage";
import DealDetailsPage from "./pages/CRM/Deal/DealDetailsPage";


import "./reset.css";

import { setChecked } from "./store/slices/bootstrapSlice";
import { sessionApi } from "./store/rtk/sessionApi";
import { sessionStorageHelpers } from "./store/rtk/sessionApi";
import ClientsPage from "./pages/CRM/Client/ClientsPage";
import LeadDetailPage from "./pages/CRM/Lead/LeadDetailPage";
import ClientDetailPage from "./pages/CRM/Client/ClientDetailPage";
import NotificationsPage from "./pages/system/NotificationsPage";
import ChatPage from "./pages/Chat";

// ===== Protected
const Protected = ({ children }) => {
  const checked = useSelector((s) => s.bootstrap?.checked);
  const token = useSelector((s) => s.auth?.accessToken);
  if (!checked) return null;
  return token ? children : <Navigate to="/auth" replace />;
};

function AppShell() {
  const dispatch = useDispatch();
  const checked = useSelector((s) => s.bootstrap?.checked);
  const token = useSelector((s) => s.auth?.accessToken);
  const companyId = useSelector((s) => s.auth?.companyId);
  const currentUser = useSelector((s) => s.auth?.currentUser);

  // 1) Тихий refresh при загрузке вкладки — ЧЕРЕЗ BODY (как требует твой контроллер)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rt = sessionStorageHelpers.loadRT();
        const cid = sessionStorageHelpers.loadCID();

        if (rt) {
          await dispatch(
            sessionApi.endpoints.refresh.initiate(
              { refreshToken: rt, companyId: cid, silent: true }, // <-- тело
              { forceRefetch: true }
            )
          )
            .unwrap()
            .catch(() => {});
        }
      } finally {
        if (alive) dispatch(setChecked(true));
      }
    })();
    return () => {
      alive = false;
    };
  }, [dispatch]);

  // 2) Запуск realtime, когда токен+companyId появились
  useEffect(() => {
    if (token && companyId) startRealtime();
  }, [token, companyId]);

  const rootElement = checked ? (
    <Navigate to={token ? "/main" : "/auth"} replace />
  ) : null;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={rootElement} />

        <Route path="/auth/*" element={<AuthPage />} />
        <Route path="/auth/verify" element={<VerifyEmail />} />
        <Route path="/auth/company-setup" element={<CompanySetupPage />} />
        <Route path="/auth/reset" element={<ResetPasswordPage />} />
        <Route path="/invite/accept" element={<InviteAcceptPage />} />

        <Route
          path="/main"
          element={
            <Protected>
              <MainLayoutPage />
            </Protected>
          }
        >
          <Route
            path="pulpit"
            element={<Dashboard currentUser={currentUser} />}
          />
          <Route
            path="user-profile"
            element={<UserProfilePage user={currentUser} />}
          />
          <Route path="notifications" element={<NotificationsPage />} />

          <Route path="company/details" element={<CompanyInfoPage />} />
          <Route path="company-settings" element={<CompanySettings />}>
            <Route index element={<Navigate to="modules" replace />} />
            <Route path="modules" element={<CompanyModules />} />
            <Route path="deals" element={<CompanyDeals />} />
          </Route>

          <Route path="crm/counterparties" element={<CounterpartiesPage />} />
          <Route
            path="crm/counterparties/:id"
            element={<CounterpartyDetailPage />}
          />
          <Route path="crm/leads" element={<LeadsPage />} />
          <Route path="crm/leads/:id" element={<LeadDetailPage />} />
          <Route path="crm/clients" element={<ClientsPage />} />
          <Route path="crm/clients/:id" element={<ClientDetailPage />} />

          <Route path="calendar" element={<CalendarPage />} />
          <Route path="deals" element={<DealsListPage />} />
          <Route path="deals/:id" element={<DealDetailsPage />} />
          <Route path="tasks" element={<TaskPage />} />
          <Route path="tasks/:id" element={<TaskDetailPage />} />

          <Route path="company-users" element={<CompanyUsers />} />
          <Route path="users/:userId" element={<UserEntityPage />} />


          <Route path="chat" element={<ChatPage />} />
        </Route>

        <Route
          path="*"
          element={<div style={{ padding: 24 }}>Not found</div>}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </Provider>
  );
}
