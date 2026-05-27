import { crmApi } from "./crmApi";

const stripCompanyId = (value) => {
  if (!value || typeof value !== "object") return value;
  if (typeof FormData !== "undefined" && value instanceof FormData) {
    value.delete("companyId");
    return value;
  }
  if (value.constructor !== Object) return value;
  const { companyId, ...rest } = value;
  return rest;
};

const buildParams = (args = {}) => {
  const src = stripCompanyId(args) || {};
  const params = {};
  Object.entries(src).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params[key] = value;
  });
  return params;
};

const normalizeList = (resp) => {
  const items = Array.isArray(resp?.items) ? resp.items : Array.isArray(resp) ? resp : [];
  return {
    items,
    total: Number(resp?.total ?? items.length) || 0,
    page: Number(resp?.page ?? 1) || 1,
    limit: Number(resp?.limit ?? 25) || 25,
  };
};

export const documentsApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    listDocuments: build.query({
      query: (args = {}) => ({
        url: "/documents",
        method: "GET",
        params: buildParams(args),
      }),
      transformResponse: normalizeList,
      providesTags: (res) => [
        { type: "DocumentList", id: "LIST" },
        ...(res?.items || []).map((item) => ({ type: "Document", id: item.id })),
      ],
      keepUnusedDataFor: 60,
    }),
    createDocument: build.mutation({
      query: (body) => ({
        url: "/documents",
        method: "POST",
        body: stripCompanyId(body),
      }),
      invalidatesTags: [{ type: "DocumentList", id: "LIST" }],
    }),
    getDocumentById: build.query({
      query: (id) => ({
        url: `/documents/${id}`,
        method: "GET",
      }),
      providesTags: (_res, _err, id) => [{ type: "Document", id }],
    }),
    updateDocument: build.mutation({
      query: ({ id, payload }) => ({
        url: `/documents/${id}`,
        method: "PUT",
        body: stripCompanyId(payload),
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: "Document", id: arg?.id },
        { type: "DocumentList", id: "LIST" },
      ],
    }),
    convertDocument: build.mutation({
      query: ({ id, targetType }) => ({
        url: `/documents/${id}/convert`,
        method: "POST",
        body: stripCompanyId({ targetType }),
      }),
      invalidatesTags: (res, _err, arg) => [
        { type: "Document", id: arg?.id },
        { type: "DocumentList", id: "LIST" },
        ...(res?.id ? [{ type: "Document", id: res.id }] : []),
      ],
    }),
    getDocumentRenderTemplate: build.query({
      query: ({ documentId, templateId } = {}) => {
        const params = {};
        if (templateId) params.templateId = templateId;
        return {
          url: `/documents/${documentId}/render-template`,
          method: "GET",
          params,
        };
      },
      providesTags: (_res, _err, arg) => [
        { type: "Document", id: arg?.documentId },
        { type: "DocumentRenderTemplate", id: arg?.documentId },
      ],
      keepUnusedDataFor: 120,
    }),
  }),
  overrideExisting: true,
});

export const {
  useListDocumentsQuery,
  useCreateDocumentMutation,
  useGetDocumentByIdQuery,
  useUpdateDocumentMutation,
  useConvertDocumentMutation,
  useGetDocumentRenderTemplateQuery,
} = documentsApi;
