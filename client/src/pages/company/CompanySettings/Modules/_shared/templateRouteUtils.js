export const TEMPLATE_DOCUMENT_TYPE_KEYS = Object.freeze({
  offer: "oferta",
  order: "zamowienie",
  invoice: "faktura_vat",
  warehouse: "wz",
});

function asText(value) {
  return String(value || "").trim();
}

export function resolveTemplateDocumentTypeKey({ kind, type } = {}) {
  const normalizedKind = asText(kind).toLowerCase();
  const normalizedType = asText(type).toLowerCase();

  if (normalizedKind === "offer") {
    return TEMPLATE_DOCUMENT_TYPE_KEYS.offer;
  }
  if (normalizedKind === "order") {
    return TEMPLATE_DOCUMENT_TYPE_KEYS.order;
  }
  if (normalizedKind === "invoice") {
    return TEMPLATE_DOCUMENT_TYPE_KEYS.invoice;
  }
  if (normalizedKind === "warehouse") {
    if (normalizedType === "wz") {
      return "wz";
    }
    // TODO(templates-warehouse): map dedicated template types when pz/mm/rw/pw templates are introduced.
    return TEMPLATE_DOCUMENT_TYPE_KEYS.warehouse;
  }
  return null;
}

export function buildTemplateNewRoute({ kind, type } = {}) {
  const normalizedKind = asText(kind).toLowerCase();
  const normalizedType = asText(type).toLowerCase();
  const search = new URLSearchParams();
  if (normalizedKind) {
    search.set("kind", normalizedKind);
  }
  if (normalizedType) {
    search.set("type", normalizedType);
  }
  const suffix = search.toString();
  return `/main/company-settings/document-templates/new${suffix ? `?${suffix}` : ""}`;
}

export function buildTemplateEditorRoute(templateId) {
  const id = asText(templateId);
  if (!id) {
    return "/main/company-settings/document-templates";
  }
  return `/main/company-settings/document-templates/${encodeURIComponent(id)}/editor`;
}

