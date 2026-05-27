import { crmApi } from "./crmApi";

function unwrapEntity(payload) {
  if (!payload || typeof payload !== "object") return payload;
  return payload.item || payload.template || payload.draft || payload;
}

function normalizeTemplateEntity(entity) {
  const item = unwrapEntity(entity);
  if (!item || typeof item !== "object") return item;

  const scope = String(item.scope || "").trim().toLowerCase();
  const isDefault =
    item.isDefault === true ||
    item.default === true ||
    item.is_default === true ||
    scope === "company_default";

  return {
    ...item,
    isDefault,
    documentKind: item.documentKind || item.document_kind || null,
    documentType: item.documentType || item.document_type || item.typeKey || null,
    previewHtml:
      item.previewHtml ||
      item.preview_html ||
      item.snapshotHtml ||
      item.snapshot_html ||
      null,
  };
}

function getEntityId(entity) {
  if (!entity || typeof entity !== "object") return null;
  return entity.id || entity.templateId || entity._id || null;
}

function normalizeTemplateList(response) {
  if (Array.isArray(response)) {
    return { items: response.map(normalizeTemplateEntity).filter(Boolean) };
  }
  if (!response || typeof response !== "object") {
    return { items: [] };
  }

  const source =
    response.items ||
    response.templates ||
    response.data ||
    [];

  const items = Array.isArray(source) ? source.map(normalizeTemplateEntity).filter(Boolean) : [];
  return { items };
}

export const documentTemplateApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    getDocumentTemplates: build.query({
      query: (params = undefined) => ({
        url: "/documents/templates",
        method: "GET",
        params,
      }),
      transformResponse: (response) => normalizeTemplateList(response),
      providesTags: (res) => [
        { type: "DocumentTemplate", id: "LIST" },
        ...((res?.items || [])
          .map((row) => getEntityId(row))
          .filter(Boolean)
          .map((id) => ({ type: "DocumentTemplate", id }))),
      ],
    }),

    createDocumentTemplate: build.mutation({
      query: ({ documentTypeKey, name }) => ({
        url: "/documents/templates",
        method: "POST",
        body: {
          documentTypeKey,
          name,
        },
      }),
      transformResponse: (response) => normalizeTemplateEntity(response),
      invalidatesTags: (res) => {
        const id = getEntityId(res);
        return [
          { type: "DocumentTemplate", id: "LIST" },
          ...(id ? [{ type: "DocumentTemplate", id }] : []),
        ];
      },
    }),

    getDocumentTemplateById: build.query({
      query: (templateId) => ({
        url: `/documents/templates/${templateId}`,
        method: "GET",
      }),
      transformResponse: (response) => normalizeTemplateEntity(response),
      providesTags: (_res, _err, templateId) => [{ type: "DocumentTemplate", id: templateId }],
    }),

    getTemplateDraftByTemplateId: build.query({
      query: (templateId) => ({
        url: `/documents/templates/${templateId}/draft`,
        method: "GET",
      }),
      transformResponse: (response) => normalizeTemplateEntity(response),
      providesTags: (_res, _err, templateId) => [{ type: "TemplateDraft", id: templateId }],
    }),

    saveTemplateDraftByTemplateId: build.mutation({
      query: ({ templateId, content, schemaVersion }) => ({
        url: `/documents/templates/${templateId}/draft`,
        method: "PUT",
        body: {
          content,
          schemaVersion,
        },
      }),
      invalidatesTags: (_res, _err, arg) => [{ type: "TemplateDraft", id: arg?.templateId }],
    }),

    publishTemplateByTemplateId: build.mutation({
      query: ({ templateId, changelog } = {}) => ({
        url: `/documents/templates/${templateId}/publish`,
        method: "POST",
        body: {
          ...(typeof changelog === "string" ? { changelog } : {}),
        },
      }),
      transformResponse: (response) => unwrapEntity(response),
      invalidatesTags: (_res, _err, arg) => [
        { type: "DocumentTemplate", id: "LIST" },
        { type: "DocumentTemplate", id: arg?.templateId },
        { type: "TemplateDraft", id: arg?.templateId },
      ],
    }),

    setTemplateAsDefault: build.mutation({
      query: ({ templateId, documentKind = null, documentType = null } = {}) => ({
        url: `/documents/templates/${templateId}/set-default`,
        method: "PUT",
        body: {
          documentKind,
          documentType,
        },
      }),
      transformResponse: (response) => normalizeTemplateEntity(response),
      invalidatesTags: (_res, _err, arg) => [
        { type: "DocumentTemplate", id: "LIST" },
        { type: "DocumentTemplate", id: arg?.templateId },
        { type: "DocumentRenderTemplate" },
      ],
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetDocumentTemplatesQuery,
  useCreateDocumentTemplateMutation,
  useGetDocumentTemplateByIdQuery,
  useGetTemplateDraftByTemplateIdQuery,
  useSaveTemplateDraftByTemplateIdMutation,
  usePublishTemplateByTemplateIdMutation,
  useSetTemplateAsDefaultMutation,
} = documentTemplateApi;
