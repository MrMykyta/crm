import { crmApi } from './crmApi';

function pickStockValuationParams(args = {}) {
  const params = {};
  const source = args || {};

  if (source.warehouseId) params.warehouseId = source.warehouseId;
  if (source.productId) params.productId = source.productId;
  if (source.variantId) params.variantId = source.variantId;
  if (source.groupBy) params.groupBy = source.groupBy;
  if (source.currency) params.currency = String(source.currency).trim().toUpperCase();
  if (source.asOf) params.asOf = source.asOf;

  return params;
}

function pickStockTurnoverParams(args = {}) {
  const params = {};
  const source = args || {};

  if (source.dateFrom) params.dateFrom = source.dateFrom;
  if (source.dateTo) params.dateTo = source.dateTo;
  if (source.warehouseId) params.warehouseId = source.warehouseId;
  if (source.productId) params.productId = source.productId;
  if (source.variantId) params.variantId = source.variantId;
  if (source.groupBy) params.groupBy = source.groupBy;
  if (source.currency) params.currency = String(source.currency).trim().toUpperCase();

  return params;
}

function pickStockAsOfParams(args = {}) {
  const params = {};
  const source = args || {};

  if (source.asOf) params.asOf = source.asOf;
  if (source.warehouseId) params.warehouseId = source.warehouseId;
  if (source.productId) params.productId = source.productId;
  if (source.variantId) params.variantId = source.variantId;
  if (source.groupBy) params.groupBy = source.groupBy;
  if (source.currency) params.currency = String(source.currency).trim().toUpperCase();

  return params;
}

function pickInventoryLedgerParams(args = {}) {
  const params = {};
  const source = args || {};

  if (source.productId) params.productId = source.productId;
  if (source.dateFrom) params.dateFrom = source.dateFrom;
  if (source.dateTo) params.dateTo = source.dateTo;
  if (source.variantId) params.variantId = source.variantId;
  if (source.warehouseId) params.warehouseId = source.warehouseId;
  if (source.currency) params.currency = String(source.currency).trim().toUpperCase();

  return params;
}

function normalizeStockValuationResponse(resp = {}) {
  const items = Array.isArray(resp?.data) ? resp.data : [];
  return {
    items,
    totals: resp?.totals || {
      qtyRemaining: 0,
      stockValue: 0,
      currency: null,
    },
  };
}

function normalizeStockTurnoverResponse(resp = {}) {
  const items = Array.isArray(resp?.data) ? resp.data : [];
  return {
    items,
    totals: resp?.totals || {
      qtyIn: 0,
      qtyOut: 0,
      valueIn: 0,
      valueOut: 0,
      netQty: 0,
      netValue: 0,
      currency: null,
    },
  };
}

function normalizeStockAsOfResponse(resp = {}) {
  const items = Array.isArray(resp?.data) ? resp.data : [];
  return {
    items,
    totals: resp?.totals || {
      qty: 0,
      stockValue: 0,
      currency: null,
    },
  };
}

function normalizeInventoryLedgerResponse(resp = {}) {
  const items = Array.isArray(resp?.items)
    ? resp.items
    : Array.isArray(resp?.data)
      ? resp.data
      : [];
  return {
    items,
    total: Number(resp?.total ?? items.length) || 0,
    totals: resp?.totals || {
      qtyIn: 0,
      qtyOut: 0,
      valueIn: 0,
      valueOut: 0,
      balanceAfter: 0,
      valueBalance: 0,
      currency: null,
    },
  };
}

export const wmsReportsApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    getStockValuationReport: build.query({
      query: (args = {}) => ({
        url: '/wms/reports/stock-valuation',
        method: 'GET',
        params: pickStockValuationParams(args),
      }),
      transformResponse: normalizeStockValuationResponse,
      providesTags: [{ type: 'WmsStockValuation', id: 'REPORT' }],
      keepUnusedDataFor: 30,
    }),
    getStockTurnoverReport: build.query({
      query: (args = {}) => ({
        url: '/wms/reports/stock-turnover',
        method: 'GET',
        params: pickStockTurnoverParams(args),
      }),
      transformResponse: normalizeStockTurnoverResponse,
      providesTags: [{ type: 'WmsStockTurnover', id: 'REPORT' }],
      keepUnusedDataFor: 30,
    }),
    getStockAsOfReport: build.query({
      query: (args = {}) => ({
        url: '/wms/reports/stock-as-of',
        method: 'GET',
        params: pickStockAsOfParams(args),
      }),
      transformResponse: normalizeStockAsOfResponse,
      providesTags: [{ type: 'WmsStockAsOf', id: 'REPORT' }],
      keepUnusedDataFor: 30,
    }),
    getInventoryLedgerReport: build.query({
      query: (args = {}) => ({
        url: '/wms/reports/inventory-ledger',
        method: 'GET',
        params: pickInventoryLedgerParams(args),
      }),
      transformResponse: normalizeInventoryLedgerResponse,
      providesTags: [{ type: 'WmsInventoryLedger', id: 'REPORT' }],
      keepUnusedDataFor: 30,
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetStockValuationReportQuery,
  useGetStockTurnoverReportQuery,
  useGetStockAsOfReportQuery,
  useGetInventoryLedgerReportQuery,
} = wmsReportsApi;
