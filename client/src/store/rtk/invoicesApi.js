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

export const invoicesApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    listInvoices: build.query({
      query: (args = {}) => ({
        url: '/invoices',
        method: 'GET',
        params: buildParams(args),
      }),
      transformResponse: normalizeList,
      providesTags: (res) => [
        { type: 'InvoiceList', id: 'LIST' },
        ...(res?.items || []).map((item) => ({ type: 'Invoice', id: item.id })),
      ],
      keepUnusedDataFor: 60,
    }),

    getInvoiceById: build.query({
      query: (id) => ({
        url: `/invoices/${encodeURIComponent(id)}`,
        method: 'GET',
      }),
      providesTags: (_res, _err, id) => [{ type: 'Invoice', id }],
    }),

    issueInvoiceFromOrder: build.mutation({
      query: ({ orderId, payload = {} }) => ({
        url: `/invoices/order/${encodeURIComponent(orderId)}/actions/issue`,
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: (_res, _err, { orderId }) => [
        { type: 'InvoiceList', id: 'LIST' },
        { type: 'Order', id: orderId },
        { type: 'OrderList', id: 'LIST' },
      ],
    }),
  }),
  overrideExisting: true,
});

export const {
  useListInvoicesQuery,
  useGetInvoiceByIdQuery,
  useLazyGetInvoiceByIdQuery,
  useIssueInvoiceFromOrderMutation,
} = invoicesApi;
