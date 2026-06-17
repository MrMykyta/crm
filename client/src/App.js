import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
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
import WarehouseWmsSettings from "./pages/company/CompanySettings/Modules/WarehouseWmsSettings";
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
import ComingSoonPage from "./components/common/ComingSoonPage/ComingSoonPage";
import { isWmsUiDocumentsEnabled, isWmsUiNavEnabled } from "./config/featureFlags";
import {
  getWmsDocumentsLegacyRoute,
  getWmsInventoryLegacyRoute,
  getWmsSetupLegacyRoute,
} from "./pages/wms/navigation/wmsUiNavigation";

const OrdersListPage = lazy(() => import('./pages/oms/Orders/OrdersListPage'));
const OffersListPage = lazy(() => import('./pages/oms/Offers/OffersListPage'));
const InvoicesListPage = lazy(() => import('./pages/oms/Invoices/InvoicesListPage'));
const OrderDetailPage = lazy(() => import('./pages/oms/Orders/OrderDetailPage'));
const InvoiceDetailPage = lazy(() => import('./pages/oms/Invoices/InvoiceDetailPage'));
const OrderEditorPage = lazy(() => import('./pages/oms/Orders/OrderEditorPage'));
const OfferDetailPage = lazy(() => import('./pages/oms/Offers/OfferDetailPage'));
const OfferEditorPage = lazy(() => import('./pages/oms/Offers/OfferEditorPage'));
const WmsOverviewPage = lazy(() => import('./pages/wms/WmsOverviewPage'));
const StockValuationReportPage = lazy(() => import('./pages/wms/StockValuationReportPage'));
const StockTurnoverReportPage = lazy(() => import('./pages/wms/StockTurnoverReportPage'));
const StockAsOfReportPage = lazy(() => import('./pages/wms/StockAsOfReportPage'));
const InventoryLedgerReportPage = lazy(() => import('./pages/wms/InventoryLedgerReportPage'));
const ReceiptsListPage = lazy(() => import('./pages/wms/ReceiptsListPage'));
const TransfersListPage = lazy(() => import('./pages/wms/TransfersListPage'));
const ShipmentsListPage = lazy(() => import('./pages/wms/ShipmentsListPage'));
const ReceiptDetailPage = lazy(() => import('./pages/wms/ReceiptDetailPage'));
const TransferDetailPage = lazy(() => import('./pages/wms/TransferDetailPage'));
const ShipmentDetailPage = lazy(() => import('./pages/wms/ShipmentDetailPage'));
const AdjustmentsListPage = lazy(() => import('./pages/wms/AdjustmentsListPage'));
const AdjustmentDetailPage = lazy(() => import('./pages/wms/AdjustmentDetailPage'));
const ReceiptCreatePage = lazy(() => import('./pages/wms/ReceiptCreatePage'));
const AdjustmentCreatePage = lazy(() => import('./pages/wms/AdjustmentCreatePage'));
const TransferCreatePage = lazy(() => import('./pages/wms/TransferCreatePage'));
const CycleCountsListPage = lazy(() => import('./pages/wms/CycleCountsListPage'));
const CycleCountCreatePage = lazy(() => import('./pages/wms/CycleCountCreatePage'));
const CycleCountDetailPage = lazy(() => import('./pages/wms/CycleCountDetailPage'));
const WarehousePrintPage = lazy(() => import('./pages/wms/WarehousePrintPage'));
const WmsDocumentsPage = lazy(() => import('./pages/wms/WmsDocumentsPage'));
const WmsInventoryShellPage = lazy(() => import('./pages/wms/WmsInventoryShellPage'));
const WmsSetupShellPage = lazy(() => import('./pages/wms/WmsSetupShellPage'));
const WarehousesPage = lazy(() => import('./pages/wms/WarehousesPage'));
const LocationsPage = lazy(() => import('./pages/wms/LocationsPage'));
const ParcelsPage = lazy(() => import('./pages/wms/ParcelsPage'));
const PicksPage = lazy(() => import('./pages/wms/PicksPage'));
const ShipmentCreatePage = lazy(() => import('./pages/wms/ShipmentCreatePage'));

const LazyPage = ({ children }) => (
  <Suspense fallback={<div style={{ padding: 24 }}>Loading...</div>}>
    {children}
  </Suspense>
);

const WmsNavRoute = ({ to, children }) => (
  isWmsUiNavEnabled() ? <Navigate to={to} replace /> : children
);

const WmsDocumentsRoute = ({ to, children }) => (
  isWmsUiNavEnabled() || isWmsUiDocumentsEnabled() ? <Navigate to={to} replace /> : children
);

const WmsCycleCountDocumentsRoute = ({ children }) => (
  isWmsUiDocumentsEnabled() ? <Navigate to="/main/wms/documents?type=CC" replace /> : children
);

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
            <Route path="warehouse" element={<WarehouseWmsSettings />} />
            {/* Backwards-compat: warehouse settings were previously nested under /modules. */}
            <Route
              path="modules/warehouse"
              element={<Navigate to="/main/company-settings/warehouse" replace />}
            />
            <Route path="deals" element={<CompanyDeals />} />
            <Route path="invoices" element={<InvoicesSettings />} />
            <Route path="warehouse-docs" element={<WarehouseDocumentSettings />} />
            <Route path="document-templates" element={<DocumentTemplatesPage />} />
            <Route path="document-templates/new" element={<DocumentTemplatesPage />} />
            <Route path="document-templates/:templateId/editor" element={<DocumentTemplateEditorPage />} />
            {/* UI-PLACEHOLDER-1: tabs already in the sidebar but pages not yet implemented. */}
            <Route path="lists" element={<ComingSoonPage titleKey="companySettings.lists" fallbackTitle="Lists" moduleName="company-settings.lists" />} />
            <Route path="offers" element={<ComingSoonPage titleKey="companySettings.offers" fallbackTitle="Offers" moduleName="company-settings.offers" />} />
            <Route path="orders" element={<ComingSoonPage titleKey="companySettings.orders" fallbackTitle="Orders" moduleName="company-settings.orders" />} />
            <Route path="automation" element={<ComingSoonPage titleKey="companySettings.automation" fallbackTitle="Automation" moduleName="company-settings.automation" />} />
            <Route path="integrations" element={<ComingSoonPage titleKey="companySettings.integrations" fallbackTitle="Integrations" moduleName="company-settings.integrations" />} />
            <Route path="catalog" element={<ComingSoonPage titleKey="companySettings.catalog" fallbackTitle="Catalog" moduleName="company-settings.catalog" />} />
            <Route path="other" element={<ComingSoonPage titleKey="companySettings.other" fallbackTitle="Other" moduleName="company-settings.other" />} />
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

          <Route path="oms/orders" element={<LazyPage><OrdersListPage /></LazyPage>} />
          <Route path="oms/orders/new" element={<LazyPage><OrderEditorPage /></LazyPage>} />
          <Route path="oms/orders/:id" element={<LazyPage><OrderDetailPage /></LazyPage>} />
          <Route path="oms/orders/:id/edit" element={<LazyPage><OrderEditorPage /></LazyPage>} />

          <Route path="oms/offers" element={<LazyPage><OffersListPage /></LazyPage>} />
          <Route path="oms/offers/new" element={<LazyPage><OfferEditorPage /></LazyPage>} />
          <Route path="oms/offers/:id" element={<LazyPage><OfferDetailPage /></LazyPage>} />
          <Route path="oms/offers/:id/edit" element={<LazyPage><OfferEditorPage /></LazyPage>} />

          <Route path="oms/invoices" element={<LazyPage><InvoicesListPage /></LazyPage>} />
          <Route path="oms/invoices/:id" element={<LazyPage><InvoiceDetailPage /></LazyPage>} />

          {/* UI-PLACEHOLDER-1: sidebar items present, pages planned but not yet implemented. */}
          <Route path="oms/receipts" element={<ComingSoonPage titleKey="menu.receipts" fallbackTitle="Receipts" moduleName="oms.receipts" />} />
          <Route path="oms/promotions" element={<ComingSoonPage titleKey="menu.promotions" fallbackTitle="Promotions" moduleName="oms.promotions" />} />
          <Route path="oms/coupons" element={<ComingSoonPage titleKey="menu.coupons" fallbackTitle="Coupons" moduleName="oms.coupons" />} />
          <Route path="oms/shipments" element={<ComingSoonPage titleKey="menu.shipments" fallbackTitle="Shipments" moduleName="oms.shipments" />} />
          <Route path="pim/services" element={<ComingSoonPage titleKey="menu.services" fallbackTitle="Services" moduleName="pim.services" />} />

          {/* Workspace Views entry point — same page for all ?view= values. */}
          <Route path="wms" element={<LazyPage><WmsNavRoute to="/main/wms/documents"><WmsOverviewPage /></WmsNavRoute></LazyPage>} />
          <Route path="wms/documents" element={<LazyPage><WmsDocumentsPage /></LazyPage>} />
          <Route path="wms/inventory" element={<LazyPage><WmsInventoryShellPage /></LazyPage>} />
          <Route path="wms/setup" element={<LazyPage><WmsSetupShellPage /></LazyPage>} />
          <Route path="wms/stock-balances" element={<Navigate to={getWmsInventoryLegacyRoute('balances')} replace />} />
          <Route path="wms/stock-moves" element={<Navigate to={getWmsInventoryLegacyRoute('stock-moves')} replace />} />
          <Route path="wms/warehouses" element={<LazyPage><WmsNavRoute to={getWmsSetupLegacyRoute('warehouses')}><WarehousesPage /></WmsNavRoute></LazyPage>} />
          <Route path="wms/locations" element={<LazyPage><WmsNavRoute to={getWmsSetupLegacyRoute('locations')}><LocationsPage /></WmsNavRoute></LazyPage>} />
          <Route path="wms/reservations" element={<Navigate to={getWmsInventoryLegacyRoute('reservations')} replace />} />
          <Route path="wms/lots" element={<Navigate to={getWmsInventoryLegacyRoute('lots')} replace />} />
          <Route path="wms/serials" element={<Navigate to={getWmsInventoryLegacyRoute('serials')} replace />} />
          <Route path="wms/parcels" element={<LazyPage><ParcelsPage /></LazyPage>} />
          <Route path="wms/picks" element={<LazyPage><PicksPage /></LazyPage>} />
          <Route path="wms/reports/stock-valuation" element={<LazyPage><WmsNavRoute to={getWmsInventoryLegacyRoute('reports')}><StockValuationReportPage /></WmsNavRoute></LazyPage>} />
          <Route path="wms/reports/stock-turnover" element={<LazyPage><StockTurnoverReportPage /></LazyPage>} />
          <Route path="wms/reports/stock-as-of" element={<LazyPage><StockAsOfReportPage /></LazyPage>} />
          <Route path="wms/reports/inventory-ledger" element={<LazyPage><InventoryLedgerReportPage /></LazyPage>} />
          <Route path="wms/receipts" element={<LazyPage><WmsDocumentsRoute to={getWmsDocumentsLegacyRoute('receipts')}><ReceiptsListPage /></WmsDocumentsRoute></LazyPage>} />
          <Route path="wms/receipts/new" element={<LazyPage><ReceiptCreatePage /></LazyPage>} />
          <Route path="wms/receipts/:id/print" element={<LazyPage><WarehousePrintPage kind="receipt" /></LazyPage>} />
          <Route path="wms/receipts/:id" element={<LazyPage><ReceiptDetailPage /></LazyPage>} />
          <Route path="wms/transfers" element={<LazyPage><WmsDocumentsRoute to={getWmsDocumentsLegacyRoute('transfers')}><TransfersListPage /></WmsDocumentsRoute></LazyPage>} />
          <Route path="wms/transfers/new" element={<LazyPage><TransferCreatePage /></LazyPage>} />
          <Route path="wms/transfers/:id/print" element={<LazyPage><WarehousePrintPage kind="transfer" /></LazyPage>} />
          <Route path="wms/transfers/:id" element={<LazyPage><TransferDetailPage /></LazyPage>} />
          <Route path="wms/shipments" element={<LazyPage><WmsDocumentsRoute to={getWmsDocumentsLegacyRoute('shipments')}><ShipmentsListPage /></WmsDocumentsRoute></LazyPage>} />
          <Route path="wms/shipments/new" element={<LazyPage><ShipmentCreatePage /></LazyPage>} />
          <Route path="wms/shipments/:id/print" element={<LazyPage><WarehousePrintPage kind="shipment" /></LazyPage>} />
          <Route path="wms/shipments/:id" element={<LazyPage><ShipmentDetailPage /></LazyPage>} />
          <Route path="wms/adjustments" element={<LazyPage><WmsDocumentsRoute to={getWmsDocumentsLegacyRoute('adjustments')}><AdjustmentsListPage /></WmsDocumentsRoute></LazyPage>} />
          <Route path="wms/adjustments/new" element={<LazyPage><AdjustmentCreatePage /></LazyPage>} />
          <Route path="wms/adjustments/:id/print" element={<LazyPage><WarehousePrintPage kind="adjustment" /></LazyPage>} />
          <Route path="wms/adjustments/:id" element={<LazyPage><AdjustmentDetailPage /></LazyPage>} />
          <Route path="wms/cycle-counts" element={<LazyPage><WmsCycleCountDocumentsRoute><CycleCountsListPage /></WmsCycleCountDocumentsRoute></LazyPage>} />
          <Route path="wms/cycle-counts/new" element={<LazyPage><CycleCountCreatePage /></LazyPage>} />
          <Route path="wms/cycle-counts/:id/print" element={<LazyPage><WarehousePrintPage kind="cycleCount" /></LazyPage>} />
          <Route path="wms/cycle-counts/:id" element={<LazyPage><CycleCountDetailPage /></LazyPage>} />

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
