export const WMS_DOCUMENT_TYPES = ['PZ', 'WZ', 'MM', 'RW', 'PW', 'CC'];

export const WMS_DOCUMENT_CREATE_ROUTES = {
  PZ: '/main/wms/receipts/new',
  WZ: '/main/wms/shipments/new',
  MM: '/main/wms/transfers/new',
  RW: '/main/wms/adjustments/new?type=RW',
  PW: '/main/wms/adjustments/new?type=PW',
  CC: '/main/wms/cycle-counts/new',
};

export const WMS_DOCUMENT_TYPE_VIEWS = WMS_DOCUMENT_TYPES.map((type) => ({
  key: type.toLowerCase(),
  label: type,
  type,
  to: `/main/wms/documents?type=${type}`,
}));

export const WMS_DOCUMENT_WORKFLOW_VIEWS = [
  { key: 'all', label: 'All Documents', to: '/main/wms/documents' },
  { key: 'drafts', label: 'Drafts', to: '/main/wms/documents?view=drafts' },
  { key: 'needsAction', label: 'Needs Action', to: '/main/wms/documents?view=needs-action' },
  { key: 'postedToday', label: 'Posted Today', to: '/main/wms/documents?view=posted-today' },
];

export const WMS_DOCUMENT_NAVIGATION_GROUPS = [
  {
    key: 'warehouse-documents',
    labelKey: 'wms.documents.navigation.groups.warehouseDocuments',
    items: [
      { key: 'all', labelKey: 'wms.documents.navigation.views.all', to: '/main/wms/documents' },
      { key: 'drafts', labelKey: 'wms.documents.navigation.views.drafts', to: '/main/wms/documents?view=drafts' },
      { key: 'needs-action', labelKey: 'wms.documents.navigation.views.needsAction', to: '/main/wms/documents?view=needs-action' },
      { key: 'posted-today', labelKey: 'wms.documents.navigation.views.postedToday', to: '/main/wms/documents?view=posted-today' },
    ],
  },
  {
    key: 'by-type',
    labelKey: 'wms.documents.navigation.groups.byType',
    items: [
      { key: 'PZ', labelKey: 'wms.documents.navigation.types.PZ', to: '/main/wms/documents?type=PZ' },
      { key: 'WZ', labelKey: 'wms.documents.navigation.types.WZ', to: '/main/wms/documents?type=WZ' },
      {
        key: 'MM',
        labelKey: 'wms.documents.navigation.types.MM',
        to: '/main/wms/documents?type=MM',
        disabledReasonKey: 'wms.documents.mmGuard.title',
      },
      { key: 'RW', labelKey: 'wms.documents.navigation.types.RW', to: '/main/wms/documents?type=RW' },
      { key: 'PW', labelKey: 'wms.documents.navigation.types.PW', to: '/main/wms/documents?type=PW' },
      { key: 'CC', labelKey: 'wms.documents.navigation.types.CC', to: '/main/wms/documents?type=CC' },
    ],
  },
];

export const WMS_INVENTORY_TABS = [
  { key: 'balances', label: 'Balances', to: '/main/wms/inventory?tab=balances' },
  { key: 'moves', label: 'Stock Moves', to: '/main/wms/inventory?tab=moves' },
  { key: 'reservations', label: 'Reservations', to: '/main/wms/inventory?tab=reservations' },
  { key: 'lots', label: 'Lots', to: '/main/wms/inventory?tab=lots' },
  { key: 'serials', label: 'Serials', to: '/main/wms/inventory?tab=serials' },
  { key: 'locations', label: 'Locations Stock', to: '/main/wms/inventory?tab=locations' },
  { key: 'reports', label: 'Reports', to: '/main/wms/inventory?tab=reports' },
];

export const WMS_SETUP_TABS = [
  { key: 'warehouses', label: 'Warehouses', to: '/main/wms/setup?tab=warehouses' },
  { key: 'locations', label: 'Locations', to: '/main/wms/setup?tab=locations' },
  { key: 'settings', label: 'Settings', to: '/main/wms/setup?tab=settings' },
];

export function getWmsDocumentCreateRoute(type) {
  return WMS_DOCUMENT_CREATE_ROUTES[String(type || '').toUpperCase()] || null;
}

export function getWmsDocumentsLegacyRoute(kind) {
  const normalized = String(kind || '').toLowerCase();
  if (normalized === 'receipts') return '/main/wms/documents?type=PZ';
  if (normalized === 'shipments') return '/main/wms/documents?type=WZ';
  if (normalized === 'transfers') return '/main/wms/documents?type=MM';
  if (normalized === 'adjustments') return '/main/wms/documents?type=RW,PW';
  if (normalized === 'cycle-counts') return '/main/wms/documents?type=CC';
  return '/main/wms/documents';
}

export function getWmsInventoryLegacyRoute(kind) {
  const normalized = String(kind || '').toLowerCase();
  if (normalized === 'stock-moves') return '/main/wms/inventory?tab=moves';
  if (normalized === 'reservations') return '/main/wms/inventory?tab=reservations';
  if (normalized === 'lots') return '/main/wms/inventory?tab=lots';
  if (normalized === 'serials') return '/main/wms/inventory?tab=serials';
  if (normalized === 'locations-stock') return '/main/wms/inventory?tab=locations';
  if (normalized === 'reports') return '/main/wms/inventory?tab=reports&report=valuation';
  return '/main/wms/inventory?tab=balances';
}

export function getWmsSetupLegacyRoute(kind) {
  const normalized = String(kind || '').toLowerCase();
  if (normalized === 'locations') return '/main/wms/setup?tab=locations';
  if (normalized === 'settings') return '/main/wms/setup?tab=settings';
  return '/main/wms/setup?tab=warehouses';
}

export function normalizeWmsTab(value, allowed, fallback) {
  const next = String(value || '').toLowerCase();
  return allowed.some((tab) => tab.key === next) ? next : fallback;
}
