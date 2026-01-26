// components/chat/info/tabs/DocumentsTab.jsx
// Documents list with signed download links.
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLazyGetSignedDownloadUrlQuery } from "../../../../store/rtk/filesApi";
import s from "../ChatInfoPanel.module.css";

const prettySize = (size) => {
  const n = Number(size || 0);
  if (!n || n <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let idx = 0;
  let val = n;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx += 1;
  }
  return `${val.toFixed(val >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
};

const normalizeUrl = (u) => {
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  const base =
    (process.env.REACT_APP_API_URL || "http://localhost:5001").replace(/\/+$/, "");
  if (u.startsWith("/")) return `${base}${u}`;
  return u;
};

/**
 * Single document row.
 * @param {Object} props
 */
function DocumentRow({ item, downloadLabel }) {
  const { t } = useTranslation();
  const [getSignedDownload, { isFetching }] = useLazyGetSignedDownloadUrlQuery();
  const sizeText = useMemo(() => prettySize(item?.size), [item?.size]);

  const handleDownload = async () => {
    try {
      const res = await getSignedDownload(item.fileId).unwrap();
      const url = normalizeUrl(res?.data?.url || res?.url || "");
      if (url) window.open(url, "_blank");
    } catch (e) {
      if (typeof window !== "undefined") {
        window.alert(t("common.error"));
      }
    }
  };

  return (
    <div className={s.infoDocRow}>
      <div className={s.infoDocMeta}>
        <div className={s.infoDocName}>{item?.filename || "—"}</div>
        <div className={s.infoDocSub}>
          {item?.mime || "—"}
          {sizeText ? ` · ${sizeText}` : ""}
        </div>
      </div>
      <button
        type="button"
        className={s.infoActionBtn}
        onClick={handleDownload}
        disabled={isFetching}
      >
        {downloadLabel}
      </button>
    </div>
  );
}

export default function DocumentsTab({
  items = [],
  emptyText,
  downloadLabel,
  loadMoreLabel,
  hasMore,
  isLoading,
  onLoadMore,
}) {
  return (
    <div>
      {!items.length ? (
        <div className={s.infoEmpty}>{emptyText}</div>
      ) : (
        <div className={s.infoList}>
          {items.map((item) => (
            <DocumentRow
              key={item.fileId}
              item={item}
              downloadLabel={downloadLabel}
            />
          ))}
        </div>
      )}

      {hasMore && onLoadMore && (
        <button
          type="button"
          className={s.infoLoadMore}
          disabled={isLoading}
          onClick={onLoadMore}
        >
          {isLoading ? "…" : loadMoreLabel}
        </button>
      )}
    </div>
  );
}
