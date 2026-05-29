import { crmApi } from './crmApi';

const stripCompanyId = (value) => {
  if (!value || typeof value !== 'object') return value;
  if (typeof FormData !== 'undefined' && value instanceof FormData) {
    value.delete('companyId');
    return value;
  }
  if (value.constructor !== Object) return value;
  const { companyId, ...rest } = value;
  return rest;
};

const buildParams = (args = {}) => {
  const src = stripCompanyId(args) || {};
  const params = {};
  Object.entries(src).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params[key] = value;
  });
  return params;
};

const normalizeList = (resp) => {
  const items = Array.isArray(resp?.items) ? resp.items : Array.isArray(resp) ? resp : [];
  return {
    items,
    total: Number(resp?.total ?? items.length) || 0,
    page: Number(resp?.page ?? 1) || 1,
    limit: Number(resp?.limit ?? 25) || 25,
  };
};

export const ordersApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    listOrders: build.query({
      query: (args = {}) => ({
        url: '/orders',
        method: 'GET',
        params: buildParams(args),
      }),
      transformResponse: normalizeList,
      providesTags: (res) => [
        { type: 'OrderList', id: 'LIST' },
        ...(res?.items || []).map((item) => ({ type: 'Order', id: item.id })),
      ],
      keepUnusedDataFor: 60,
    }),

    getOrderById: build.query({
      query: (id) => ({
        url: `/orders/${encodeURIComponent(id)}`,
        method: 'GET',
      }),
      providesTags: (_res, _err, id) => [{ type: 'Order', id }],
    }),

    createOrder: build.mutation({
      query: (payload) => ({
        url: '/orders',
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: [{ type: 'OrderList', id: 'LIST' }],
    }),

    updateOrder: build.mutation({
      query: ({ id, payload }) => ({
        url: `/orders/${encodeURIComponent(id)}`,
        method: 'PATCH',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Order', id },
        { type: 'OrderList', id: 'LIST' },
      ],
    }),

    deleteOrder: build.mutation({
      query: (id) => ({
        url: `/orders/${encodeURIComponent(id)}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: 'Order', id },
        { type: 'OrderList', id: 'LIST' },
      ],
    }),

    saveOrderItems: build.mutation({
      query: ({ id, items }) => ({
        url: `/orders/${encodeURIComponent(id)}/items`,
        method: 'PUT',
        body: stripCompanyId({ items }),
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Order', id },
        { type: 'OrderList', id: 'LIST' },
      ],
    }),

    confirmOrder: build.mutation({
      query: ({ id, payload = {} }) => ({
        url: `/orders/${encodeURIComponent(id)}/actions/confirm`,
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Order', id },
        { type: 'OrderList', id: 'LIST' },
      ],
    }),

    shipOrder: build.mutation({
      query: ({ id, payload = {} }) => ({
        url: `/orders/${encodeURIComponent(id)}/actions/ship`,
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Order', id },
        { type: 'OrderList', id: 'LIST' },
      ],
    }),

    completeOrder: build.mutation({
      query: ({ id, payload = {} }) => ({
        url: `/orders/${encodeURIComponent(id)}/actions/complete`,
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Order', id },
        { type: 'OrderList', id: 'LIST' },
      ],
    }),

    cancelOrder: build.mutation({
      query: ({ id, payload = {} }) => ({
        url: `/orders/${encodeURIComponent(id)}/actions/cancel`,
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Order', id },
        { type: 'OrderList', id: 'LIST' },
      ],
    }),

    returnOrder: build.mutation({
      query: ({ id, payload = {} }) => ({
        url: `/orders/${encodeURIComponent(id)}/actions/return`,
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Order', id },
        { type: 'OrderList', id: 'LIST' },
      ],
    }),

    getOrderMeta: build.query({
      query: (args = {}) => ({
        url: '/orders/meta',
        method: 'GET',
        params: buildParams(args),
      }),
      keepUnusedDataFor: 300,
    }),
  }),
  overrideExisting: true,
});

export const {
  useListOrdersQuery,
  useGetOrderByIdQuery,
  useCreateOrderMutation,
  useUpdateOrderMutation,
  useDeleteOrderMutation,
  useSaveOrderItemsMutation,
  useConfirmOrderMutation,
  useShipOrderMutation,
  useCompleteOrderMutation,
  useCancelOrderMutation,
  useReturnOrderMutation,
  useGetOrderMetaQuery,
} = ordersApi;
