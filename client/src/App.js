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
import InvoicesSettings from "./pages/company/CompanySettings/Modules/InvoicesSettings";
import WarehouseDocumentSettings from "./pages/company/CompanySettings/Modules/WarehouseDocumentSettings";
import DocumentTemplatesPage from "./pages/company/CompanySettings/Modules/DocumentTemplatesPage";
import DocumentTemplateEditorPage from "./pages/company/CompanySettings/Modules/DocumentTemplateEditorPage";
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
import NotesPage from "./pages/system/NotesPage";
import ContactsPage from "./pages/CRM/Contact/ContactsPage";
import ContactDetailPage from "./pages/CRM/Contact/ContactDetailPage";
import ProductsPage from "./pages/PIM/Product/ProductsPage";
import ProductDetailPage from "./pages/PIM/Product/ProductDetailPage";
import DocumentCreatePage from "./pages/documents/DocumentCreatePage";
import DocumentDetailsPage from "./pages/documents/DocumentDetailsPage";
import DocumentsListPage from "./pages/documents/DocumentsListPage";

// ===== Protected
const Protected = ({ children }) => {
  const checked = useSelector((s) => s.bootstrap?.checked);
  const token = useSelector((s) => s.auth?.accessToken);
  if (!checked) return null;
  return token ? children : <Navigate to="/auth" replace />;
};

// AppShell: вспомогательная логика модуля.
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
    <Navigate to={token ? "/main/pulpit" : "/auth"} replace />
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
            <Route path="invoices" element={<InvoicesSettings />} />
            <Route path="warehouse-docs" element={<WarehouseDocumentSettings />} />
            <Route path="document-templates" element={<DocumentTemplatesPage />} />
            <Route path="document-templates/new" element={<DocumentTemplatesPage />} />
            <Route path="document-templates/:templateId/editor" element={<DocumentTemplateEditorPage />} />
          </Route>

          <Route path="counterparties" element={<CounterpartiesPage />} />
          <Route
            path="counterparties/:id"
            element={<CounterpartyDetailPage />}
          />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="leads/:id" element={<LeadDetailPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="clients/:id" element={<ClientDetailPage />} />

          <Route path="calendar" element={<CalendarPage />} />
          <Route path="deals" element={<DealsListPage />} />
          <Route path="deals/:id" element={<DealDetailsPage />} />
          <Route path="tasks" element={<TaskPage />} />
          <Route path="tasks/:id" element={<TaskDetailPage />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="contacts/:id" element={<ContactDetailPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/:id" element={<ProductDetailPage />} />
          <Route path="documents" element={<DocumentsListPage />} />
          <Route path="documents/create" element={<DocumentCreatePage />} />
          <Route path="documents/:id" element={<DocumentDetailsPage />} />
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

// App: вспомогательная логика модуля.
export default function App() {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </Provider>
  );
}
