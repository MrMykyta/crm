import { crmApi } from './crmApi';

export const aclApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    listRoles: build.query({
      query: () => `/acl/roles`,
      transformResponse: (resp) => resp?.items ?? resp?.data ?? resp ?? [],
      providesTags: [{ type: 'ACL', id: 'ROLES' }],
    }),
    listPermissions: build.query({
      query: () => `/acl/permissions`,
      transformResponse: (resp) => resp?.items ?? resp?.data ?? resp ?? [],
      providesTags: [{ type: 'ACL', id: 'PERMS' }],
    }),
    userPermSummary: build.query({
      query: (userId) => `/acl/users/${encodeURIComponent(userId)}/permissions/summary`,
    }),
    // NEW
    assignRoleToUser: build.mutation({
      query: ({ userId, roleId }) => ({ url: `/acl/users/${userId}/roles/${roleId}`, method: 'POST' }),
      invalidatesTags: [{ type: 'ACL', id: 'ROLES' }],
    }),
    removeRoleFromUser: build.mutation({
      query: ({ userId, roleId }) => ({ url: `/acl/users/${userId}/roles/${roleId}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'ACL', id: 'ROLES' }],
    }),
    allowPermForUser: build.mutation({
      query: ({ userId, permId }) => ({ url: `/acl/users/${userId}/permissions/${permId}/allow`, method: 'POST' }),
      invalidatesTags: (_r,_e,arg)=>[{ type:'ACL', id:`USER:${arg.userId}` }],
    }),
    denyPermForUser: build.mutation({
      query: ({ userId, permId }) => ({ url: `/acl/users/${userId}/permissions/${permId}/deny`, method: 'POST' }),
      invalidatesTags: (_r,_e,arg)=>[{ type:'ACL', id:`USER:${arg.userId}` }],
    }),
    clearPermOverride: build.mutation({
      query: ({ userId, permId }) => ({ url: `/acl/users/${userId}/permissions/${permId}`, method: 'DELETE' }),
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