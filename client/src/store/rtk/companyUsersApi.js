import { crmApi, getCompanyId } from './crmApi';

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

const memberIdOf = (member) => member?.userId || member?.id || member?.user?.id || null;

const departmentIdOf = (value) =>
  value?.departmentId || value?.department_id || value?.department?.id || value?.membership?.departmentId || value?.membership?.department?.id || null;

function getApiQueries(getState) {
  return getState()?.[crmApi.reducerPath]?.queries || {};
}

function findDepartmentInCache(getState, departmentId) {
  if (!departmentId) return null;
  const id = String(departmentId);
  const queries = getApiQueries(getState);
  for (const sub of Object.values(queries)) {
    if (sub?.endpointName === 'listDepartments') {
      const items = Array.isArray(sub?.data) ? sub.data : [];
      const found = items.find((department) => String(department?.id) === id);
      if (found) return found;
    }
    if (sub?.endpointName === 'getDepartment' && String(sub?.data?.id) === id) {
      return sub.data;
    }
  }
  return null;
}

function departmentRef(departmentId, department) {
  if (!departmentId) return null;
  return department
    ? { id: department.id || departmentId, name: department.name || department.code || String(departmentId) }
    : { id: departmentId, name: null };
}

function applyMemberPatch(member, patch, department) {
  if (!member || typeof member !== 'object') return;
  if (Object.prototype.hasOwnProperty.call(patch, 'role')) member.role = patch.role;
  if (Object.prototype.hasOwnProperty.call(patch, 'status')) member.status = patch.status;
  if (Object.prototype.hasOwnProperty.call(patch, 'departmentId')) {
    member.departmentId = patch.departmentId || null;
    member.department = patch.departmentId ? departmentRef(patch.departmentId, department) : null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'isLead')) {
    member.isLead = !!patch.isLead;
  }
}

function memberForDepartmentList(member, departmentId, patch = {}) {
  const user = member?.user || member || {};
  const next = {
    userId: memberIdOf(member),
    email: user.email || member?.email || null,
    firstName: user.firstName || member?.firstName || '',
    lastName: user.lastName || member?.lastName || '',
    avatarUrl: user.avatarUrl || member?.avatarUrl || null,
    role: patch.role ?? member?.role,
    status: patch.status ?? member?.status,
    departmentId,
    isLead: Object.prototype.hasOwnProperty.call(patch, 'isLead') ? !!patch.isLead : !!member?.isLead,
  };
  return next.userId ? next : null;
}

function recalcDepartmentCounts(department) {
  if (!department || !Array.isArray(department.members)) return;
  department.memberCount = department.members.length;
  department.leadCount = department.members.filter((member) => member?.isLead).length;
}

function adjustListDepartmentCount(department, deltaMember, deltaLead) {
  if (!department) return;
  department.memberCount = Math.max(0, Number(department.memberCount || 0) + deltaMember);
  department.leadCount = Math.max(0, Number(department.leadCount || 0) + deltaLead);
}

export const companyUsersApi = crmApi.injectEndpoints({
    // endpoints: описывает набор endpoint-ов RTK Query.
endpoints: (build) => ({

    // ---------- MEMBERS LIST ----------
    listCompanyUsers: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (params = {}) => ({
        url: '/members/users',
        method: 'GET',
        params: stripCompanyId(params),
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) =>
        Array.isArray(resp)
          ? { items: resp, total: resp.length, page: 1, limit: resp.length }
          : resp,
            // providesTags: возвращает теги кэша для автообновления данных.
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
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
            // providesTags: возвращает теги кэша для автообновления данных.
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
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_res, _err, { userId }) => [
        { type: 'CompanyUser', id: userId },
        { type: 'CompanyUser', id: 'LIST' },
      ],
    }),

    // ---------- ADD MEMBER ----------
    addMember: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
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
      // PUT /members/users/:userId
      query: ({ userId, role, status, departmentId, isLead }) => ({
        url: `/members/users/${encodeURIComponent(userId)}`,
        method: 'PUT',
        body: {
          ...(typeof role !== 'undefined' ? { role } : {}),
          ...(typeof status !== 'undefined' ? { status } : {}),
          ...(typeof departmentId !== 'undefined' ? { departmentId } : {}),
          ...(typeof isLead !== 'undefined' ? { isLead } : {}),
        },
      }),
      async onQueryStarted(arg, { dispatch, queryFulfilled, getState }) {
        const { userId, role, status, departmentId, isLead } = arg;
        const queries = getApiQueries(getState);
        const targetDepartment = findDepartmentInCache(getState, departmentId);
        const optimisticPatch = {};
        if (typeof role !== 'undefined') optimisticPatch.role = role;
        if (typeof status !== 'undefined') optimisticPatch.status = status;
        if (typeof departmentId !== 'undefined') optimisticPatch.departmentId = departmentId || null;
        if (typeof isLead !== 'undefined') optimisticPatch.isLead = !!isLead;
        const hasDepartmentPatch = Object.prototype.hasOwnProperty.call(optimisticPatch, 'departmentId');
        const hasLeadPatch = Object.prototype.hasOwnProperty.call(optimisticPatch, 'isLead');
        if (hasDepartmentPatch && !optimisticPatch.departmentId) {
          optimisticPatch.isLead = false;
        }

        let previousDepartmentId = null;
        let previousIsLead = false;
        let previousMember = null;
        const undoers = [];

        const rememberPrevious = (member) => {
          if (previousMember || !member) return;
          previousMember = JSON.parse(JSON.stringify(member));
          previousDepartmentId = departmentIdOf(member);
          previousIsLead = !!member.isLead || !!member.membership?.isLead;
        };

        Object.values(queries)
          .filter((sub) => sub?.endpointName === 'listCompanyUsers')
          .forEach((sub) => {
          undoers.push(dispatch(crmApi.util.updateQueryData('listCompanyUsers', sub.originalArgs, (draft) => {
            const items = Array.isArray(draft?.items) ? draft.items : [];
            const member = items.find((item) => String(memberIdOf(item)) === String(userId));
            rememberPrevious(member);
            applyMemberPatch(member, optimisticPatch, targetDepartment);
          })));
        });

        undoers.push(dispatch(crmApi.util.updateQueryData('getCompanyUser', userId, (draft) => {
          if (!draft || typeof draft !== 'object') return;
          rememberPrevious(draft?.membership ? { ...(draft.user || {}), ...draft.membership, userId: draft.user?.id || userId } : draft);
          if (!draft.membership) draft.membership = {};
          applyMemberPatch(draft.membership, optimisticPatch, targetDepartment);
          applyMemberPatch(draft, optimisticPatch, targetDepartment);
        })));

        Object.values(queries).forEach((sub) => {
          if (sub?.endpointName === 'getDepartment') {
            undoers.push(dispatch(crmApi.util.updateQueryData('getDepartment', sub.originalArgs, (draft) => {
              if (!draft || !Array.isArray(draft.members)) return;
              const draftDepartmentId = String(draft.id || sub.originalArgs);
              const idx = draft.members.findIndex((member) => String(memberIdOf(member)) === String(userId));
              if (idx >= 0) {
                if (hasDepartmentPatch && (!optimisticPatch.departmentId || String(optimisticPatch.departmentId) !== draftDepartmentId)) {
                  draft.members.splice(idx, 1);
                } else {
                  applyMemberPatch(draft.members[idx], optimisticPatch, draft);
                }
              } else if (hasDepartmentPatch && optimisticPatch.departmentId && String(optimisticPatch.departmentId) === draftDepartmentId) {
                const nextMember = memberForDepartmentList(previousMember, optimisticPatch.departmentId, optimisticPatch);
                if (nextMember) draft.members.push(nextMember);
              }
              recalcDepartmentCounts(draft);
            })));
          }

          if (sub?.endpointName === 'listDepartments') {
            undoers.push(dispatch(crmApi.util.updateQueryData('listDepartments', sub.originalArgs, (draft) => {
              if (!Array.isArray(draft)) return;
              const nextDepartmentId = hasDepartmentPatch ? (optimisticPatch.departmentId || null) : previousDepartmentId;
              const nextIsLead = hasLeadPatch ? !!optimisticPatch.isLead : previousIsLead;
              if (hasDepartmentPatch && previousDepartmentId && String(previousDepartmentId) !== String(nextDepartmentId || '')) {
                adjustListDepartmentCount(
                  draft.find((department) => String(department?.id) === String(previousDepartmentId)),
                  -1,
                  previousIsLead ? -1 : 0
                );
              }
              if (hasDepartmentPatch && nextDepartmentId && String(previousDepartmentId || '') !== String(nextDepartmentId)) {
                adjustListDepartmentCount(
                  draft.find((department) => String(department?.id) === String(nextDepartmentId)),
                  1,
                  nextIsLead ? 1 : 0
                );
              } else if (hasLeadPatch && nextDepartmentId && String(previousDepartmentId || '') === String(nextDepartmentId)) {
                const leadDelta = Number(!!optimisticPatch.isLead) - Number(previousIsLead);
                if (leadDelta) {
                  adjustListDepartmentCount(
                    draft.find((department) => String(department?.id) === String(nextDepartmentId)),
                    0,
                    leadDelta
                  );
                }
              }
            })));
          }
        });

        try {
          await queryFulfilled;
          const tagIds = new Set([previousDepartmentId, optimisticPatch.departmentId].filter(Boolean).map(String));
          dispatch(crmApi.util.invalidateTags([
            { type: 'CompanyUser', id: userId },
            { type: 'CompanyUser', id: 'LIST' },
            { type: 'Department', id: 'LIST' },
            { type: 'Department', id: 'SCOPE_READINESS' },
            ...Array.from(tagIds).map((id) => ({ type: 'Department', id })),
          ]));
        } catch {
          undoers.forEach((patch) => patch.undo?.());
        }
      },
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: [],
    }),

    // ---------- INVITATIONS LIST ----------
    listInvitations: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (params = {}) => ({
        url: `/invitations/companies/${getCompanyId()}/invitations`,
        method: 'GET',
        params: stripCompanyId(params),
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) =>
        Array.isArray(resp)
          ? { items: resp, total: resp.length, page: 1, limit: resp.length }
          : resp,
            // providesTags: возвращает теги кэша для автообновления данных.
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
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (body) => ({
        url: `/invitations/companies/${getCompanyId()}/invitations`,
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'CompanyUser', id: 'INVITES' }],
    }),
    resendInvitation: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (inviteId) => ({
        url: `/invitations/${encodeURIComponent(inviteId)}/resend`,
        method: 'POST',
      }),
      invalidatesTags: [{ type: 'CompanyUser', id: 'INVITES' }],
    }),
    revokeInvitation: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (inviteId) => ({
        url: `/invitations/${encodeURIComponent(inviteId)}/revoke`,
        method: 'POST',
      }),
      invalidatesTags: [{ type: 'CompanyUser', id: 'INVITES' }],
    }),

    // ---------- PUBLIC INVITATION ENDPOINTS ----------
    checkInvitation: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (token) => ({
        url: `/invitations/check`,
        method: 'GET',
        params: { token },
      }),
    }),
    acceptInvitation: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
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
