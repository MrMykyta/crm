'use strict';

// System views for module `wms.documents` (Phase 1).
// Spec: WORKSPACE_VIEWS_MVP_SPEC.md §2.2.
//
// Each entry is created by `ensureSystemViewsForCompany` with `findOrCreate({ company_id, module, key })`.
// `is_locked=true` is enforced by the service (not stored here).
// Dynamic placeholders ($today_start, etc.) live as plain strings in `filter` and are
// resolved at query-build time by placeholdersResolver.js.

module.exports = [
  {
    key: 'all',
    nameI18nKey: 'workspaceViews.wms.documents.all',
    nameFallback: 'All documents',
    icon: 'LayoutGrid',
    description: null,
    filter: {},
    sort: null,
    columns: null,
    isDefault: true,
  },
  {
    key: 'pz',
    nameI18nKey: 'workspaceViews.wms.documents.pz',
    nameFallback: 'PZ — Receipts',
    icon: 'Truck',
    description: null,
    filter: { where: [{ field: 'type', op: 'in', value: ['PZ'] }] },
    sort: null,
    columns: null,
    isDefault: false,
  },
  {
    key: 'wz',
    nameI18nKey: 'workspaceViews.wms.documents.wz',
    nameFallback: 'WZ — Shipments',
    icon: 'Send',
    description: null,
    filter: { where: [{ field: 'type', op: 'in', value: ['WZ'] }] },
    sort: null,
    columns: null,
    isDefault: false,
  },
  {
    key: 'pzk',
    nameI18nKey: 'workspaceViews.wms.documents.pzk',
    nameFallback: 'PZK — Receipt corrections',
    icon: 'Undo2',
    description: null,
    filter: { where: [{ field: 'type', op: 'in', value: ['PZK'] }] },
    sort: null,
    columns: null,
    isDefault: false,
  },
  {
    key: 'wzk',
    nameI18nKey: 'workspaceViews.wms.documents.wzk',
    nameFallback: 'WZK — Shipment corrections',
    icon: 'RotateCcw',
    description: null,
    filter: { where: [{ field: 'type', op: 'in', value: ['WZK'] }] },
    sort: null,
    columns: null,
    isDefault: false,
  },
  {
    key: 'mm',
    nameI18nKey: 'workspaceViews.wms.documents.mm',
    nameFallback: 'MM — Transfers',
    icon: 'ArrowRightLeft',
    description: null,
    filter: { where: [{ field: 'type', op: 'in', value: ['MM'] }] },
    sort: null,
    columns: null,
    isDefault: false,
  },
  {
    key: 'rw',
    nameI18nKey: 'workspaceViews.wms.documents.rw',
    nameFallback: 'RW — Issues',
    icon: 'MinusCircle',
    description: null,
    filter: { where: [{ field: 'type', op: 'in', value: ['RW'] }] },
    sort: null,
    columns: null,
    isDefault: false,
  },
  {
    key: 'pw',
    nameI18nKey: 'workspaceViews.wms.documents.pw',
    nameFallback: 'PW — Internal receipts',
    icon: 'PlusCircle',
    description: null,
    filter: { where: [{ field: 'type', op: 'in', value: ['PW'] }] },
    sort: null,
    columns: null,
    isDefault: false,
  },
  {
    key: 'posted-today',
    nameI18nKey: 'workspaceViews.wms.documents.postedToday',
    nameFallback: 'Posted today',
    icon: 'CalendarCheck',
    description: null,
    filter: {
      where: [
        { field: 'date', op: 'gte', value: '$today_start' },
        { field: 'date', op: 'lt', value: '$today_end' },
      ],
    },
    sort: null,
    columns: null,
    isDefault: false,
  },
];
