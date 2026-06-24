import { crmApi } from './crmApi';

export const departmentsApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    listDepartments: build.query({
      query: (params = {}) => ({
        url: '/departments',
        method: 'GET',
        params,
      }),
      transformResponse: (resp) => resp?.items ?? resp?.data ?? resp ?? [],
      providesTags: (res) => {
        const items = Array.isArray(res) ? res : [];
        return [
          { type: 'Department', id: 'LIST' },
          ...items.map((item) => ({ type: 'Department', id: item.id })),
        ];
      },
    }),
    getDepartment: build.query({
      query: (departmentId) => `/departments/${encodeURIComponent(departmentId)}`,
      providesTags: (_res, _err, departmentId) => [{ type: 'Department', id: departmentId }],
    }),
    getCounterpartyScopeReadiness: build.query({
      query: () => '/departments/scope-readiness/counterparties',
      providesTags: [{ type: 'Department', id: 'SCOPE_READINESS' }],
    }),
    createDepartment: build.mutation({
      query: (body) => ({ url: '/departments', method: 'POST', body }),
      invalidatesTags: [
        { type: 'Department', id: 'LIST' },
        { type: 'Department', id: 'SCOPE_READINESS' },
      ],
    }),
    updateDepartment: build.mutation({
      query: ({ departmentId, body }) => ({
        url: `/departments/${encodeURIComponent(departmentId)}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_res, _err, { departmentId }) => [
        { type: 'Department', id: 'LIST' },
        { type: 'Department', id: departmentId },
        { type: 'Department', id: 'SCOPE_READINESS' },
      ],
    }),
    archiveDepartment: build.mutation({
      query: (departmentId) => ({
        url: `/departments/${encodeURIComponent(departmentId)}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_res, _err, departmentId) => [
        { type: 'Department', id: 'LIST' },
        { type: 'Department', id: departmentId },
        { type: 'Department', id: 'SCOPE_READINESS' },
      ],
    }),
    restoreDepartment: build.mutation({
      query: (departmentId) => ({
        url: `/departments/${encodeURIComponent(departmentId)}/restore`,
        method: 'POST',
      }),
      invalidatesTags: (_res, _err, departmentId) => [
        { type: 'Department', id: 'LIST' },
        { type: 'Department', id: departmentId },
        { type: 'Department', id: 'SCOPE_READINESS' },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListDepartmentsQuery,
  useGetDepartmentQuery,
  useGetCounterpartyScopeReadinessQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useArchiveDepartmentMutation,
  useRestoreDepartmentMutation,
} = departmentsApi;
