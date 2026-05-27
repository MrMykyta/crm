import { crmApi } from "./crmApi";

const normalizeList = (resp) => {
  const items = Array.isArray(resp?.items) ? resp.items : [];
  return { items };
};

export const documentNumberingSettingsApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    getDocumentNumberingSettings: build.query({
      query: () => ({
        url: "/company/document-numbering",
        method: "GET",
      }),
      transformResponse: normalizeList,
      providesTags: (res) => [
        { type: "DocumentNumberingSettings", id: "LIST" },
        ...(res?.items || []).map((row) => ({ type: "DocumentNumberingSettings", id: row.documentType })),
      ],
    }),

    updateDocumentNumberingSetting: build.mutation({
      query: ({ documentType, payload }) => ({
        url: `/company/document-numbering/${documentType}`,
        method: "PUT",
        body: payload || {},
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: "DocumentNumberingSettings", id: "LIST" },
        { type: "DocumentNumberingSettings", id: arg?.documentType },
      ],
    }),

    previewDocumentNumbering: build.mutation({
      query: (payload = {}) => ({
        url: "/company/document-numbering/preview",
        method: "POST",
        body: payload,
      }),
    }),

    bootstrapDocumentNumberingSettings: build.mutation({
      query: () => ({
        url: "/company/document-numbering/bootstrap",
        method: "POST",
      }),
      transformResponse: normalizeList,
      invalidatesTags: [{ type: "DocumentNumberingSettings", id: "LIST" }],
    }),

    rebuildDocumentNumberingSettings: build.mutation({
      query: (payload = {}) => ({
        url: "/company/document-numbering/rebuild",
        method: "POST",
        body: payload,
      }),
      transformResponse: normalizeList,
      invalidatesTags: [{ type: "DocumentNumberingSettings", id: "LIST" }],
    }),
  }),
  overrideExisting: true,
});

export const {
  useBootstrapDocumentNumberingSettingsMutation,
  useGetDocumentNumberingSettingsQuery,
  usePreviewDocumentNumberingMutation,
  useRebuildDocumentNumberingSettingsMutation,
  useUpdateDocumentNumberingSettingMutation,
} = documentNumberingSettingsApi;

