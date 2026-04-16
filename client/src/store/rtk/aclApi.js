import { crmApi } from './crmApi';

export const aclApi = crmApi.injectEndpoints({
    // endpoints: описывает набор endpoint-ов RTK Query.
endpoints: (build) => ({
    listRoles: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: () => `/acl/roles`,
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.items ?? resp?.data ?? resp ?? [],
      providesTags: [{ type: 'ACL', id: 'ROLES' }],
    }),
    listPermissions: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: () => `/acl/permissions`,
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.items ?? resp?.data ?? resp ?? [],
      providesTags: [{ type: 'ACL', id: 'PERMS' }],
    }),
    userPermSummary: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (userId) => `/acl/users/${encodeURIComponent(userId)}/permissions/summary`,
    }),
    // NEW
    assignRoleToUser: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ userId, roleId }) => ({ url: `/acl/users/${userId}/roles/${roleId}`, method: 'POST' }),
      invalidatesTags: [{ type: 'ACL', id: 'ROLES' }],
    }),
    removeRoleFromUser: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ userId, roleId }) => ({ url: `/acl/users/${userId}/roles/${roleId}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'ACL', id: 'ROLES' }],
    }),
    allowPermForUser: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ userId, permId }) => ({ url: `/acl/users/${userId}/permissions/${permId}/allow`, method: 'POST' }),
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_r,_e,arg)=>[{ type:'ACL', id:`USER:${arg.userId}` }],
    }),
    denyPermForUser: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ userId, permId }) => ({ url: `/acl/users/${userId}/permissions/${permId}/deny`, method: 'POST' }),
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_r,_e,arg)=>[{ type:'ACL', id:`USER:${arg.userId}` }],
    }),
    clearPermOverride: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ userId, permId }) => ({ url: `/acl/users/${userId}/permissions/${permId}`, method: 'DELETE' }),
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_r,_e,arg)=>[{ type:'ACL', id:`USER:${arg.userId}` }],
    }),
  }),
});

export const {
  useListRolesQuery,
  useListPermissionsQuery,
  useUserPermSummaryQuery,
  useAssignRoleToUserMutation,
  useRemoveRoleFromUserMutation,
  useAllowPermForUserMutation,
  useDenyPermForUserMutation,
  useClearPermOverrideMutation,
} = aclApi;
