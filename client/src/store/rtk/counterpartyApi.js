import { crmApi, getCompanyId } from './crmApi';

const toQuery = (params = {}) => {
  const esc = encodeURIComponent;
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return '';
  return '?' + entries.map(([k, v]) => (Array.isArray(v) ? v.map(x => `${esc(k)}=${esc(x)}`).join('&') : `${esc(k)}=${esc(v)}`)).join('&');
};

export const counterpartyApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    listCounterparties: build.query({
      query: (q = {}) => ({ url: `/counterparties/${getCompanyId()}${toQuery(q)}`, method: 'GET' }),
      providesTags: (res) => {
        const ids = Array.isArray(res?.items) ? res.items.map(i => i.id) : [];
        return [{ type: 'Counterparty', id: 'LIST' }, ...ids.map(id => ({ type: 'Counterparty', id }))];
      },
    }),

    getCounterparty: build.query({
      query: (id) => ({ url: `/counterparties/${getCompanyId()}/${id}`, method: 'GET' }),
      providesTags: (_res, _err, id) => [{ type: 'Counterparty', id }],
    }),

    createCounterparty: build.mutation({
      query: (body) => ({ url: `/counterparties/${getCompanyId()}`, method: 'POST', body }),
      invalidatesTags: [{ type: 'Counterparty', id: 'LIST' }],
    }),

    updateCounterparty: build.mutation({
      query: ({ id, body, method = 'PUT' }) => ({
        url: `/counterparties/${getCompanyId()}/${id}`,
        method,
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Counterparty', id },
        { type: 'Counterparty', id: 'LIST' },
      ],
    }),

    removeCounterparty: build.mutation({
      query: (id) => ({ url: `/counterparties/${getCompanyId()}/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Counterparty', id: 'LIST' }],
    }),
  }),
  overrideExisting: true,
});

export const {
  useListCounterpartiesQuery,
  useGetCounterpartyQuery,
  useCreateCounterpartyMutation,
  useUpdateCounterpartyMutation,
  useRemoveCounterpartyMutation,
} = counterpartyApi;