import { crmApi } from './crmApi';

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

// buildParams: собирает итоговую структуру данных для слоя RTK Query.
const buildParams = (args = {}) => {
  const src = stripCompanyId(args) || {};
  const params = {};
  Object.entries(src).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params[key] = value;
  });
  return params;
};

// normalizeList: нормализует входные/выходные данные для слоя RTK Query.
const normalizeList = (resp) => {
  const items = Array.isArray(resp?.data)
    ? resp.data
    : Array.isArray(resp?.items)
      ? resp.items
      : Array.isArray(resp)
        ? resp
        : [];

  const meta = resp?.meta || {};
  const total = Number(meta.count ?? resp?.total ?? items.length) || 0;
  const page = Number(meta.page ?? resp?.page ?? 1) || 1;
  const limit = Number(meta.limit ?? resp?.limit ?? 25) || 25;
  const totalPages = Number(meta.totalPages ?? (Math.ceil(total / Math.max(limit, 1)) || 1));

  return { items, total, page, limit, totalPages };
};

export const contactsApi = crmApi.injectEndpoints({
    // endpoints: описывает набор endpoint-ов RTK Query.
endpoints: (build) => ({
    getContacts: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (args = {}) => ({
        url: '/contacts',
        method: 'GET',
        params: buildParams(args),
      }),
      transformResponse: normalizeList,
            // providesTags: возвращает теги кэша для автообновления данных.
providesTags: (res) => [
        { type: 'ContactList', id: 'LIST' },
        ...(res?.items || []).map((item) => ({ type: 'Contact', id: item.id })),
      ],
      keepUnusedDataFor: 60,
    }),

    getContactById: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (id) => ({
        url: `/contacts/${encodeURIComponent(id)}`,
        method: 'GET',
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
            // providesTags: возвращает теги кэша для автообновления данных.
providesTags: (_res, _err, id) => [{ type: 'Contact', id }],
    }),

    getContactsByCounterparty: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ counterpartyId, ...args } = {}) => ({
        url: `/contacts/counterparty/${encodeURIComponent(counterpartyId)}`,
        method: 'GET',
        params: buildParams(args),
      }),
      transformResponse: normalizeList,
            // providesTags: возвращает теги кэша для автообновления данных.
providesTags: (res, _err, args) => [
        { type: 'ContactList', id: `COUNTERPARTY:${args?.counterpartyId || 'UNKNOWN'}` },
        ...(res?.items || []).map((item) => ({ type: 'Contact', id: item.id })),
      ],
      keepUnusedDataFor: 30,
    }),

    createContact: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (payload) => ({
        url: '/contacts',
        method: 'POST',
        body: stripCompanyId(payload),
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_res, _err, payload) => {
        const tags = [{ type: 'ContactList', id: 'LIST' }];
        if (payload?.counterpartyId) {
          tags.push({ type: 'ContactList', id: `COUNTERPARTY:${payload.counterpartyId}` });
        }
        tags.push({ type: 'Counterparty', id: payload?.counterpartyId || 'LIST' });
        return tags;
      },
    }),

    updateContact: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ id, payload }) => ({
        url: `/contacts/${encodeURIComponent(id)}`,
        method: 'PATCH',
        body: stripCompanyId(payload),
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (res, _err, { id }) => {
        const tags = [
          { type: 'Contact', id },
          { type: 'ContactList', id: 'LIST' },
        ];

        if (res?.counterpartyId) {
          tags.push({ type: 'ContactList', id: `COUNTERPARTY:${res.counterpartyId}` });
          tags.push({ type: 'Counterparty', id: res.counterpartyId });
        }

        return tags;
      },
    }),

    deleteContact: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (id) => ({
        url: `/contacts/${encodeURIComponent(id)}`,
        method: 'DELETE',
      }),
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_res, _err, id) => [
        { type: 'Contact', id },
        { type: 'ContactList', id: 'LIST' },
      ],
    }),

    setMainContact: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (id) => ({
        url: `/contacts/${encodeURIComponent(id)}/set-main`,
        method: 'PATCH',
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (res, _err, id) => {
        const tags = [
          { type: 'Contact', id },
          { type: 'ContactList', id: 'LIST' },
        ];

        if (res?.counterpartyId) {
          tags.push({ type: 'ContactList', id: `COUNTERPARTY:${res.counterpartyId}` });
          tags.push({ type: 'Counterparty', id: res.counterpartyId });
        }

        return tags;
      },
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetContactsQuery,
  useGetContactByIdQuery,
  useGetContactsByCounterpartyQuery,
  useCreateContactMutation,
  useUpdateContactMutation,
  useDeleteContactMutation,
  useSetMainContactMutation,
} = contactsApi;

