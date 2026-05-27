import { useMemo, useEffect, useRef, useCallback } from "react";
import { useSelector } from "react-redux";
import { useGetSignedFileUrlQuery } from "../store/rtk/filesApi";
import { extractFileId } from "../utils/fileUrl";
import { withApiOrigin } from "../config/api";

/**
 * Returns signed inline URL for private files (/api/files/:id/download).
 * For public/external URLs returns the original value.
 */
export // useSignedFileUrl : use signed file url.
// Хук useSignedFileUrl: инкапсулирует переиспользуемую логику и возвращает состояние/обработчики для компонентов.
const useSignedFileUrl = (value) => {
  const accessToken = useSelector((s) => s.auth?.accessToken);
  const companyId = useSelector((s) => s.auth?.companyId);
  const fileId = useMemo(() => extractFileId(value), [value]);
  const canRequest = Boolean(fileId && accessToken && companyId);
  const { data, refetch } = useGetSignedFileUrlQuery(fileId, {
    skip: !canRequest,
    refetchOnFocus: false,
    refetchOnReconnect: false,
  });

  const signed = canRequest ? (data?.data?.url || data?.url || "") : "";

    // normalize: нормализует входные и выходные данные.
const normalize = (u) => {
    return withApiOrigin(u);
  };

  const url = fileId ? normalize(signed) : (value || "");

  const refetchOnceRef = useRef(false);
  useEffect(() => {
    refetchOnceRef.current = false;
  }, [fileId]);

  const onError = useCallback(() => {
    if (!fileId || !canRequest) return;
    if (refetchOnceRef.current) return;
    refetchOnceRef.current = true;
    refetch();
  }, [fileId, canRequest, refetch]);

  return { url, fileId, onError };
};
