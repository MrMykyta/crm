import { useMemo } from "react";
import { useGetCounterpartyQuery } from "../../store/rtk/counterpartyApi";
import { useGetDocumentByIdQuery } from "../../store/rtk/documentsApi";
import { mapSourceToDocumentDraft, normalizeDocumentSourceInput } from "./documentSourceMapping";

function asText(value) {
  return String(value ?? "").trim();
}

function getErrorText(error) {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || "Не удалось загрузить источник.";
}

export function readDocumentSourceParams(searchParams) {
  return normalizeDocumentSourceInput({
    sourceType: asText(searchParams?.get?.("sourceType")),
    sourceId: asText(searchParams?.get?.("sourceId")),
  });
}

export function useDocumentSourceResolver(sourceParams) {
  const normalized = useMemo(() => normalizeDocumentSourceInput(sourceParams), [sourceParams]);

  const isClientSource = normalized.hasSourceParams && !normalized.validationError && normalized.sourceType === "client";
  const isDocumentSource =
    normalized.hasSourceParams && !normalized.validationError && normalized.sourceType === "document";

  const clientSourceQuery = useGetCounterpartyQuery(normalized.sourceId, {
    skip: !isClientSource,
    refetchOnMountOrArgChange: true,
  });
  const documentSourceQuery = useGetDocumentByIdQuery(normalized.sourceId, {
    skip: !isDocumentSource,
    refetchOnMountOrArgChange: true,
  });

  const activeQuery = isClientSource ? clientSourceQuery : isDocumentSource ? documentSourceQuery : null;
  const isLoading =
    normalized.hasSourceParams &&
    !normalized.validationError &&
    Boolean(activeQuery && !activeQuery.data && (activeQuery.isLoading || activeQuery.isFetching));

  const mapped = useMemo(() => {
    if (!normalized.hasSourceParams || normalized.validationError) {
      return { draft: null, sourceInfo: null, mappingError: "" };
    }
    if (!activeQuery?.data) {
      return { draft: null, sourceInfo: null, mappingError: "" };
    }

    try {
      const result = mapSourceToDocumentDraft(normalized.sourceType, activeQuery.data);
      return {
        draft: result?.draft || null,
        sourceInfo: result?.sourceInfo || null,
        mappingError: "",
      };
    } catch (error) {
      return {
        draft: null,
        sourceInfo: null,
        mappingError: error?.message || "Не удалось подготовить документ из источника.",
      };
    }
  }, [activeQuery?.data, normalized.hasSourceParams, normalized.sourceType, normalized.validationError]);

  const errorText =
    normalized.validationError || mapped.mappingError || (activeQuery?.error ? getErrorText(activeQuery.error) : "");

  return {
    hasSourceParams: normalized.hasSourceParams,
    sourceType: normalized.sourceType,
    sourceId: normalized.sourceId,
    draft: mapped.draft,
    sourceInfo: mapped.sourceInfo,
    draftKey: mapped.draft ? `${normalized.sourceType}:${normalized.sourceId}` : "",
    isLoading,
    errorText,
    refetch: activeQuery?.refetch,
  };
}
