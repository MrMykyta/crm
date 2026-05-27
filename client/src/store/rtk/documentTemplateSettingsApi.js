import { crmApi } from "./crmApi";

const normalizeList = (resp) => {
  const items = Array.isArray(resp?.items) ? resp.items : [];
  return { items };
};

export const documentTemplateSettingsApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    getDocumentTemplateSettings: build.query({
      query: () => ({
        url: "/document-template-settings",
        method: "GET",
      }),
      transformResponse: normalizeList,
      providesTags: [{ type: "DocumentTemplateSettings", id: "LIST" }],
    }),

    updateDocumentTemplateSettings: build.mutation({
      query: (items = []) => ({
        url: "/document-template-settings",
        method: "PUT",
        body: { items },
      }),
      transformResponse: normalizeList,
      invalidatesTags: [{ type: "DocumentTemplateSettings", id: "LIST" }],
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetDocumentTemplateSettingsQuery,
  useUpdateDocumentTemplateSettingsMutation,
} = documentTemplateSettingsApi;

