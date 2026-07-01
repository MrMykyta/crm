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

export const offersApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    listOffers: build.query({
      query: (args = {}) => ({
        url: '/offers',
        method: 'GET',
        params: buildParams(args),
      }),
      transformResponse: normalizeList,
      providesTags: (res) => [
        { type: 'OfferList', id: 'LIST' },
        ...(res?.items || []).map((item) => ({ type: 'Offer', id: item.id })),
      ],
      keepUnusedDataFor: 60,
    }),

    getOfferById: build.query({
      query: (id) => ({
        url: `/offers/${encodeURIComponent(id)}`,
        method: 'GET',
      }),
      providesTags: (_res, _err, id) => [{ type: 'Offer', id }],
    }),

    createOffer: build.mutation({
      query: (payload) => ({
        url: '/offers',
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: [{ type: 'OfferList', id: 'LIST' }],
    }),

    updateOffer: build.mutation({
      query: ({ id, payload }) => ({
        url: `/offers/${encodeURIComponent(id)}`,
        method: 'PATCH',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Offer', id },
        { type: 'OfferList', id: 'LIST' },
      ],
    }),

    deleteOffer: build.mutation({
      query: (id) => ({
        url: `/offers/${encodeURIComponent(id)}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: 'Offer', id },
        { type: 'OfferList', id: 'LIST' },
      ],
    }),

    saveOfferItems: build.mutation({
      query: ({ id, items }) => ({
        url: `/offers/${encodeURIComponent(id)}/items`,
        method: 'PUT',
        body: stripCompanyId({ items }),
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Offer', id },
        { type: 'OfferList', id: 'LIST' },
      ],
    }),

    sendOffer: build.mutation({
      query: ({ id, payload = {} }) => ({
        url: `/offers/${encodeURIComponent(id)}/actions/send`,
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Offer', id },
        { type: 'OfferList', id: 'LIST' },
      ],
    }),

    acceptOffer: build.mutation({
      query: ({ id, payload = {} }) => ({
        url: `/offers/${encodeURIComponent(id)}/actions/accept`,
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Offer', id },
        { type: 'OfferList', id: 'LIST' },
      ],
    }),

    rejectOffer: build.mutation({
      query: ({ id, payload = {} }) => ({
        url: `/offers/${encodeURIComponent(id)}/actions/reject`,
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Offer', id },
        { type: 'OfferList', id: 'LIST' },
      ],
    }),

    cancelOffer: build.mutation({
      query: ({ id, payload = {} }) => ({
        url: `/offers/${encodeURIComponent(id)}/actions/cancel`,
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Offer', id },
        { type: 'OfferList', id: 'LIST' },
      ],
    }),

    expireOffer: build.mutation({
      query: ({ id, payload = {} }) => ({
        url: `/offers/${encodeURIComponent(id)}/actions/expire`,
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Offer', id },
        { type: 'OfferList', id: 'LIST' },
      ],
    }),

    duplicateOffer: build.mutation({
      query: ({ id, payload = {} }) => ({
        url: `/offers/${encodeURIComponent(id)}/actions/duplicate`,
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: [{ type: 'OfferList', id: 'LIST' }],
    }),

    convertOfferToOrder: build.mutation({
      query: ({ id, payload = {} }) => ({
        url: `/offers/${encodeURIComponent(id)}/actions/convert-to-order`,
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Offer', id },
        { type: 'OfferList', id: 'LIST' },
        { type: 'OrderList', id: 'LIST' },
      ],
    }),

    generateOfferPdf: build.mutation({
      query: ({ id, payload = {} }) => ({
        url: `/offers/${encodeURIComponent(id)}/actions/generate-pdf`,
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: (_res, _err, { id }) => [{ type: 'Offer', id }],
    }),

    sendOfferDocument: build.mutation({
      query: ({ id, payload = {} }) => ({
        url: `/offers/${encodeURIComponent(id)}/actions/send-document`,
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Offer', id },
        { type: 'OfferList', id: 'LIST' },
      ],
    }),

    getOfferMeta: build.query({
      query: (args = {}) => ({
        url: '/offers/meta',
        method: 'GET',
        params: buildParams(args),
      }),
      keepUnusedDataFor: 300,
    }),
  }),
  overrideExisting: true,
});

export const {
  useListOffersQuery,
  useGetOfferByIdQuery,
  useCreateOfferMutation,
  useUpdateOfferMutation,
  useDeleteOfferMutation,
  useSaveOfferItemsMutation,
  useSendOfferMutation,
  useAcceptOfferMutation,
  useRejectOfferMutation,
  useCancelOfferMutation,
  useExpireOfferMutation,
  useDuplicateOfferMutation,
  useConvertOfferToOrderMutation,
  useGenerateOfferPdfMutation,
  useSendOfferDocumentMutation,
  useGetOfferMetaQuery,
} = offersApi;
