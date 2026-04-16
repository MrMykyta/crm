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

// buildListParams: собирает итоговую структуру данных для слоя RTK Query.
const buildListParams = (args = {}) => {
  const src = stripCompanyId(args) || {};
  const params = {};

  Object.entries(src).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params[key] = value;
  });

  if (params.search === '' && params.q) delete params.search;
  return params;
};

// normalizeListResponse: нормализует входные/выходные данные для слоя RTK Query.
const normalizeListResponse = (resp) => {
  const items = Array.isArray(resp?.data)
    ? resp.data
    : Array.isArray(resp?.items)
      ? resp.items
      : Array.isArray(resp)
        ? resp
        : [];

  const meta = resp?.meta || {};
  return {
    items,
    total: Number(meta.count ?? resp?.total ?? items.length) || 0,
    page: Number(meta.page ?? resp?.page ?? 1) || 1,
    limit: Number(meta.limit ?? resp?.limit ?? 20) || 20,
  };
};

export const notesApi = crmApi.injectEndpoints({
    // endpoints: описывает набор endpoint-ов RTK Query.
endpoints: (build) => ({
    getNotes: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (args = {}) => ({
        url: '/notes',
        method: 'GET',
        params: buildListParams(args),
      }),
      transformResponse: normalizeListResponse,
            // providesTags: возвращает теги кэша для автообновления данных.
providesTags: (res) => [
        { type: 'NoteList', id: 'LIST' },
        ...(res?.items || []).map((note) => ({ type: 'Note', id: note.id })),
      ],
      keepUnusedDataFor: 60,
    }),

    getNoteById: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (id) => ({
        url: `/notes/${encodeURIComponent(id)}`,
        method: 'GET',
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
            // providesTags: возвращает теги кэша для автообновления данных.
providesTags: (_res, _err, id) => [{ type: 'Note', id }],
    }),

    getNoteOwnerOptions: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ ownerType, search = '', limit = 20 } = {}) => ({
        url: '/notes/owners',
        method: 'GET',
        params: buildListParams({ ownerType, search, limit }),
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => {
        const items = Array.isArray(resp?.data)
          ? resp.data
          : Array.isArray(resp)
            ? resp
            : [];
        return { items };
      },
      keepUnusedDataFor: 30,
    }),

    createNote: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (payload) => ({
        url: '/notes',
        method: 'POST',
        body: stripCompanyId(payload),
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
      invalidatesTags: [{ type: 'NoteList', id: 'LIST' }],
    }),

    updateNote: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ id, payload }) => ({
        url: `/notes/${encodeURIComponent(id)}`,
        method: 'PUT',
        body: stripCompanyId(payload),
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_res, _err, { id }) => [
        { type: 'Note', id },
        { type: 'NoteList', id: 'LIST' },
      ],
    }),

    deleteNote: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (id) => ({
        url: `/notes/${encodeURIComponent(id)}`,
        method: 'DELETE',
      }),
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_res, _err, id) => [
        { type: 'Note', id },
        { type: 'NoteList', id: 'LIST' },
      ],
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetNotesQuery,
  useGetNoteByIdQuery,
  useGetNoteOwnerOptionsQuery,
  useCreateNoteMutation,
  useUpdateNoteMutation,
  useDeleteNoteMutation,
} = notesApi;

