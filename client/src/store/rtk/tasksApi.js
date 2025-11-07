import { crmApi, getCompanyId } from './crmApi';

export const tasksApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    listTasks: build.query({
      query: (params = {}) => ({ url: `/tasks/${getCompanyId()}`, params }),
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
      query: (id) => ({ url: `/tasks/${getCompanyId()}/${encodeURIComponent(id)}`, method: 'GET' }),
      transformResponse: (resp) => resp?.data ?? resp,
      providesTags: (res) => (res ? [{ type: 'Task', id: res.id }] : []),
    }),

    createTask: build.mutation({
      query: (payload) => ({ url: `/tasks/${getCompanyId()}`, method: 'POST', body: payload }),
      transformResponse: (resp) => resp?.data ?? resp,
      invalidatesTags: [{ type: 'TaskList', id: 'LIST' }],
    }),

    updateTask: build.mutation({
      query: ({ id, payload }) => ({
        url: `/tasks/${getCompanyId()}/${encodeURIComponent(id)}`,
        method: 'PUT',
        body: payload,
      }),
      transformResponse: (resp) => resp?.data ?? resp,
      invalidatesTags: (res) =>
        res
          ? [{ type: 'Task', id: res.id }, { type: 'TaskList', id: 'LIST' }]
          : [{ type: 'TaskList', id: 'LIST' }],
    }),

    deleteTask: build.mutation({
      query: (id) => ({ url: `/tasks/${getCompanyId()}/${encodeURIComponent(id)}`, method: 'DELETE' }),
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