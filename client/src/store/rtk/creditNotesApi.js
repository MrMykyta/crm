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

const creditNoteIdFromResult = (result) => result?.id || result?.creditNote?.id || null;

export const creditNotesApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    listCreditNotes: build.query({
      query: (args = {}) => ({
        url: '/credit-notes',
        method: 'GET',
        params: buildParams(args),
      }),
      providesTags: (res) => [
        { type: 'CreditNoteList', id: 'LIST' },
        ...(Array.isArray(res) ? res : []).map((item) => ({ type: 'CreditNote', id: item.id })),
      ],
    }),

    getCreditNoteById: build.query({
      query: (id) => ({
        url: `/credit-notes/${encodeURIComponent(id)}`,
        method: 'GET',
      }),
      providesTags: (_res, _err, id) => [{ type: 'CreditNote', id }],
    }),

    issueCreditNoteFromInvoice: build.mutation({
      query: ({ invoiceId, payload = {} }) => ({
        url: `/invoices/${encodeURIComponent(invoiceId)}/actions/credit`,
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: (result, _err, { invoiceId, payload = {} }) => [
        { type: 'CreditNoteList', id: 'LIST' },
        creditNoteIdFromResult(result) ? { type: 'CreditNote', id: creditNoteIdFromResult(result) } : null,
        invoiceId ? { type: 'Invoice', id: invoiceId } : null,
        payload.orderId ? { type: 'Order', id: payload.orderId } : null,
        { type: 'InvoiceList', id: 'LIST' },
        { type: 'OrderList', id: 'LIST' },
      ].filter(Boolean),
    }),

    applyCreditNote: build.mutation({
      query: ({ id, applications = [] }) => ({
        url: `/credit-notes/${encodeURIComponent(id)}/actions/apply`,
        method: 'POST',
        body: { applications },
      }),
      invalidatesTags: (result, _err, { id, applications = [] }) => [
        { type: 'CreditNote', id },
        { type: 'CreditNoteList', id: 'LIST' },
        ...(applications || []).map((application) => (
          application?.invoiceId ? { type: 'Invoice', id: application.invoiceId } : null
        )).filter(Boolean),
        result?.creditNote?.orderId ? { type: 'Order', id: result.creditNote.orderId } : null,
        { type: 'InvoiceList', id: 'LIST' },
        { type: 'OrderList', id: 'LIST' },
      ].filter(Boolean),
    }),

    cancelCreditNote: build.mutation({
      query: (id) => ({
        url: `/credit-notes/${encodeURIComponent(id)}/actions/cancel`,
        method: 'POST',
        body: {},
      }),
      invalidatesTags: (result, _err, id) => [
        { type: 'CreditNote', id },
        { type: 'CreditNoteList', id: 'LIST' },
        result?.invoiceId ? { type: 'Invoice', id: result.invoiceId } : null,
        result?.orderId ? { type: 'Order', id: result.orderId } : null,
      ].filter(Boolean),
    }),

    refundCreditNote: build.mutation({
      query: ({ id, amount, method = 'bank_transfer', reference }) => ({
        url: `/credit-notes/${encodeURIComponent(id)}/actions/refund`,
        method: 'POST',
        body: stripCompanyId({ amount, method, reference }),
      }),
      invalidatesTags: (result, _err, { id }) => [
        { type: 'CreditNote', id },
        { type: 'CreditNoteList', id: 'LIST' },
        result?.creditNote?.invoiceId ? { type: 'Invoice', id: result.creditNote.invoiceId } : null,
        result?.creditNote?.orderId ? { type: 'Order', id: result.creditNote.orderId } : null,
        { type: 'InvoiceList', id: 'LIST' },
        { type: 'OrderList', id: 'LIST' },
      ].filter(Boolean),
    }),

    generateCreditNotePdf: build.mutation({
      query: ({ id, payload = {} }) => ({
        url: `/credit-notes/${encodeURIComponent(id)}/actions/generate-pdf`,
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: (_res, _err, { id }) => [{ type: 'CreditNote', id }],
    }),

    sendCreditNoteDocument: build.mutation({
      query: ({ id, payload = {} }) => ({
        url: `/credit-notes/${encodeURIComponent(id)}/actions/send-document`,
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'CreditNote', id },
        { type: 'CreditNoteList', id: 'LIST' },
      ],
    }),
  }),
  overrideExisting: true,
});

export const {
  useListCreditNotesQuery,
  useGetCreditNoteByIdQuery,
  useIssueCreditNoteFromInvoiceMutation,
  useApplyCreditNoteMutation,
  useCancelCreditNoteMutation,
  useRefundCreditNoteMutation,
  useGenerateCreditNotePdfMutation,
  useSendCreditNoteDocumentMutation,
} = creditNotesApi;
