import { crmApi } from './crmApi';

function normalizeListResponse(resp = {}, args = {}) {
  const items = Array.isArray(resp?.data) ? resp.data : [];
  const total = Number(resp?.meta?.count ?? items.length ?? 0);
  const page = Number(resp?.meta?.page ?? args?.page ?? 1) || 1;
  const limit = Number(resp?.meta?.limit ?? args?.limit ?? 25) || 25;
  return { items, total, page, limit };
}

function normalizeHistoryResponse(resp = {}, args = {}) {
  const items = Array.isArray(resp?.data) ? resp.data : [];
  const total = Number(resp?.meta?.count ?? items.length ?? 0);
  const page = Number(resp?.meta?.page ?? args?.page ?? 1) || 1;
  const limit = Number(resp?.meta?.limit ?? args?.limit ?? 25) || 25;
  return { items, total, page, limit };
}

function pickListParams(args = {}) {
  const params = {};
  const source = args || {};

  if (source.page) params.page = source.page;
  if (source.limit) params.limit = source.limit;
  if (source.search) params.q = source.search;
  if (source.status) params.status = source.status;
  if (source.documentType) params.documentType = source.documentType;
  if (source.warehouseId) params.warehouseId = source.warehouseId;
  if (source.sort) {
    const dir = String(source.dir || 'desc').toUpperCase();
    params.sort = `${source.sort}:${dir}`;
  }
  if (source.dir && !source.sort) {
    params.sort = `createdAt:${String(source.dir).toUpperCase()}`;
  }
  return params;
}

function pickPrintUrl(kind, id) {
  if (kind === 'receipt') return `/receipts/${id}/print`;
  if (kind === 'transfer') return `/transfers/${id}/print`;
  if (kind === 'shipment') return `/shipments/${id}/print`;
  if (kind === 'adjustment') return `/wms/adjustments/${id}/print`;
  if (kind === 'cycleCount') return `/wms/cycle-counts/${id}/print`;
  return `/wms/${kind}/${id}/print`;
}

export const wmsDocumentsApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    getWarehousePrintDocument: build.query({
      query: ({ kind, id }) => ({
        url: pickPrintUrl(kind, id),
        method: 'GET',
      }),
      keepUnusedDataFor: 30,
    }),
    listWarehouses: build.query({
      query: (args = {}) => ({
        url: '/warehouses',
        method: 'GET',
        params: pickListParams(args),
      }),
      transformResponse: (resp, _meta, args) => normalizeListResponse(resp, args),
      providesTags: (result) => [
        { type: 'WmsWarehouseList', id: 'LIST' },
        ...(Array.isArray(result?.items)
          ? result.items.filter((item) => item?.id).map((item) => ({ type: 'WmsWarehouse', id: item.id }))
          : []),
      ],
      keepUnusedDataFor: 120,
    }),
    createWarehouse: build.mutation({
      query: (payload = {}) => ({
        url: '/warehouses',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: [{ type: 'WmsWarehouseList', id: 'LIST' }],
    }),
    updateWarehouse: build.mutation({
      query: ({ id, ...payload }) => ({
        url: `/warehouses/${id}`,
        method: 'PUT',
        body: payload,
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'WmsWarehouseList', id: 'LIST' },
        { type: 'WmsWarehouse', id: arg?.id },
      ],
    }),
    listLocations: build.query({
      query: (args = {}) => ({
        url: '/locations',
        method: 'GET',
        params: pickListParams(args),
      }),
      transformResponse: (resp, _meta, args) => normalizeListResponse(resp, args),
      providesTags: (result) => [
        { type: 'WmsLocationList', id: 'LIST' },
        ...(Array.isArray(result?.items)
          ? result.items.filter((item) => item?.id).map((item) => ({ type: 'WmsLocation', id: item.id }))
          : []),
      ],
      keepUnusedDataFor: 120,
    }),
    createLocation: build.mutation({
      query: (payload = {}) => ({
        url: '/locations',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: [{ type: 'WmsLocationList', id: 'LIST' }],
    }),
    updateLocation: build.mutation({
      query: ({ id, ...payload }) => ({
        url: `/locations/${id}`,
        method: 'PUT',
        body: payload,
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'WmsLocationList', id: 'LIST' },
        { type: 'WmsLocation', id: arg?.id },
      ],
    }),
    getCostingOpeningBalanceStatus: build.query({
      query: () => ({
        url: '/wms/costing/opening-balance/status',
        method: 'GET',
      }),
      providesTags: [{ type: 'WmsCostingOpeningBalance', id: 'STATUS' }],
      keepUnusedDataFor: 30,
    }),
    dryRunCostingOpeningBalance: build.mutation({
      query: (payload = {}) => ({
        url: '/wms/costing/opening-balance/dry-run',
        method: 'POST',
        body: payload,
      }),
    }),
    initializeCostingOpeningBalance: build.mutation({
      query: (payload = {}) => ({
        url: '/wms/costing/opening-balance/initialize',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: [{ type: 'WmsCostingOpeningBalance', id: 'STATUS' }],
    }),
    listInventoryItems: build.query({
      query: (args = {}) => ({
        url: '/inventory-items',
        method: 'GET',
        params: pickListParams(args),
      }),
      transformResponse: (resp, _meta, args) => normalizeListResponse(resp, args),
      keepUnusedDataFor: 30,
    }),
    listCycleCounts: build.query({
      query: (args = {}) => ({
        url: '/wms/cycle-counts',
        method: 'GET',
        params: pickListParams(args),
      }),
      transformResponse: (resp, _meta, args) => normalizeListResponse(resp, args),
      providesTags: (result) => [
        { type: 'WmsCycleCountList', id: 'LIST' },
        ...(Array.isArray(result?.items)
          ? result.items.filter((item) => item?.id).map((item) => ({ type: 'WmsCycleCount', id: item.id }))
          : []),
      ],
      keepUnusedDataFor: 60,
    }),
    getCycleCountById: build.query({
      query: (id) => ({ url: `/wms/cycle-counts/${id}`, method: 'GET' }),
      providesTags: (_result, _error, id) => [{ type: 'WmsCycleCount', id }],
      keepUnusedDataFor: 60,
    }),
    createCycleCount: build.mutation({
      query: (payload = {}) => ({
        url: '/wms/cycle-counts',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: [{ type: 'WmsCycleCountList', id: 'LIST' }],
    }),
    addCycleCountItems: build.mutation({
      query: ({ id, items }) => ({
        url: `/wms/cycle-counts/${id}/items`,
        method: 'POST',
        body: { items },
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'WmsCycleCountList', id: 'LIST' },
        { type: 'WmsCycleCount', id: arg?.id },
      ],
    }),
    reconcileCycleCount: build.mutation({
      query: ({ id }) => ({
        url: `/wms/cycle-counts/${id}/reconcile`,
        method: 'POST',
        body: {},
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'WmsCycleCountList', id: 'LIST' },
        { type: 'WmsCycleCount', id: arg?.id },
      ],
    }),

    listReceipts: build.query({
      query: (args = {}) => ({
        url: '/receipts',
        method: 'GET',
        params: pickListParams(args),
      }),
      transformResponse: (resp, _meta, args) => normalizeListResponse(resp, args),
      keepUnusedDataFor: 60,
    }),
    getReceiptById: build.query({
      query: (id) => ({ url: `/receipts/${id}`, method: 'GET' }),
      keepUnusedDataFor: 60,
    }),
    getReceiptStockMoves: build.query({
      query: ({ id, ...args }) => ({
        url: `/receipts/${id}/stock-moves`,
        method: 'GET',
        params: {
          page: args.page,
          limit: args.limit,
          refItemId: args.refItemId,
        },
      }),
      transformResponse: (resp, _meta, args) => normalizeHistoryResponse(resp, args),
      keepUnusedDataFor: 60,
    }),
    createReceipt: build.mutation({
      query: (payload = {}) => ({
        url: '/wms/receipts',
        method: 'POST',
        body: payload,
      }),
    }),
    receiveReceiptLine: build.mutation({
      query: ({ itemId, payload = {} }) => ({
        url: `/wms/receipts/item/${itemId}/receive`,
        method: 'POST',
        body: payload,
      }),
    }),
    createReceiptCorrection: build.mutation({
      query: ({ id, payload = {} }) => ({
        url: `/wms/receipts/${id}/correction`,
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: [{ type: 'WmsDocumentsUnified', id: 'LIST' }],
    }),

    listTransfers: build.query({
      query: (args = {}) => ({
        url: '/transfers',
        method: 'GET',
        params: pickListParams(args),
      }),
      transformResponse: (resp, _meta, args) => normalizeListResponse(resp, args),
      keepUnusedDataFor: 60,
    }),
    getTransferById: build.query({
      query: (id) => ({ url: `/transfers/${id}`, method: 'GET' }),
      keepUnusedDataFor: 60,
    }),
    getTransferStockMoves: build.query({
      query: ({ id, ...args }) => ({
        url: `/transfers/${id}/stock-moves`,
        method: 'GET',
        params: {
          page: args.page,
          limit: args.limit,
          refItemId: args.refItemId,
        },
      }),
      transformResponse: (resp, _meta, args) => normalizeHistoryResponse(resp, args),
      keepUnusedDataFor: 60,
    }),
    createTransfer: build.mutation({
      query: (payload = {}) => ({
        url: '/wms/transfers',
        method: 'POST',
        body: payload,
      }),
    }),
    executeTransferLine: build.mutation({
      query: ({ itemId, payload = {} }) => ({
        url: `/wms/transfers/item/${itemId}/execute`,
        method: 'POST',
        body: payload,
      }),
    }),

    listShipments: build.query({
      query: (args = {}) => ({
        url: '/shipments',
        method: 'GET',
        params: pickListParams(args),
      }),
      transformResponse: (resp, _meta, args) => normalizeListResponse(resp, args),
      keepUnusedDataFor: 60,
    }),
    getShipmentById: build.query({
      query: (id) => ({ url: `/shipments/${id}`, method: 'GET' }),
      keepUnusedDataFor: 60,
    }),
    getShipmentStockMoves: build.query({
      query: ({ id, ...args }) => ({
        url: `/shipments/${id}/stock-moves`,
        method: 'GET',
        params: {
          page: args.page,
          limit: args.limit,
          refItemId: args.refItemId,
        },
      }),
      transformResponse: (resp, _meta, args) => normalizeHistoryResponse(resp, args),
      keepUnusedDataFor: 60,
    }),
    createShipmentCorrection: build.mutation({
      query: ({ id, payload = {} }) => ({
        url: `/wms/shipments/${id}/correction`,
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: [{ type: 'WmsDocumentsUnified', id: 'LIST' }],
    }),

    listAdjustments: build.query({
      query: (args = {}) => ({
        url: '/wms/adjustments',
        method: 'GET',
        params: pickListParams(args),
      }),
      transformResponse: (resp, _meta, args) => normalizeListResponse(resp, args),
      providesTags: (result) => [
        { type: 'WmsAdjustmentList', id: 'LIST' },
        ...(Array.isArray(result?.items)
          ? result.items.filter((item) => item?.id).map((item) => ({ type: 'WmsAdjustment', id: item.id }))
          : []),
      ],
      keepUnusedDataFor: 60,
    }),
    getAdjustmentById: build.query({
      query: (id) => ({ url: `/wms/adjustments/${id}`, method: 'GET' }),
      providesTags: (_result, _error, id) => [{ type: 'WmsAdjustment', id }],
      keepUnusedDataFor: 60,
    }),
    getAdjustmentStockMoves: build.query({
      query: ({ id, ...args }) => ({
        url: `/wms/adjustments/${id}/stock-moves`,
        method: 'GET',
        params: {
          page: args.page,
          limit: args.limit,
          refItemId: args.refItemId,
        },
      }),
      transformResponse: (resp, _meta, args) => normalizeHistoryResponse(resp, args),
      keepUnusedDataFor: 60,
    }),
    postAdjustment: build.mutation({
      query: ({ id }) => ({
        url: `/wms/adjustments/${id}/post`,
        method: 'POST',
        body: {},
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'WmsAdjustmentList', id: 'LIST' },
        { type: 'WmsAdjustment', id: arg?.id },
      ],
    }),
    createAdjustment: build.mutation({
      query: (payload = {}) => ({
        url: '/wms/adjustments',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: [{ type: 'WmsAdjustmentList', id: 'LIST' }],
    }),
    // WMS-DOCS-2 — unified PZ/WZ/MM/RW/PW list. The backend already returns the
    // normalised row shape, so no transformResponse is needed.
    listWarehouseDocuments: build.query({
      query: (args = {}) => {
        const params = {};
        if (args.type) params.type = Array.isArray(args.type) ? args.type.join(',') : args.type;
        if (args.status) params.status = args.status;
        if (args.search) params.search = args.search;
        if (args.warehouseId) params.warehouseId = args.warehouseId;
        if (args.dateFrom) params.dateFrom = args.dateFrom;
        if (args.dateTo) params.dateTo = args.dateTo;
        if (args.page) params.page = args.page;
        if (args.limit) params.limit = args.limit;
        if (args.offset !== undefined) params.offset = args.offset;
        return { url: '/wms/documents', method: 'GET', params };
      },
      providesTags: (result) => [
        { type: 'WmsDocumentsUnified', id: 'LIST' },
        ...(Array.isArray(result?.data)
          ? result.data
            .filter((row) => row && row.id)
            .map((row) => ({ type: 'WmsDocumentsUnified', id: `${row.type}:${row.id}` }))
          : []),
      ],
      keepUnusedDataFor: 30,
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetWarehousePrintDocumentQuery,
  useListWarehousesQuery,
  useCreateWarehouseMutation,
  useUpdateWarehouseMutation,
  useListLocationsQuery,
  useCreateLocationMutation,
  useUpdateLocationMutation,
  useGetCostingOpeningBalanceStatusQuery,
  useDryRunCostingOpeningBalanceMutation,
  useInitializeCostingOpeningBalanceMutation,
  useListInventoryItemsQuery,
  useListCycleCountsQuery,
  useGetCycleCountByIdQuery,
  useCreateCycleCountMutation,
  useAddCycleCountItemsMutation,
  useReconcileCycleCountMutation,
  useListReceiptsQuery,
  useGetReceiptByIdQuery,
  useLazyGetReceiptByIdQuery,
  useGetReceiptStockMovesQuery,
  useCreateReceiptMutation,
  useReceiveReceiptLineMutation,
  useCreateReceiptCorrectionMutation,
  useListTransfersQuery,
  useGetTransferByIdQuery,
  useLazyGetTransferByIdQuery,
  useGetTransferStockMovesQuery,
  useCreateTransferMutation,
  useExecuteTransferLineMutation,
  useListShipmentsQuery,
  useGetShipmentByIdQuery,
  useGetShipmentStockMovesQuery,
  useCreateShipmentCorrectionMutation,
  useListAdjustmentsQuery,
  useGetAdjustmentByIdQuery,
  useGetAdjustmentStockMovesQuery,
  usePostAdjustmentMutation,
  useCreateAdjustmentMutation,
  useListWarehouseDocumentsQuery,
} = wmsDocumentsApi;
