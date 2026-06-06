import { crmApi } from './crmApi';

function pickParams(args = {}) {
  const params = {};
  const source = args || {};

  if (source.warehouseId) params.warehouseId = source.warehouseId;
  if (source.productId) params.productId = source.productId;
  if (source.variantId) params.variantId = source.variantId;
  if (source.search) params.search = source.search;
  if (source.onlyPositive === true || source.onlyPositive === 'true') params.onlyPositive = true;

  return params;
}

function normalizeResponse(resp = {}, args = {}) {
  const items = Array.isArray(resp?.data) ? resp.data : [];
  return {
    items,
    total: items.length,
    page: Number(args?.page ?? 1) || 1,
    limit: Number(args?.limit ?? items.length ?? 25) || 25,
  };
}

export const stockBalancesApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    getStockBalances: build.query({
      query: (args = {}) => ({
        url: '/wms/inventory/stock-balances',
        method: 'GET',
        params: pickParams(args),
      }),
      transformResponse: (resp, _meta, args) => normalizeResponse(resp, args),
      keepUnusedDataFor: 60,
      providesTags: [{ type: 'ProductList', id: 'WMS_STOCK_BALANCES' }],
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetStockBalancesQuery,
} = stockBalancesApi;
