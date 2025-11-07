import { crmApi, getCompanyId } from './crmApi';

const toQuery = (params = {}) => {
  const esc = encodeURIComponent;
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return '';
  return '?' + entries.map(([k, v]) => (Array.isArray(v) ? v.map(x => `${esc(k)}=${esc(x)}`).join('&') : `${esc(k)}=${esc(v)}`)).join('&');
};

export const companyUsersApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    listCompanyUsers: build.query({
      query: (q = {}) => ({ url: `/members/${getCompanyId()}/users${toQuery(q)}`, method: 'GET' }),
      transformResponse: (resp) =>
        Array.isArray(resp) ? { items: resp, total: resp.length, page: 1, limit: resp.length } : resp,
      providesTags: (res) => {
        const items = Array.isArray(res?.items) ? res.items : [];
        return [{ type: 'CompanyUser', id: 'LIST' }, ...items.map((u) => ({ type: 'CompanyUser', id: u.userId || u.id }))];
      },
    }),
    listInvitations: build.query({
      query: (q = {}) => ({ url: `/invitations/companies/${getCompanyId()}/invitations${toQuery(q)}`, method: 'GET' }),
      transformResponse: (resp) =>
        Array.isArray(resp) ? { items: resp, total: resp.length, page: 1, limit: resp.length } : resp,
      providesTags: (res) => {
        const items = Array.isArray(res?.items) ? res.items : [];
        return [{ type: 'CompanyUser', id: 'INVITES' }, ...items.map((i) => ({ type: 'CompanyUser', id: `invite:${i.id}` }))];
      },
    }),

    addMember: build.mutation({
      query: (payload) => ({ url: `/members/${getCompanyId()}/users`, method: 'POST', body: payload }),
      invalidatesTags: [{ type: 'CompanyUser', id: 'LIST' }],
    }),
    inviteUser: build.mutation({
      query: (payload) => ({ url: `/invitations/companies/${getCompanyId()}/invitations`, method: 'POST', body: payload }),
      invalidatesTags: [{ type: 'CompanyUser', id: 'INVITES' }],
    }),
    removeUser: build.mutation({
      query: (userId) => ({ url: `/companies/${getCompanyId()}/users/${encodeURIComponent(userId)}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'CompanyUser', id: 'LIST' }],
    }),
    updateUserRole: build.mutation({
      query: ({ userId, role, status }) => ({
        url: `/companies/${getCompanyId()}/users/${encodeURIComponent(userId)}/role`,
        method: 'PUT',
        body: { role, status },
      }),
      invalidatesTags: (res, err, arg) => [
        { type: 'CompanyUser', id: arg.userId },
        { type: 'CompanyUser', id: 'LIST' },
      ],
    }),
    resendInvitation: build.mutation({
      query: (inviteId) => ({ url: `/invitations/${encodeURIComponent(inviteId)}/resend`, method: 'POST' }),
      invalidatesTags: [{ type: 'CompanyUser', id: 'INVITES' }],
    }),
    revokeInvitation: build.mutation({
      query: (inviteId) => ({ url: `/invitations/${encodeURIComponent(inviteId)}/revoke`, method: 'POST' }),
      invalidatesTags: [{ type: 'CompanyUser', id: 'INVITES' }],
    }),

    // NEW: страницы принятия инвайта
    checkInvitation: build.query({
      query: (token) => ({ url: `/invitations/check`, method: 'GET', params: { token } }),
    }),
    acceptInvitation: build.mutation({
      query: (body) => ({ url: `/invitations/accept`, method: 'POST', body }),
      invalidatesTags: [{ type: 'CompanyUser', id: 'LIST' }, { type: 'CompanyUser', id: 'INVITES' }],
    }),
  }),
});

export const {
  useListCompanyUsersQuery,
  useListInvitationsQuery,
  useAddMemberMutation,
  useInviteUserMutation,
  useRemoveUserMutation,
  useUpdateUserRoleMutation,
  useResendInvitationMutation,
  useRevokeInvitationMutation,
  useCheckInvitationQuery,
  useAcceptInvitationMutation,
} = companyUsersApi;