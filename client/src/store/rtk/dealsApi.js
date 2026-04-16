import { crmApi } from './crmApi';

// stripCompanyId: вспомогательная логика для слоя RTK Query.
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

// buildListParams: собирает итоговую структуру данных для слоя RTK Query.
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
    // endpoints: описывает набор endpoint-ов RTK Query.
endpoints: (build) => ({
    getDeals: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (args = {}) => ({
        url: '/deals',
        method: 'GET',
        params: buildListParams(args),
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
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
            // providesTags: возвращает теги кэша для автообновления данных.
providesTags: (res) => [
        { type: 'DealList', id: 'LIST' },
        ...(res?.items || []).map((d) => ({ type: 'Deal', id: d.id })),
      ],
      keepUnusedDataFor: 60,
    }),

    getDealById: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (dealId) => ({ url: `/deals/${encodeURIComponent(dealId)}`, method: 'GET' }),
            // providesTags: возвращает теги кэша для автообновления данных.
providesTags: (_res, _err, id) => [{ type: 'Deal', id }],
    }),

    createDeal: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (payload) => ({
        url: '/deals',
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: [{ type: 'DealList', id: 'LIST' }],
    }),

    updateDeal: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ dealId, payload }) => ({
        url: `/deals/${encodeURIComponent(dealId)}`,
        method: 'PUT',
        body: stripCompanyId(payload),
      }),
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_res, _err, { dealId }) => [
        { type: 'Deal', id: dealId },
        { type: 'DealList', id: 'LIST' },
      ],
    }),

    deleteDeal: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (dealId) => ({
        url: `/deals/${encodeURIComponent(dealId)}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'DealList', id: 'LIST' }],
    }),

    markWon: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (dealId) => ({
        url: `/deals/${encodeURIComponent(dealId)}`,
        method: 'PUT',
        body: { status: 'won' },
      }),
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_res, _err, dealId) => [
        { type: 'Deal', id: dealId },
        { type: 'DealList', id: 'LIST' },
      ],
    }),

    markLost: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (dealId) => ({
        url: `/deals/${encodeURIComponent(dealId)}`,
        method: 'PUT',
        body: { status: 'lost' },
      }),
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
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

