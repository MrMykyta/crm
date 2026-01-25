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

export const tasksApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    listTasks: build.query({
      query: (params = {}) => ({
        url: '/tasks',
        params: stripCompanyId(params),
      }),
      transformResponse: (resp) =>
        Array.isArray(resp) ? { items: resp, total: resp.length, page: 1, limit: resp.length } : resp,
      providesTags: (res) => [
        { type: 'TaskList', id: 'LIST' },
        ...(res?.items || []).map((t) => ({ type: 'Task', id: t.id })),
      ],
      keepUnusedDataFor: 300,
      refetchOnFocus: false,
      refetchOnReconnect: false,
    }),

    getTask: build.query({
      query: (id) => ({ url: `/tasks/${encodeURIComponent(id)}`, method: 'GET' }),
      transformResponse: (resp) => resp?.data ?? resp,
      providesTags: (res) => (res ? [{ type: 'Task', id: res.id }] : []),
    }),

    createTask: build.mutation({
      query: (payload) => ({
        url: '/tasks',
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      transformResponse: (resp) => resp?.data ?? resp,
      invalidatesTags: [{ type: 'TaskList', id: 'LIST' }],
    }),

    updateTask: build.mutation({
      query: ({ id, payload }) => ({
        url: `/tasks/${encodeURIComponent(id)}`,
        method: 'PUT',
        body: stripCompanyId(payload),
      }),
      transformResponse: (resp) => resp?.data ?? resp,
      invalidatesTags: (res) =>
        res
          ? [{ type: 'Task', id: res.id }, { type: 'TaskList', id: 'LIST' }]
          : [{ type: 'TaskList', id: 'LIST' }],
    }),

    deleteTask: build.mutation({
      query: (id) => ({ url: `/tasks/${encodeURIComponent(id)}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'TaskList', id: 'LIST' }],
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
} = tasksApi;
