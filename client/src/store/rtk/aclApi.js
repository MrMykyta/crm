import { crmApi } from './crmApi';

function rolePermissionNames(role) {
  const rows = Array.isArray(role?.permissions)
    ? role.permissions
    : Array.isArray(role?.Permissions)
      ? role.Permissions
      : [];
  return rows
    .map((permission) => permission?.name || permission?.code || permission?.slug || permission)
    .filter(Boolean)
    .map((name) => String(name));
}

function rolePermissionRows(role) {
  return Array.isArray(role?.permissions)
    ? role.permissions
    : Array.isArray(role?.Permissions)
      ? role.Permissions
      : [];
}

function applyPermissionResolution(permission) {
  if (!permission) return;
  permission.effective = Boolean((permission.viaRole || permission.viaUserAllow) && !permission.viaUserDeny);
}

function patchRolePermissionRows(role, permission, assigned) {
  if (!role || !permission) return;
  if (!Array.isArray(role.permissions)) {
    role.permissions = rolePermissionRows(role).filter(Boolean);
  }
  const exists = role.permissions.some((item) => String(item.id) === String(permission.id));
  if (assigned && !exists) {
    role.permissions.push(permission);
    role.permissions.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
  }
  if (!assigned && exists) {
    role.permissions = role.permissions.filter((item) => String(item.id) !== String(permission.id));
  }
}

function permissionFromCache(getState, permId) {
  const permissions = aclApi.endpoints.listPermissions.select()(getState())?.data || [];
  return permissions.find((item) => String(item.id) === String(permId));
}

function patchPermission(draft, permId, recipe) {
  if (!Array.isArray(draft?.permissions)) return;
  const permission = draft.permissions.find((item) => String(item.id) === String(permId));
  if (!permission) return;
  recipe(permission);
  applyPermissionResolution(permission);
}

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
    getRole: build.query({
      query: (roleId) => `/acl/roles/${encodeURIComponent(roleId)}`,
      providesTags: (_res, _err, roleId) => [{ type: 'ACL', id: `ROLE:${roleId}` }],
    }),
    getRoleDiff: build.query({
      query: ({ roleId, templateId } = {}) => {
        const params = templateId ? `?templateId=${encodeURIComponent(templateId)}` : '';
        return `/acl/roles/${encodeURIComponent(roleId)}/diff${params}`;
      },
      providesTags: (_res, _err, arg) => [{ type: 'ACL', id: `ROLE_DIFF:${arg?.roleId || 'unknown'}:${arg?.templateId || 'default'}` }],
    }),
    listRoleTemplates: build.query({
      query: () => '/acl/role-templates',
      transformResponse: (resp) => resp?.items ?? resp?.data ?? resp ?? [],
      providesTags: [{ type: 'ACL', id: 'ROLE_TEMPLATES' }],
    }),
    createRole: build.mutation({
      query: (body) => ({ url: '/acl/roles', method: 'POST', body }),
      invalidatesTags: [{ type: 'ACL', id: 'ROLES' }],
    }),
    createRoleFromTemplate: build.mutation({
      query: (templateId) => ({
        url: `/acl/role-templates/${encodeURIComponent(templateId)}/roles`,
        method: 'POST',
      }),
      invalidatesTags: (res) => [
        { type: 'ACL', id: 'ROLES' },
        ...(res?.id ? [{ type: 'ACL', id: `ROLE:${res.id}` }] : []),
      ],
    }),
    cloneRole: build.mutation({
      query: (roleId) => ({
        url: `/acl/roles/${encodeURIComponent(roleId)}/clone`,
        method: 'POST',
      }),
      invalidatesTags: (res) => [
        { type: 'ACL', id: 'ROLES' },
        ...(res?.id ? [{ type: 'ACL', id: `ROLE:${res.id}` }] : []),
      ],
    }),
    resetDefaultRole: build.mutation({
      query: (roleId) => ({
        url: `/acl/roles/${encodeURIComponent(roleId)}/reset-default`,
        method: 'POST',
      }),
      invalidatesTags: (_res, _err, roleId) => [
        { type: 'ACL', id: 'ROLES' },
        { type: 'ACL', id: `ROLE:${roleId}` },
        { type: 'ACL', id: `ROLE_DIFF:${roleId}:default` },
        { type: 'UserPermissionSummary' },
      ],
    }),
    updateRole: build.mutation({
      query: ({ roleId, body }) => ({ url: `/acl/roles/${encodeURIComponent(roleId)}`, method: 'PUT', body }),
      invalidatesTags: (_res, _err, { roleId }) => [
        { type: 'ACL', id: 'ROLES' },
        { type: 'ACL', id: `ROLE:${roleId}` },
      ],
    }),
    deleteRole: build.mutation({
      query: (roleId) => ({ url: `/acl/roles/${encodeURIComponent(roleId)}`, method: 'DELETE' }),
      invalidatesTags: (_res, _err, roleId) => [
        { type: 'ACL', id: 'ROLES' },
        { type: 'ACL', id: `ROLE:${roleId}` },
      ],
    }),
    reassignAndDeleteRole: build.mutation({
      query: ({ roleId, targetRoleId }) => ({
        url: `/acl/roles/${encodeURIComponent(roleId)}/reassign-delete`,
        method: 'POST',
        body: { targetRoleId },
      }),
      invalidatesTags: (_res, _err, { roleId, targetRoleId }) => [
        { type: 'ACL', id: 'ROLES' },
        { type: 'ACL', id: `ROLE:${roleId}` },
        { type: 'ACL', id: `ROLE:${targetRoleId}` },
        { type: 'UserRoles' },
        { type: 'UserPermissionSummary' },
      ],
    }),
    assignPermToRole: build.mutation({
      query: ({ roleId, permId }) => ({
        url: `/acl/roles/${encodeURIComponent(roleId)}/permissions/${encodeURIComponent(permId)}`,
        method: 'POST',
      }),
      async onQueryStarted({ roleId, permId }, { dispatch, getState, queryFulfilled }) {
        const permission = permissionFromCache(getState, permId);
        const patches = [
          dispatch(crmApi.util.updateQueryData('listRoles', undefined, (draft) => {
            const role = Array.isArray(draft) ? draft.find((item) => String(item.id) === String(roleId)) : null;
            patchRolePermissionRows(role, permission, true);
          })),
          dispatch(crmApi.util.updateQueryData('getRole', roleId, (draft) => {
            patchRolePermissionRows(draft, permission, true);
          })),
        ];
        try {
          await queryFulfilled;
        } catch {
          patches.forEach((patch) => patch.undo?.());
        }
      },
      invalidatesTags: (_res, _err, { roleId }) => [
        { type: 'ACL', id: 'ROLES' },
        { type: 'ACL', id: `ROLE:${roleId}` },
        { type: 'UserPermissionSummary' },
      ],
    }),
    removePermFromRole: build.mutation({
      query: ({ roleId, permId }) => ({
        url: `/acl/roles/${encodeURIComponent(roleId)}/permissions/${encodeURIComponent(permId)}`,
        method: 'DELETE',
      }),
      async onQueryStarted({ roleId, permId }, { dispatch, getState, queryFulfilled }) {
        const permission = permissionFromCache(getState, permId);
        const patches = [
          dispatch(crmApi.util.updateQueryData('listRoles', undefined, (draft) => {
            const role = Array.isArray(draft) ? draft.find((item) => String(item.id) === String(roleId)) : null;
            patchRolePermissionRows(role, permission, false);
          })),
          dispatch(crmApi.util.updateQueryData('getRole', roleId, (draft) => {
            patchRolePermissionRows(draft, permission, false);
          })),
        ];
        try {
          await queryFulfilled;
        } catch {
          patches.forEach((patch) => patch.undo?.());
        }
      },
      invalidatesTags: (_res, _err, { roleId }) => [
        { type: 'ACL', id: 'ROLES' },
        { type: 'ACL', id: `ROLE:${roleId}` },
        { type: 'UserPermissionSummary' },
      ],
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
      providesTags: (_res, _err, userId) => [
        { type: 'UserRoles', id: userId },
        { type: 'UserPermissionSummary', id: userId },
      ],
    }),
    // NEW
    assignRoleToUser: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ userId, roleId }) => ({ url: `/acl/users/${userId}/roles/${roleId}`, method: 'POST' }),
      async onQueryStarted({ userId, roleId }, { dispatch, getState, queryFulfilled }) {
        const roles = aclApi.endpoints.listRoles.select()(getState())?.data || [];
        const role = roles.find((item) => String(item.id) === String(roleId));
        const patch = dispatch(crmApi.util.updateQueryData('userPermSummary', userId, (draft) => {
          if (!role || !draft) return;
          if (Array.isArray(draft.roles) && !draft.roles.some((item) => String(item.id) === String(roleId))) {
            draft.roles.push(role);
          }
          const names = new Set(rolePermissionNames(role));
          if (Array.isArray(draft.permissions)) {
            for (const permission of draft.permissions) {
              if (!names.has(permission.name)) continue;
              permission.viaRole = true;
              applyPermissionResolution(permission);
            }
          }
        }));
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_res, _err, { userId }) => [
        { type: 'UserRoles', id: userId },
        { type: 'UserPermissionSummary', id: userId },
      ],
    }),
    removeRoleFromUser: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ userId, roleId }) => ({ url: `/acl/users/${userId}/roles/${roleId}`, method: 'DELETE' }),
      async onQueryStarted({ userId, roleId }, { dispatch, getState, queryFulfilled }) {
        const roles = aclApi.endpoints.listRoles.select()(getState())?.data || [];
        const removedRole = roles.find((item) => String(item.id) === String(roleId));
        const patch = dispatch(crmApi.util.updateQueryData('userPermSummary', userId, (draft) => {
          if (!draft) return;
          if (Array.isArray(draft.roles)) {
            draft.roles = draft.roles.filter((item) => String(item.id) !== String(roleId));
          }
          if (!removedRole || !Array.isArray(draft.permissions)) return;
          const removedNames = new Set(rolePermissionNames(removedRole));
          const remainingRoleNames = new Set((Array.isArray(draft.roles) ? draft.roles : []).flatMap(rolePermissionNames));
          for (const permission of draft.permissions) {
            if (!removedNames.has(permission.name)) continue;
            permission.viaRole = remainingRoleNames.has(permission.name);
            applyPermissionResolution(permission);
          }
        }));
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_res, _err, { userId }) => [
        { type: 'UserRoles', id: userId },
        { type: 'UserPermissionSummary', id: userId },
      ],
    }),
    allowPermForUser: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ userId, permId }) => ({ url: `/acl/users/${userId}/permissions/${permId}/allow`, method: 'POST' }),
      async onQueryStarted({ userId, permId }, { dispatch, queryFulfilled }) {
        const patch = dispatch(crmApi.util.updateQueryData('userPermSummary', userId, (draft) => {
          patchPermission(draft, permId, (permission) => {
            permission.viaUserAllow = true;
            permission.viaUserDeny = false;
          });
        }));
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_r,_e,arg)=>[{ type:'UserPermissionSummary', id:arg.userId }],
    }),
    denyPermForUser: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ userId, permId }) => ({ url: `/acl/users/${userId}/permissions/${permId}/deny`, method: 'POST' }),
      async onQueryStarted({ userId, permId }, { dispatch, queryFulfilled }) {
        const patch = dispatch(crmApi.util.updateQueryData('userPermSummary', userId, (draft) => {
          patchPermission(draft, permId, (permission) => {
            permission.viaUserAllow = false;
            permission.viaUserDeny = true;
          });
        }));
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_r,_e,arg)=>[{ type:'UserPermissionSummary', id:arg.userId }],
    }),
    clearPermOverride: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ userId, permId }) => ({ url: `/acl/users/${userId}/permissions/${permId}`, method: 'DELETE' }),
      async onQueryStarted({ userId, permId }, { dispatch, queryFulfilled }) {
        const patch = dispatch(crmApi.util.updateQueryData('userPermSummary', userId, (draft) => {
          patchPermission(draft, permId, (permission) => {
            permission.viaUserAllow = false;
            permission.viaUserDeny = false;
          });
        }));
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_r,_e,arg)=>[{ type:'UserPermissionSummary', id:arg.userId }],
    }),
  }),
});

export const {
  useListRolesQuery,
  useGetRoleQuery,
  useGetRoleDiffQuery,
  useListRoleTemplatesQuery,
  useCreateRoleMutation,
  useCreateRoleFromTemplateMutation,
  useCloneRoleMutation,
  useResetDefaultRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useReassignAndDeleteRoleMutation,
  useAssignPermToRoleMutation,
  useRemovePermFromRoleMutation,
  useListPermissionsQuery,
  useUserPermSummaryQuery,
  useAssignRoleToUserMutation,
  useRemoveRoleFromUserMutation,
  useAllowPermForUserMutation,
  useDenyPermForUserMutation,
  useClearPermOverrideMutation,
} = aclApi;
