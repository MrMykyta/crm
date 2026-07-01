import { crmApi } from './crmApi';

const stripCompanyId = (value) => {
  if (!value || typeof value !== 'object') return value;
  if (value.constructor !== Object) return value;
  const { companyId, ...rest } = value;
  return rest;
};

const buildParams = (args = {}) => {
  const params = {};
  Object.entries(stripCompanyId(args) || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params[key] = value;
  });
  return params;
};

export const documentSharesApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    listDocumentShares: build.query({
      query: (args = {}) => ({
        url: '/document-shares',
        method: 'GET',
        params: buildParams(args),
      }),
      transformResponse: (response) => response?.data || [],
      providesTags: (_res, _err, args = {}) => [
        { type: 'DocumentShare', id: `${args.entityType}:${args.entityId}` },
      ],
    }),

    createDocumentShare: build.mutation({
      query: (payload = {}) => ({
        url: '/document-shares',
        method: 'POST',
        body: stripCompanyId(payload),
      }),
      transformResponse: (response) => response?.data || response,
      invalidatesTags: (_res, _err, payload = {}) => [
        { type: 'DocumentShare', id: `${payload.entityType}:${payload.entityId}` },
      ],
    }),

    revokeDocumentShare: build.mutation({
      query: ({ id }) => ({
        url: `/document-shares/${encodeURIComponent(id)}/revoke`,
        method: 'POST',
        body: {},
      }),
      transformResponse: (response) => response?.data || response,
      invalidatesTags: (_res, _err, { entityType, entityId } = {}) => [
        entityType && entityId ? { type: 'DocumentShare', id: `${entityType}:${entityId}` } : { type: 'DocumentShare', id: 'LIST' },
      ],
    }),
  }),
  overrideExisting: true,
});

export const {
  useCreateDocumentShareMutation,
  useListDocumentSharesQuery,
  useRevokeDocumentShareMutation,
} = documentSharesApi;
