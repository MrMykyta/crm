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

export const paymentsApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    createPayment: build.mutation({
      query: (payload) => ({
        url: '/payments',
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: (_res, _err, payload = {}) => [
        { type: 'InvoiceList', id: 'LIST' },
        { type: 'OrderList', id: 'LIST' },
        payload.invoiceId ? { type: 'Invoice', id: payload.invoiceId } : null,
        payload.orderId ? { type: 'Order', id: payload.orderId } : null,
      ].filter(Boolean),
    }),
  }),
  overrideExisting: true,
});

export const {
  useCreatePaymentMutation,
} = paymentsApi;
