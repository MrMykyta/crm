import { useState, useRef, useEffect } from "react";
import styles from "./AvatarEditable.module.css";

/**
 * Аватар/логотип с возможностью изменения.
 *
 * Props:
 *  - value: string — URL текущего изображения
 *  - onChange: (url: string) => void
 *  - label: string — подпись на кнопке ("Изменить" по умолчанию)
 *  - size: number | string — ширина (по умолчанию 180)
 *  - minHeight: number — минимальная высота (по умолчанию 72)
 *  - fit: "contain" | "cover" (по умолчанию contain)
 *  - uploader: async (file) => { url } | string | {data:{url}} | {path}
 *  - urlUploader?: async (url) => { url } | string | {data:{url}} | {path}
 */
export default function AvatarEditable({
  value = "",
  onChange,
  label = "Изменить",
  size = 180,
  minHeight = 72,
  fit = "contain",
  uploader,
  urlUploader,
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [urlDraft, setUrlDraft] = useState("");
  const [ratio, setRatio] = useState(1);
  const fileRef = useRef(null);

  // определяем соотношение сторон
  useEffect(() => {
    if (!value) return;
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setRatio(img.naturalWidth / img.naturalHeight);
      }
    };
    img.onerror = () => setRatio(1);
    img.src = value;
  }, [value]);

  const extractUrl = (out) => {
    if (!out) return "";
    if (typeof out === "string") return out;
    return out.url || out.data?.url || out.path || out.location || "";
  };

  const openModal = () => {
    setErr("");
    setUrlDraft("");
    setOpen(true);
  };
  const closeModal = () => {
    if (!busy) setOpen(false);
  };
  const pickFile = () => fileRef.current?.click();

  const handleFile = async (f) => {
    if (!f || !uploader) return;
    setErr("");
    setBusy(true);
    try {
      const res = await uploader(f);
      const url = extractUrl(res);
      if (url) onChange?.(url);
      setOpen(false);
    } catch (e) {
      setErr(e?.message || "Не удалось загрузить файл");
    } finally {
      setBusy(false);
    }
  };

  const applyUrl = async () => {
    const u = String(urlDraft || "").trim();
    if (!u) return;
    setErr("");
    setBusy(true);
    try {
      if (urlUploader) {
        const res = await urlUploader(u);
        const finalUrl = extractUrl(res) || u;
        if (finalUrl) onChange?.(finalUrl);
      } else {
        onChange?.(u);
      }
      setOpen(false);
    } catch (e) {
      setErr(e?.message || "Не удалось применить URL");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        className={`${styles.avatar} ${
          fit === "contain" ? styles.fitContain : styles.fitCover
        }`}
        style={{
          width: typeof size === "number" ? `${size}px` : size,
          aspectRatio: ratio,
          minHeight,
        }}
        onClick={openModal}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openModal()}
      >
        {value ? (
          <img className={styles.img} src={value} alt="Логотип" />
        ) : (
          <div className={styles.ph}>LOGO</div>
        )}
        <div className={styles.overlay}>
          <span className={styles.editText}>{label}</span>
        </div>
      </div>

      {open && (
        <div className={styles.backdrop} role="dialog" aria-modal="true" onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>Логотип компании</div>

            <div className={styles.previewRow}>
              <div className={styles.previewBox}>
                {value ? (
                  <img src={value} alt="Превью" />
                ) : (
                  <div className={styles.previewPh}>нет изображения</div>
                )}
              </div>
            </div>

            <div className={styles.row}>
              <button type="button" className={styles.primary} onClick={pickFile} disabled={busy}>
                {busy ? "Загрузка…" : "Загрузить файл"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
                disabled={busy}
              />
            </div>

            <div className={styles.row}>
              <input
                className={styles.input}
                placeholder="или вставьте ссылку https://…"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                disabled={busy}
              />
              <button
                type="button"
                className={styles.ghost}
                onClick={applyUrl}
                disabled={busy || !urlDraft.trim()}
              >
                Применить URL
              </button>
            </div>

            {err && <div className={styles.err}>{err}</div>}

            <div className={styles.actions}>
              <button className={styles.secondary} onClick={closeModal} disabled={busy}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}