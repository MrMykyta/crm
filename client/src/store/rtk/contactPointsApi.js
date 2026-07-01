import { crmApi } from './crmApi';

const stripEmpty = (value) => {
  const out = {};
  Object.entries(value || {}).forEach(([key, item]) => {
    if (item === undefined || item === null || item === '') return;
    out[key] = item;
  });
  return out;
};

const normalizeList = (resp) => (
  Array.isArray(resp?.data)
    ? resp.data
    : Array.isArray(resp?.items)
      ? resp.items
      : Array.isArray(resp)
        ? resp
        : []
);

export const contactPointsApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    getContactPoints: build.query({
      query: (params = {}) => ({
        url: '/contact-points',
        method: 'GET',
        params: stripEmpty(params),
      }),
      transformResponse: normalizeList,
      providesTags: (res, _err, args) => [
        { type: 'ContactPoint', id: `OWNER:${args?.ownerType || 'ANY'}:${args?.ownerId || 'ANY'}` },
        ...(res || []).map((item) => ({ type: 'ContactPoint', id: item.id })),
      ],
    }),

    createContactPoint: build.mutation({
      query: (payload) => ({
        url: '/contact-points',
        method: 'POST',
        body: stripEmpty(payload),
      }),
      transformResponse: (resp) => resp?.data ?? resp,
      invalidatesTags: (_res, _err, payload) => [
        { type: 'ContactPoint', id: `OWNER:${payload?.ownerType || 'ANY'}:${payload?.ownerId || 'ANY'}` },
      ],
    }),

    updateContactPoint: build.mutation({
      query: ({ id, payload }) => ({
        url: `/contact-points/${encodeURIComponent(id)}`,
        method: 'PUT',
        body: stripEmpty(payload),
      }),
      transformResponse: (resp) => resp?.data ?? resp,
      invalidatesTags: (res, _err, { id }) => [
        { type: 'ContactPoint', id },
        { type: 'ContactPoint', id: `OWNER:${res?.ownerType || 'ANY'}:${res?.ownerId || 'ANY'}` },
      ],
    }),

    deleteContactPoint: build.mutation({
      query: (id) => ({
        url: `/contact-points/${encodeURIComponent(id)}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'ContactPoint' }],
    }),
  }),
});

export const {
  useGetContactPointsQuery,
  useCreateContactPointMutation,
  useUpdateContactPointMutation,
  useDeleteContactPointMutation,
} = contactPointsApi;
