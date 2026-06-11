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
  if (source.orderId) params.orderId = source.orderId;
  if (source.shipmentId) params.shipmentId = source.shipmentId;
  if (source.warehouseId) params.warehouseId = source.warehouseId;
  if (source.locationId) params.locationId = source.locationId;
  if (source.fromLocationId) params.fromLocationId = source.fromLocationId;
  if (source.toLocationId) params.toLocationId = source.toLocationId;
  if (source.productId) params.productId = source.productId;
  if (source.variantId) params.variantId = source.variantId;
  if (source.type) params.type = source.type;
  if (source.refType) params.refType = source.refType;
  if (source.refId) params.refId = source.refId;
  if (source.sourceType) params.refType = source.sourceType;
  if (source.sourceId) params.refId = source.sourceId;
  if (source.dateFrom) params.dateFrom = source.dateFrom;
  if (source.dateTo) params.dateTo = source.dateTo;
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
        url: '/wms/warehouses',
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
        url: '/wms/warehouses',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: [{ type: 'WmsWarehouseList', id: 'LIST' }],
    }),
    updateWarehouse: build.mutation({
      query: ({ id, ...payload }) => ({
        url: `/wms/warehouses/${id}`,
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
        url: '/wms/locations',
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
        url: '/wms/locations',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: [{ type: 'WmsLocationList', id: 'LIST' }],
    }),
    updateLocation: build.mutation({
      query: ({ id, ...payload }) => ({
        url: `/wms/locations/${id}`,
        method: 'PUT',
        body: payload,
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'WmsLocationList', id: 'LIST' },
        { type: 'WmsLocation', id: arg?.id },
      ],
    }),
    listStockMoves: build.query({
      query: (args = {}) => ({
        url: '/wms/stock-moves',
        method: 'GET',
        params: pickListParams(args),
      }),
      transformResponse: (resp, _meta, args) => normalizeHistoryResponse(resp, args),
      providesTags: (result) => [
        { type: 'WmsStockMoveList', id: 'LIST' },
        ...(Array.isArray(result?.items)
          ? result.items.filter((item) => item?.id).map((item) => ({ type: 'WmsStockMove', id: item.id }))
          : []),
      ],
      keepUnusedDataFor: 60,
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
      providesTags: (result) => [
        { type: 'WmsReceiptList', id: 'LIST' },
        ...(Array.isArray(result?.items)
          ? result.items.filter((item) => item?.id).map((item) => ({ type: 'WmsReceipt', id: item.id }))
          : []),
      ],
      keepUnusedDataFor: 60,
    }),
    getReceiptById: build.query({
      query: (id) => ({ url: `/receipts/${id}`, method: 'GET', params: { _: Date.now() } }),
      providesTags: (_result, _error, id) => [{ type: 'WmsReceipt', id }],
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
      providesTags: (_result, _error, arg) => [
        { type: 'WmsStockMoveList', id: 'LIST' },
        { type: 'WmsReceipt', id: arg?.id },
      ],
      keepUnusedDataFor: 60,
    }),
    createReceipt: build.mutation({
      query: (payload = {}) => ({
        url: '/wms/receipts',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: [
        { type: 'WmsReceiptList', id: 'LIST' },
        { type: 'WmsDocumentsUnified', id: 'LIST' },
      ],
    }),
    receiveReceiptLine: build.mutation({
      query: ({ itemId, payload = {} }) => ({
        url: `/wms/receipts/item/${itemId}/receive`,
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'WmsReceiptList', id: 'LIST' },
        { type: 'WmsReceipt', id: arg?.receiptId },
        { type: 'WmsStockMoveList', id: 'LIST' },
        { type: 'WmsDocumentsUnified', id: 'LIST' },
        { type: 'ProductList', id: 'WMS_STOCK_BALANCES' },
      ],
    }),
    updateReceiptDraft: build.mutation({
      query: ({ id, payload = {} }) => ({
        url: `/wms/receipts/${id}`,
        method: 'PATCH',
        body: payload,
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'WmsReceiptList', id: 'LIST' },
        { type: 'WmsReceipt', id: arg?.id },
        { type: 'WmsDocumentsUnified', id: 'LIST' },
      ],
    }),
    addReceiptDraftItem: build.mutation({
      query: ({ id, payload = {} }) => ({
        url: `/wms/receipts/${id}/items`,
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'WmsReceiptList', id: 'LIST' },
        { type: 'WmsReceipt', id: arg?.id },
        { type: 'WmsDocumentsUnified', id: 'LIST' },
      ],
    }),
    updateReceiptDraftItem: build.mutation({
      query: ({ id, itemId, payload = {} }) => ({
        url: `/wms/receipts/${id}/items/${itemId}`,
        method: 'PATCH',
        body: payload,
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'WmsReceiptList', id: 'LIST' },
        { type: 'WmsReceipt', id: arg?.id },
        { type: 'WmsDocumentsUnified', id: 'LIST' },
      ],
    }),
    removeReceiptDraftItem: build.mutation({
      query: ({ id, itemId }) => ({
        url: `/wms/receipts/${id}/items/${itemId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'WmsReceiptList', id: 'LIST' },
        { type: 'WmsReceipt', id: arg?.id },
        { type: 'WmsDocumentsUnified', id: 'LIST' },
      ],
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
      providesTags: (result) => [
        { type: 'WmsShipmentList', id: 'LIST' },
        ...(Array.isArray(result?.items)
          ? result.items.filter((item) => item?.id).map((item) => ({ type: 'WmsShipment', id: item.id }))
          : []),
      ],
      keepUnusedDataFor: 60,
    }),
    getShipmentById: build.query({
      query: (id) => ({ url: `/shipments/${id}`, method: 'GET' }),
      providesTags: (_result, _error, id) => [{ type: 'WmsShipment', id }],
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
      providesTags: (_result, _error, arg) => [
        { type: 'WmsStockMoveList', id: 'LIST' },
        { type: 'WmsShipment', id: arg?.id },
      ],
      keepUnusedDataFor: 60,
    }),
    shipShipmentItem: build.mutation({
      query: ({ itemId, payload = {} }) => ({
        url: `/wms/shipments/item/${itemId}/ship`,
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'WmsShipmentList', id: 'LIST' },
        { type: 'WmsShipment', id: arg?.shipmentId },
        { type: 'WmsStockMoveList', id: 'LIST' },
        { type: 'WmsDocumentsUnified', id: 'LIST' },
        { type: 'ProductList', id: 'WMS_STOCK_BALANCES' },
      ],
    }),
    listPickWaves: build.query({
      query: (args = {}) => ({
        url: '/wms/pick-waves',
        method: 'GET',
        params: {
          page: args.page,
          limit: args.limit,
          sort: args.sort,
          dir: args.dir,
          status: args.status,
          warehouseId: args.warehouseId,
        },
      }),
      transformResponse: (resp, _meta, args) => normalizeListResponse(resp, args),
      providesTags: (result) => [
        { type: 'WmsPickWaveList', id: 'LIST' },
        ...(Array.isArray(result?.items)
          ? result.items.filter((item) => item?.id).map((item) => ({ type: 'WmsPickWave', id: item.id }))
          : []),
      ],
      keepUnusedDataFor: 60,
    }),
    listPickTasks: build.query({
      query: (args = {}) => ({
        url: '/wms/pick-tasks',
        method: 'GET',
        params: {
          page: args.page,
          limit: args.limit,
          sort: args.sort,
          dir: args.dir,
          status: args.status,
        },
      }),
      transformResponse: (resp, _meta, args) => normalizeListResponse(resp, args),
      providesTags: (result) => [
        { type: 'WmsPickTaskList', id: 'LIST' },
        ...(Array.isArray(result?.items)
          ? result.items.filter((item) => item?.id).map((item) => ({ type: 'WmsPickTask', id: item.id }))
          : []),
      ],
      keepUnusedDataFor: 60,
    }),
    completePickTask: build.mutation({
      query: (id) => ({
        url: `/wms/picks/task/${encodeURIComponent(id)}/complete`,
        method: 'POST',
        body: {},
      }),
      invalidatesTags: [
        { type: 'WmsPickTaskList', id: 'LIST' },
        { type: 'WmsPickWaveList', id: 'LIST' },
      ],
    }),
    createShipment: build.mutation({
      query: (payload = {}) => ({
        url: '/wms/shipments',
        method: 'POST',
        body: payload,
      }),
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
    // Phase 4B-1 — Reservations (read-only UI). Backend list/detail exist; the whole
    // reservation router is guarded by `wms:reservation:manage`. Create/release are
    // intentionally NOT exposed: the real reservation lifecycle is order-driven
    // (reserveOrder/releaseOrderReservations) and the generic CRUD bypasses stock recalc.
    listReservations: build.query({
      query: (args = {}) => ({
        url: '/wms/reservations',
        method: 'GET',
        params: pickListParams(args),
      }),
      transformResponse: (resp, _meta, args) => normalizeListResponse(resp, args),
      providesTags: (result) => [
        { type: 'WmsReservationList', id: 'LIST' },
        ...(Array.isArray(result?.items)
          ? result.items.filter((item) => item?.id).map((item) => ({ type: 'WmsReservation', id: item.id }))
          : []),
      ],
      keepUnusedDataFor: 60,
    }),
    getReservationById: build.query({
      query: (id) => ({ url: `/wms/reservations/${id}`, method: 'GET' }),
      providesTags: (_result, _error, id) => [{ type: 'WmsReservation', id }],
      keepUnusedDataFor: 60,
    }),

    // Phase 4B-1 — Lots (read-only UI). Backend supports productId + `q` (lotNumber) filters.
    // create/update mutations are wired to the existing generic backend CRUD for Phase 4B-2.
    listLots: build.query({
      query: (args = {}) => ({
        url: '/wms/lots',
        method: 'GET',
        params: pickListParams(args),
      }),
      transformResponse: (resp, _meta, args) => normalizeListResponse(resp, args),
      providesTags: (result) => [
        { type: 'WmsLotList', id: 'LIST' },
        ...(Array.isArray(result?.items)
          ? result.items.filter((item) => item?.id).map((item) => ({ type: 'WmsLot', id: item.id }))
          : []),
      ],
      keepUnusedDataFor: 60,
    }),
    getLotById: build.query({
      query: (id) => ({ url: `/wms/lots/${id}`, method: 'GET' }),
      providesTags: (_result, _error, id) => [{ type: 'WmsLot', id }],
      keepUnusedDataFor: 60,
    }),
    createLot: build.mutation({
      query: (payload = {}) => ({ url: '/wms/lots', method: 'POST', body: payload }),
      invalidatesTags: [{ type: 'WmsLotList', id: 'LIST' }],
    }),
    updateLot: build.mutation({
      query: ({ id, ...payload }) => ({ url: `/wms/lots/${id}`, method: 'PUT', body: payload }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'WmsLotList', id: 'LIST' },
        { type: 'WmsLot', id: arg?.id },
      ],
    }),

    // Phase 4B-1 — Serials (read-only UI). Backend supports productId + `q` (serialNumber) filters.
    listSerials: build.query({
      query: (args = {}) => ({
        url: '/wms/serials',
        method: 'GET',
        params: pickListParams(args),
      }),
      transformResponse: (resp, _meta, args) => normalizeListResponse(resp, args),
      providesTags: (result) => [
        { type: 'WmsSerialList', id: 'LIST' },
        ...(Array.isArray(result?.items)
          ? result.items.filter((item) => item?.id).map((item) => ({ type: 'WmsSerial', id: item.id }))
          : []),
      ],
      keepUnusedDataFor: 60,
    }),
    getSerialById: build.query({
      query: (id) => ({ url: `/wms/serials/${id}`, method: 'GET' }),
      providesTags: (_result, _error, id) => [{ type: 'WmsSerial', id }],
      keepUnusedDataFor: 60,
    }),
    createSerial: build.mutation({
      query: (payload = {}) => ({ url: '/wms/serials', method: 'POST', body: payload }),
      invalidatesTags: [{ type: 'WmsSerialList', id: 'LIST' }],
    }),
    updateSerial: build.mutation({
      query: ({ id, ...payload }) => ({ url: `/wms/serials/${id}`, method: 'PUT', body: payload }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'WmsSerialList', id: 'LIST' },
        { type: 'WmsSerial', id: arg?.id },
      ],
    }),

    // Phase 4B-1 — Parcels (read-only UI). Backend supports shipmentId + `q` (carrier/tracking)
    // filters. NOTE: backend list currently filters by a non-existent `companyId` column on the
    // Parcel model, so GET /wms/parcels can error — the UI surfaces this via its error state.
    listParcels: build.query({
      query: (args = {}) => ({
        url: '/wms/parcels',
        method: 'GET',
        params: pickListParams(args),
      }),
      transformResponse: (resp, _meta, args) => normalizeListResponse(resp, args),
      providesTags: (result) => [
        { type: 'WmsParcelList', id: 'LIST' },
        ...(Array.isArray(result?.items)
          ? result.items.filter((item) => item?.id).map((item) => ({ type: 'WmsParcel', id: item.id }))
          : []),
      ],
      keepUnusedDataFor: 60,
    }),
    getParcelById: build.query({
      query: (id) => ({ url: `/wms/parcels/${id}`, method: 'GET' }),
      providesTags: (_result, _error, id) => [{ type: 'WmsParcel', id }],
      keepUnusedDataFor: 60,
    }),
    createParcel: build.mutation({
      query: (payload = {}) => ({ url: '/wms/parcels', method: 'POST', body: payload }),
      invalidatesTags: [{ type: 'WmsParcelList', id: 'LIST' }],
    }),
    updateParcel: build.mutation({
      query: ({ id, ...payload }) => ({ url: `/wms/parcels/${id}`, method: 'PUT', body: payload }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'WmsParcelList', id: 'LIST' },
        { type: 'WmsParcel', id: arg?.id },
      ],
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
  useListStockMovesQuery,
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
  useUpdateReceiptDraftMutation,
  useAddReceiptDraftItemMutation,
  useUpdateReceiptDraftItemMutation,
  useRemoveReceiptDraftItemMutation,
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
  useShipShipmentItemMutation,
  useListPickWavesQuery,
  useListPickTasksQuery,
  useCompletePickTaskMutation,
  useCreateShipmentMutation,
  useCreateShipmentCorrectionMutation,
  useListAdjustmentsQuery,
  useGetAdjustmentByIdQuery,
  useGetAdjustmentStockMovesQuery,
  usePostAdjustmentMutation,
  useCreateAdjustmentMutation,
  useListReservationsQuery,
  useGetReservationByIdQuery,
  useListLotsQuery,
  useGetLotByIdQuery,
  useCreateLotMutation,
  useUpdateLotMutation,
  useListSerialsQuery,
  useGetSerialByIdQuery,
  useCreateSerialMutation,
  useUpdateSerialMutation,
  useListParcelsQuery,
  useGetParcelByIdQuery,
  useCreateParcelMutation,
  useUpdateParcelMutation,
  useListWarehouseDocumentsQuery,
} = wmsDocumentsApi;
