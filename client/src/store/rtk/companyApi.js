import { crmApi, getCompanyId } from './crmApi';

export const companyApi = crmApi.injectEndpoints({
    // endpoints: описывает набор endpoint-ов RTK Query.
endpoints: (build) => ({
    getCompanyBrand: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (companyId) => `/companies/${encodeURIComponent(companyId)}`,
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data || resp,
            // providesTags: возвращает теги кэша для автообновления данных.
providesTags: (res) => (res ? [{ type: 'Company', id: res.id }] : [{ type: 'Company' }]),
    }),
    getCompany: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: () => `/companies/${getCompanyId()}`,
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data || resp,
            // providesTags: возвращает теги кэша для автообновления данных.
providesTags: (res) => (res ? [{ type: 'Company', id: res.id }] : [{ type: 'Company' }]),
    }),

    updateCompany: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (payload) => ({
        url: `/companies/${getCompanyId()}`,
        method: 'PUT',
        body: payload,
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data || resp,
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (res) =>
        res ? [{ type: 'Company', id: res.id }] : [{ type: 'Company' }],
    }),
  }),
});

export const {
  useGetCompanyBrandQuery,
  useGetCompanyQuery,
  useUpdateCompanyMutation,
} = companyApi;

