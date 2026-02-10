import { crmApi, getCompanyId } from './crmApi';

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

export const companyUsersApi = crmApi.injectEndpoints({
  endpoints: (build) => ({

    // ---------- MEMBERS LIST ----------
    listCompanyUsers: build.query({
      query: (params = {}) => ({
        url: '/members/users',
        method: 'GET',
        params: stripCompanyId(params),
      }),
      transformResponse: (resp) =>
        Array.isArray(resp)
          ? { items: resp, total: resp.length, page: 1, limit: resp.length }
          : resp,
      providesTags: (res) => {
        const items = Array.isArray(res?.items) ? res.items : [];
        return [
          { type: 'CompanyUser', id: 'LIST' },
          ...items.map((u) => ({ type: 'CompanyUser', id: u.userId || u.id })),
        ];
      },
      keepUnusedDataFor: 120,
    }),

    // ---------- MEMBER DETAIL ----------
    getCompanyUser: build.query({
      // GET /users/:userId
      query: (userId) => ({
        url: `/users/${encodeURIComponent(userId)}`,
        method: 'GET',
      }),
      transformResponse: (resp) => resp?.data ?? resp,
      providesTags: (_res, _err, userId) => [{ type: 'CompanyUser', id: userId }],
      keepUnusedDataFor: 120,
    }),

    // ---------- UPDATE MEMBER (профиль в рамках компании) ----------
    updateCompanyUser: build.mutation({
      // PATCH /users/:userId
      query: ({ userId, body }) => ({
        url: `/users/${encodeURIComponent(userId)}`,
        method: 'PATCH',
        body: stripCompanyId(body),
      }),
      transformResponse: (resp) => resp?.data ?? resp,
      invalidatesTags: (_res, _err, { userId }) => [
        { type: 'CompanyUser', id: userId },
        { type: 'CompanyUser', id: 'LIST' },
      ],
    }),

    // ---------- ADD MEMBER ----------
    addMember: build.mutation({
      query: (body) => ({
        url: '/members/users',
        method: 'POST',
        body: stripCompanyId(body),
      }),
      invalidatesTags: [{ type: 'CompanyUser', id: 'LIST' }],
    }),

    // ---------- REMOVE MEMBER ----------
    removeUser: build.mutation({
      // DELETE /members/users/:userId
      query: (userId) => ({
        url: `/members/users/${encodeURIComponent(userId)}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'CompanyUser', id: 'LIST' }],
    }),

    // ---------- UPDATE ROLE ----------
    updateUserRole: build.mutation({
      // PUT /members/users/:userId/role
      query: ({ userId, role, status }) => ({
        url: `/members/users/${encodeURIComponent(userId)}/role`,
        method: 'PUT',
        body: { role, status },
      }),
      invalidatesTags: (res, err, arg) => [
        { type: 'CompanyUser', id: arg.userId },
        { type: 'CompanyUser', id: 'LIST' },
      ],
    }),

    // ---------- INVITATIONS LIST ----------
    listInvitations: build.query({
      query: (params = {}) => ({
        url: `/invitations/companies/${getCompanyId()}/invitations`,
        method: 'GET',
        params: stripCompanyId(params),
      }),
      transformResponse: (resp) =>
        Array.isArray(resp)
          ? { items: resp, total: resp.length, page: 1, limit: resp.length }
          : resp,
      providesTags: (res) => {
        const items = Array.isArray(res?.items) ? res.items : [];
        return [
          { type: 'CompanyUser', id: 'INVITES' },
          ...items.map((i) => ({ type: 'CompanyUser', id: `invite:${i.id}` })),
        ];
      },
      refetchOnMountOrArgChange: true,
      keepUnusedDataFor: 120,
    }),

    // ---------- INVITE / RESEND / REVOKE ----------
    inviteUser: build.mutation({
      query: (body) => ({
        url: `/invitations/companies/${getCompanyId()}/invitations`,
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'CompanyUser', id: 'INVITES' }],
    }),
    resendInvitation: build.mutation({
      query: (inviteId) => ({
        url: `/invitations/${encodeURIComponent(inviteId)}/resend`,
        method: 'POST',
      }),
      invalidatesTags: [{ type: 'CompanyUser', id: 'INVITES' }],
    }),
    revokeInvitation: build.mutation({
      query: (inviteId) => ({
        url: `/invitations/${encodeURIComponent(inviteId)}/revoke`,
        method: 'POST',
      }),
      invalidatesTags: [{ type: 'CompanyUser', id: 'INVITES' }],
    }),

    // ---------- PUBLIC INVITATION ENDPOINTS ----------
    checkInvitation: build.query({
      query: (token) => ({
        url: `/invitations/check`,
        method: 'GET',
        params: { token },
      }),
    }),
    acceptInvitation: build.mutation({
      query: (body) => ({
        url: `/invitations/accept`,
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        { type: 'CompanyUser', id: 'LIST' },
        { type: 'CompanyUser', id: 'INVITES' },
      ],
    }),
  }),
  overrideExisting: true,
});

export const {
  useListCompanyUsersQuery,
  useGetCompanyUserQuery,
  useUpdateCompanyUserMutation,   // 👈 новое
  useAddMemberMutation,
  useRemoveUserMutation,
  useUpdateUserRoleMutation,

  useListInvitationsQuery,
  useInviteUserMutation,
  useResendInvitationMutation,
  useRevokeInvitationMutation,

  useCheckInvitationQuery,
  useAcceptInvitationMutation,
} = companyUsersApi;
