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

export const tasksApi = crmApi.injectEndpoints({
    // endpoints: описывает набор endpoint-ов RTK Query.
endpoints: (build) => ({
    listTasks: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (params = {}) => ({
        url: params?.calendar ? '/tasks/calendar' : '/tasks',
        params: stripCompanyId(
          params?.calendar
            ? Object.fromEntries(Object.entries(params).filter(([key]) => key !== 'calendar' && key !== 'page' && key !== 'limit'))
            : params
        ),
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => {
        const items = Array.isArray(resp)
          ? resp
          : Array.isArray(resp?.items)
            ? resp.items
            : Array.isArray(resp?.data)
              ? resp.data
              : [];

        const meta = resp?.meta || {};
        const total = Number(meta.count ?? resp?.total ?? items.length) || 0;
        const page = Number(meta.page ?? resp?.page ?? 1) || 1;
        const limit = Number(meta.limit ?? resp?.limit ?? 25) || 25;
        const totalPages =
          Number(meta.totalPages ?? resp?.totalPages ?? Math.max(1, Math.ceil(total / Math.max(limit, 1)))) || 1;

        return { items, total, page, limit, totalPages };
      },
            // providesTags: возвращает теги кэша для автообновления данных.
providesTags: (res) => [
        { type: 'TaskList', id: 'LIST' },
        ...(res?.items || []).map((t) => ({ type: 'Task', id: t.id })),
      ],
      keepUnusedDataFor: 300,
      refetchOnFocus: false,
      refetchOnReconnect: false,
    }),

    getTask: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (id) => ({ url: `/tasks/${encodeURIComponent(id)}`, method: 'GET' }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
            // providesTags: возвращает теги кэша для автообновления данных.
providesTags: (res) => (res ? [{ type: 'Task', id: res.id }] : []),
    }),

    createTask: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (payload) => ({
        url: '/tasks',
        method: 'POST',
        body: stripCompanyId(payload),
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
      invalidatesTags: [{ type: 'TaskList', id: 'LIST' }],
    }),

    updateTask: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ id, payload }) => ({
        url: `/tasks/${encodeURIComponent(id)}`,
        method: 'PUT',
        body: stripCompanyId(payload),
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (res) =>
        res
          ? [{ type: 'Task', id: res.id }, { type: 'TaskList', id: 'LIST' }]
          : [{ type: 'TaskList', id: 'LIST' }],
    }),

    deleteTask: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (id) => ({ url: `/tasks/${encodeURIComponent(id)}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'TaskList', id: 'LIST' }],
    }),

    restoreTask: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (id) => ({ url: `/tasks/${encodeURIComponent(id)}/restore`, method: 'POST' }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (res, err, id) => [
        { type: 'TaskList', id: 'LIST' },
        { type: 'Task', id },
      ],
    }),
  }),
  overrideExisting: true,
});

export const {
  useListTasksQuery,
  useGetTaskQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useRestoreTaskMutation,
} = tasksApi;
