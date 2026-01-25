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

const buildListParams = (args = {}) => {
  const src = stripCompanyId(args) || {};
  const { filters, sort, dir, q, search, ...rest } = src;
  const params = { ...stripCompanyId(rest), ...stripCompanyId(filters) };

  const qVal = q ?? search;
  if (qVal) params.q = qVal;

  if (sort) {
    const s = String(sort);
    const d = String(dir || 'DESC').toLowerCase();
    params.sort = s.includes(':') ? s : `${s}:${d}`;
  }

  if (params.dir) delete params.dir;
  if (params.search) delete params.search;
  if (params.q === '') delete params.q;

  return params;
};

export const dealsApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    getDeals: build.query({
      query: (args = {}) => ({
        url: '/deals',
        method: 'GET',
        params: buildListParams(args),
      }),
      transformResponse: (resp) => {
        const items = Array.isArray(resp?.data)
          ? resp.data
          : Array.isArray(resp?.items)
            ? resp.items
            : Array.isArray(resp)
              ? resp
              : [];
        const meta = resp?.meta || {};
        return {
          items,
          total: Number(meta.count ?? resp?.total ?? items.length) || 0,
          page: Number(meta.page ?? resp?.page ?? 1) || 1,
          limit: Number(meta.limit ?? resp?.limit ?? items.length) || items.length,
        };
      },
      providesTags: (res) => [
        { type: 'DealList', id: 'LIST' },
        ...(res?.items || []).map((d) => ({ type: 'Deal', id: d.id })),
      ],
      keepUnusedDataFor: 60,
    }),

    getDealById: build.query({
      query: (dealId) => ({ url: `/deals/${encodeURIComponent(dealId)}`, method: 'GET' }),
      providesTags: (_res, _err, id) => [{ type: 'Deal', id }],
    }),

    createDeal: build.mutation({
      query: (payload) => ({
        url: '/deals',
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: [{ type: 'DealList', id: 'LIST' }],
    }),

    updateDeal: build.mutation({
      query: ({ dealId, payload }) => ({
        url: `/deals/${encodeURIComponent(dealId)}`,
        method: 'PUT',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: (_res, _err, { dealId }) => [
        { type: 'Deal', id: dealId },
        { type: 'DealList', id: 'LIST' },
      ],
    }),

    deleteDeal: build.mutation({
      query: (dealId) => ({
        url: `/deals/${encodeURIComponent(dealId)}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'DealList', id: 'LIST' }],
    }),

    markWon: build.mutation({
      query: (dealId) => ({
        url: `/deals/${encodeURIComponent(dealId)}`,
        method: 'PUT',
        body: { status: 'won' },
      }),
      invalidatesTags: (_res, _err, dealId) => [
        { type: 'Deal', id: dealId },
        { type: 'DealList', id: 'LIST' },
      ],
    }),

    markLost: build.mutation({
      query: (dealId) => ({
        url: `/deals/${encodeURIComponent(dealId)}`,
        method: 'PUT',
        body: { status: 'lost' },
      }),
      invalidatesTags: (_res, _err, dealId) => [
        { type: 'Deal', id: dealId },
        { type: 'DealList', id: 'LIST' },
      ],
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetDealsQuery,
  useGetDealByIdQuery,
  useCreateDealMutation,
  useUpdateDealMutation,
  useDeleteDealMutation,
  useMarkWonMutation,
  useMarkLostMutation,
} = dealsApi;
