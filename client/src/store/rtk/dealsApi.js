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

const normalizeDealAction = (arg) => {
  if (arg && typeof arg === 'object') {
    return {
      dealId: arg.dealId || arg.id,
      payload: stripCompanyId(arg.payload || arg.body || {}),
    };
  }
  return { dealId: arg, payload: {} };
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

    getDealsBoard: build.query({
      query: (args = {}) => ({
        url: '/deals/board',
        method: 'GET',
        params: buildListParams(args),
      }),
      transformResponse: (resp) => ({
        pipeline: resp?.pipeline || null,
        stages: Array.isArray(resp?.stages) ? resp.stages : [],
        totals: resp?.totals || { count: 0, sum: {}, weighted: {} },
        reason: resp?.reason || null,
      }),
      providesTags: (res) => [
        { type: 'DealList', id: 'BOARD' },
        ...(res?.stages || []).flatMap((stage) => (
          Array.isArray(stage.deals)
            ? stage.deals.map((deal) => ({ type: 'Deal', id: deal.id }))
            : []
        )),
      ],
      keepUnusedDataFor: 30,
    }),

    getDealById: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (dealId) => ({ url: `/deals/${encodeURIComponent(dealId)}`, method: 'GET' }),
            // providesTags: возвращает теги кэша для автообновления данных.
providesTags: (_res, _err, id) => [{ type: 'Deal', id }],
    }),

    getDealActivities: build.query({
      query: ({ dealId, type, limit = 50 } = {}) => ({
        url: `/deals/${encodeURIComponent(dealId)}/activities`,
        method: 'GET',
        params: {
          ...(type ? { type } : {}),
          limit,
        },
      }),
      transformResponse: (resp) => (Array.isArray(resp?.data) ? resp.data : Array.isArray(resp) ? resp : []),
      providesTags: (_res, _err, arg) => [{ type: 'DealActivity', id: arg?.dealId }],
      keepUnusedDataFor: 30,
    }),

    createDealActivity: build.mutation({
      query: ({ dealId, payload }) => ({
        url: `/deals/${encodeURIComponent(dealId)}/activities`,
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'DealActivity', id: arg?.dealId },
      ],
    }),

    deleteDealActivity: build.mutation({
      query: ({ dealId, activityId }) => ({
        url: `/deals/${encodeURIComponent(dealId)}/activities/${encodeURIComponent(activityId)}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'DealActivity', id: arg?.dealId },
      ],
    }),

    getPipelines: build.query({
      query: () => ({
        url: '/pipelines',
        method: 'GET',
      }),
      transformResponse: (resp) => (Array.isArray(resp) ? resp : []),
      providesTags: [{ type: 'DealList', id: 'PIPELINES' }],
      keepUnusedDataFor: 120,
    }),

    createPipeline: build.mutation({
      query: (payload) => ({
        url: '/pipelines',
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: [
        { type: 'DealList', id: 'PIPELINES' },
        { type: 'DealList', id: 'LIST' },
        { type: 'DealList', id: 'BOARD' },
      ],
    }),

    updatePipeline: build.mutation({
      query: ({ pipelineId, payload }) => ({
        url: `/pipelines/${encodeURIComponent(pipelineId)}`,
        method: 'PUT',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: [
        { type: 'DealList', id: 'PIPELINES' },
        { type: 'DealList', id: 'LIST' },
        { type: 'DealList', id: 'BOARD' },
      ],
    }),

    deletePipeline: build.mutation({
      query: (pipelineId) => ({
        url: `/pipelines/${encodeURIComponent(pipelineId)}`,
        method: 'DELETE',
      }),
      invalidatesTags: [
        { type: 'DealList', id: 'PIPELINES' },
        { type: 'DealList', id: 'LIST' },
        { type: 'DealList', id: 'BOARD' },
      ],
    }),

    reorderPipelines: build.mutation({
      query: (orderedPipelineIds) => ({
        url: '/pipelines/reorder',
        method: 'PUT',
        body: { orderedPipelineIds },
      }),
      invalidatesTags: [
        { type: 'DealList', id: 'PIPELINES' },
        { type: 'DealList', id: 'LIST' },
        { type: 'DealList', id: 'BOARD' },
      ],
    }),

    createPipelineStage: build.mutation({
      query: ({ pipelineId, payload }) => ({
        url: `/pipelines/${encodeURIComponent(pipelineId)}/stages`,
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: [
        { type: 'DealList', id: 'PIPELINES' },
        { type: 'DealList', id: 'LIST' },
        { type: 'DealList', id: 'BOARD' },
      ],
    }),

    updatePipelineStage: build.mutation({
      query: ({ pipelineId, stageId, payload }) => ({
        url: `/pipelines/${encodeURIComponent(pipelineId)}/stages/${encodeURIComponent(stageId)}`,
        method: 'PUT',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: [
        { type: 'DealList', id: 'PIPELINES' },
        { type: 'DealList', id: 'LIST' },
        { type: 'DealList', id: 'BOARD' },
      ],
    }),

    deletePipelineStage: build.mutation({
      query: ({ pipelineId, stageId, replacementStageId }) => ({
        url: `/pipelines/${encodeURIComponent(pipelineId)}/stages/${encodeURIComponent(stageId)}`,
        method: 'DELETE',
        body: replacementStageId ? { replacementStageId } : {},
      }),
      invalidatesTags: [
        { type: 'DealList', id: 'PIPELINES' },
        { type: 'DealList', id: 'LIST' },
        { type: 'DealList', id: 'BOARD' },
      ],
    }),

    reorderPipelineStages: build.mutation({
      query: ({ pipelineId, orderedStageIds }) => ({
        url: `/pipelines/${encodeURIComponent(pipelineId)}/stages/reorder`,
        method: 'PUT',
        body: { orderedStageIds },
      }),
      invalidatesTags: [
        { type: 'DealList', id: 'PIPELINES' },
        { type: 'DealList', id: 'LIST' },
        { type: 'DealList', id: 'BOARD' },
      ],
    }),

    getDealSettings: build.query({
      query: () => ({
        url: '/company-settings/deals',
        method: 'GET',
      }),
      providesTags: [{ type: 'DealSettings', id: 'GENERAL' }],
      keepUnusedDataFor: 120,
    }),

    updateDealSettings: build.mutation({
      query: (payload) => ({
        url: '/company-settings/deals',
        method: 'PUT',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: [
        { type: 'DealSettings', id: 'GENERAL' },
        { type: 'DealList', id: 'PIPELINES' },
        { type: 'DealList', id: 'BOARD' },
      ],
    }),

    getLostReasons: build.query({
      query: () => ({
        url: '/company-settings/deals/lost-reasons',
        method: 'GET',
      }),
      transformResponse: (resp) => (Array.isArray(resp) ? resp : []),
      providesTags: [{ type: 'DealSettings', id: 'LOST_REASONS' }],
      keepUnusedDataFor: 120,
    }),

    createLostReason: build.mutation({
      query: (payload) => ({
        url: '/company-settings/deals/lost-reasons',
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: [{ type: 'DealSettings', id: 'LOST_REASONS' }],
    }),

    updateLostReason: build.mutation({
      query: ({ lostReasonId, payload }) => ({
        url: `/company-settings/deals/lost-reasons/${encodeURIComponent(lostReasonId)}`,
        method: 'PUT',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: [{ type: 'DealSettings', id: 'LOST_REASONS' }],
    }),

    deleteLostReason: build.mutation({
      query: (lostReasonId) => ({
        url: `/company-settings/deals/lost-reasons/${encodeURIComponent(lostReasonId)}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'DealSettings', id: 'LOST_REASONS' }],
    }),

    reorderLostReasons: build.mutation({
      query: (orderedLostReasonIds) => ({
        url: '/company-settings/deals/lost-reasons/reorder',
        method: 'PUT',
        body: { orderedLostReasonIds },
      }),
      invalidatesTags: [{ type: 'DealSettings', id: 'LOST_REASONS' }],
    }),

    createDeal: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (payload) => ({
        url: '/deals',
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      invalidatesTags: [
        { type: 'DealList', id: 'LIST' },
        { type: 'DealList', id: 'BOARD' },
      ],
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
        { type: 'DealList', id: 'BOARD' },
      ],
    }),

    deleteDeal: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (dealId) => ({
        url: `/deals/${encodeURIComponent(dealId)}`,
        method: 'DELETE',
      }),
      invalidatesTags: [
        { type: 'DealList', id: 'LIST' },
        { type: 'DealList', id: 'BOARD' },
      ],
    }),

    markWon: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (arg) => {
        const { dealId, payload } = normalizeDealAction(arg);
        return {
          url: `/deals/${encodeURIComponent(dealId)}/win`,
          method: 'POST',
          body: payload,
        };
      },
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_res, _err, arg) => [
        { type: 'Deal', id: normalizeDealAction(arg).dealId },
        { type: 'DealActivity', id: normalizeDealAction(arg).dealId },
        { type: 'DealList', id: 'LIST' },
        { type: 'DealList', id: 'BOARD' },
      ],
    }),

    markLost: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (arg) => {
        const { dealId, payload } = normalizeDealAction(arg);
        return {
          url: `/deals/${encodeURIComponent(dealId)}/lose`,
          method: 'POST',
          body: payload,
        };
      },
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_res, _err, arg) => [
        { type: 'Deal', id: normalizeDealAction(arg).dealId },
        { type: 'DealActivity', id: normalizeDealAction(arg).dealId },
        { type: 'DealList', id: 'LIST' },
        { type: 'DealList', id: 'BOARD' },
      ],
    }),

    moveDealStage: build.mutation({
      query: ({ dealId, stageId }) => ({
        url: `/deals/${encodeURIComponent(dealId)}/stage`,
        method: 'PUT',
        body: { stageId },
      }),
      invalidatesTags: (_res, _err, { dealId }) => [
        { type: 'Deal', id: dealId },
        { type: 'DealActivity', id: dealId },
        { type: 'DealList', id: 'LIST' },
        { type: 'DealList', id: 'BOARD' },
      ],
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetDealsQuery,
  useGetDealsBoardQuery,
  useGetDealByIdQuery,
  useGetDealActivitiesQuery,
  useCreateDealActivityMutation,
  useDeleteDealActivityMutation,
  useGetPipelinesQuery,
  useCreateDealMutation,
  useUpdateDealMutation,
  useDeleteDealMutation,
  useMarkWonMutation,
  useMarkLostMutation,
  useMoveDealStageMutation,
  useCreatePipelineMutation,
  useUpdatePipelineMutation,
  useDeletePipelineMutation,
  useReorderPipelinesMutation,
  useCreatePipelineStageMutation,
  useUpdatePipelineStageMutation,
  useDeletePipelineStageMutation,
  useReorderPipelineStagesMutation,
  useGetDealSettingsQuery,
  useUpdateDealSettingsMutation,
  useGetLostReasonsQuery,
  useCreateLostReasonMutation,
  useUpdateLostReasonMutation,
  useDeleteLostReasonMutation,
  useReorderLostReasonsMutation,
} = dealsApi;
