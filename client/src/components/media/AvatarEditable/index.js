import { useState, useRef } from "react";
import styles from "./AvatarEditable.module.css";

/**
 * Кликабельная аватарка с ховером-подсказкой "Изменить".
 * По клику открывает модалку, где можно загрузить файл или вставить URL.
 *
 * Props:
 *  - value: string (текущий url)
 *  - onChange: (url: string) => void
 *  - label: string ("Изменить" по умолчанию)
 *  - size: number (px, по умолчанию 128)
 *  - uploader: async (file) => { url }
 *  - urlUploader: async (url) => { url } (необязателен)
 */
export default function AvatarEditable({
  value = "",
  onChange,
  label = "Изменить",
  size = 128,
  uploader,
  urlUploader,
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [urlDraft, setUrlDraft] = useState("");
  const fileRef = useRef(null);

  const openModal = () => { setErr(""); setUrlDraft(""); setOpen(true); };
  const closeModal = () => { if (!busy) setOpen(false); };

  const pickFile = () => fileRef.current?.click();

  const handleFile = async (f) => {
    if (!f || !uploader) return;
    setErr(""); setBusy(true);
    try {
      const res = await uploader(f);
      if (res?.url) onChange?.(res.url);
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
    setErr(""); setBusy(true);
    try {
      if (urlUploader) {
        const res = await urlUploader(u);
        if (res?.url) onChange?.(res.url);
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
        className={styles.avatar}
        style={{ width: size, height: size }}
        onClick={openModal}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openModal()}
      >
        {value
          ? <img className={styles.img} src={value} alt="" />
          : <div className={styles.ph}>LOGO</div>}
        <div className={styles.overlay}>
          <span className={styles.editText}>{label}</span>
        </div>
      </div>

      {open && (
        <div className={styles.backdrop} role="dialog" aria-modal="true" onClick={closeModal}>
          <div className={styles.modal} onClick={(e)=>e.stopPropagation()}>
            <div className={styles.modalTitle}>Логотип компании</div>

            <div className={styles.previewRow}>
              <div className={styles.previewBox}>
                {value ? <img src={value} alt="" /> : <div className={styles.previewPh}>нет изображения</div>}
              </div>
            </div>

            <div className={styles.row}>
              <button
                type="button"
                className={styles.primary}
                onClick={pickFile}
                disabled={busy}
              >
                {busy ? "Загрузка…" : "Загрузить файл"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e)=>{ const f=e.target.files?.[0]; if (f) handleFile(f); e.target.value=""; }}
                disabled={busy}
              />
            </div>

            <div className={styles.row}>
              <input
                className={styles.input}
                placeholder="или вставьте ссылку https://…"
                value={urlDraft}
                onChange={(e)=>setUrlDraft(e.target.value)}
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
              <button className={styles.secondary} onClick={closeModal} disabled={busy}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}