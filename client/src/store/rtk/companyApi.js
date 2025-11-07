import { crmApi, getCompanyId } from './crmApi';

export const companyApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    getCompany: build.query({
      query: () => `/companies/${getCompanyId()}`,
      transformResponse: (resp) => resp?.data || resp,
      providesTags: (res) => (res ? [{ type: 'Company', id: res.id }] : [{ type: 'Company' }]),
    }),

    updateCompany: build.mutation({
      query: (payload) => ({
        url: `/companies/${getCompanyId()}`,
        method: 'PUT',
        body: payload,
      }),
      transformResponse: (resp) => resp?.data || resp,
      invalidatesTags: (res) =>
        res ? [{ type: 'Company', id: res.id }] : [{ type: 'Company' }],
    }),
  }),
});

export const { useGetCompanyQuery, useUpdateCompanyMutation } = companyApi;