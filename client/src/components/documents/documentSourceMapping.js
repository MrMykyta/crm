import { createDefaultDocumentFormValues, createDefaultDocumentPayment, getTodayDate } from "./documentDefaults";
import { mapDocumentToFormState } from "./documentFormMapping";
import { getDefaultDocumentStatus } from "./documentStatusConfig";

export const DOCUMENT_SOURCE_TYPES = Object.freeze({
  CLIENT: "client",
  DOCUMENT: "document",
});

const SUPPORTED_SOURCE_TYPES = new Set(Object.values(DOCUMENT_SOURCE_TYPES));

function asText(value) {
  return String(value ?? "").trim();
}

function normalizeSourceLinkValue(value) {
  const text = asText(value);
  return text || null;
}

function getClientDisplayName(client) {
  return (
    asText(client?.shortName) ||
    asText(client?.fullName) ||
    `${asText(client?.firstName)} ${asText(client?.lastName)}`.trim() ||
    asText(client?.id) ||
    "без названия"
  );
}

function getDocumentDisplayName(document) {
  const number = asText(document?.number);
  if (number) return number;
  const id = asText(document?.id);
  return id ? id.slice(0, 8) : "без номера";
}

function buildSourceLink({ sourceEntityType, sourceEntityId, sourceDocumentType, sourceDocumentId }) {
  return {
    sourceEntityType: normalizeSourceLinkValue(sourceEntityType),
    sourceEntityId: normalizeSourceLinkValue(sourceEntityId),
    sourceDocumentType: normalizeSourceLinkValue(sourceDocumentType),
    sourceDocumentId: normalizeSourceLinkValue(sourceDocumentId),
  };
}

function mapClientSourceToDraft(client) {
  const clientId = asText(client?.id);
  const sourceLink = buildSourceLink({
    sourceEntityType: DOCUMENT_SOURCE_TYPES.CLIENT,
    sourceEntityId: clientId,
    sourceDocumentType: null,
    sourceDocumentId: null,
  });

  return {
    draft: createDefaultDocumentFormValues({
      meta: {
        clientId,
      },
      source: sourceLink,
    }),
    sourceInfo: {
      type: DOCUMENT_SOURCE_TYPES.CLIENT,
      id: clientId || null,
      label: `Клиент ${getClientDisplayName(client)}`,
    },
  };
}

function mapDocumentSourceToDraft(document) {
  const mappedDocument = mapDocumentToFormState(document);
  const sourceDocumentId = asText(document?.id);
  const sourceDocumentType = asText(document?.type).toUpperCase() || null;
  const sourceLink = buildSourceLink({
    sourceEntityType: DOCUMENT_SOURCE_TYPES.DOCUMENT,
    sourceEntityId: sourceDocumentId,
    sourceDocumentType,
    sourceDocumentId,
  });

  return {
    draft: createDefaultDocumentFormValues({
      header: {
        ...mappedDocument.header,
        status: getDefaultDocumentStatus(mappedDocument.header.type),
        number: "",
      },
      meta: {
        ...mappedDocument.meta,
        issueDate: getTodayDate(),
      },
      terms: {
        ...mappedDocument.terms,
      },
      content: {
        notes: asText(document?.notes),
      },
      payment: createDefaultDocumentPayment(),
      source: sourceLink,
      items: mappedDocument.items,
    }),
    sourceInfo: {
      type: DOCUMENT_SOURCE_TYPES.DOCUMENT,
      id: sourceDocumentId || null,
      label: `Документ ${getDocumentDisplayName(document)}`,
    },
  };
}

export function isSupportedDocumentSourceType(sourceType) {
  return SUPPORTED_SOURCE_TYPES.has(asText(sourceType).toLowerCase());
}

export function normalizeDocumentSourceInput(params = {}) {
  const sourceType = asText(params?.sourceType).toLowerCase();
  const sourceId = asText(params?.sourceId);
  const hasSourceParams = Boolean(sourceType || sourceId);

  if (!hasSourceParams) {
    return {
      hasSourceParams: false,
      sourceType: "",
      sourceId: "",
      validationError: "",
    };
  }

  if (!sourceType || !sourceId) {
    return {
      hasSourceParams: true,
      sourceType,
      sourceId,
      validationError: "Для создания из источника передайте оба параметра: sourceType и sourceId.",
    };
  }

  if (!isSupportedDocumentSourceType(sourceType)) {
    return {
      hasSourceParams: true,
      sourceType,
      sourceId,
      validationError: `Источник "${sourceType}" пока не поддерживается.`,
    };
  }

  return {
    hasSourceParams: true,
    sourceType,
    sourceId,
    validationError: "",
  };
}

export function mapSourceToDocumentDraft(sourceType, sourceData) {
  const normalizedType = asText(sourceType).toLowerCase();

  if (!sourceData) {
    throw new Error("Источник не содержит данных для создания документа.");
  }

  if (normalizedType === DOCUMENT_SOURCE_TYPES.CLIENT) {
    return mapClientSourceToDraft(sourceData);
  }

  if (normalizedType === DOCUMENT_SOURCE_TYPES.DOCUMENT) {
    return mapDocumentSourceToDraft(sourceData);
  }

  throw new Error(`Источник "${normalizedType}" не поддерживается.`);
}
