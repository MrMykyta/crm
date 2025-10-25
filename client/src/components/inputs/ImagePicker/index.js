import { useRef, useState } from 'react';
import styles from './ImagePicker.module.css';

export default function ImagePicker({
  value,
  onChange,
  uploader,        // async (file)   => ({ url })
  urlUploader,     // async (urlStr) => ({ url })
  allowUrlInput = true,
  label = 'Загрузить изображение',
  disabled = false,
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);
  const [urlDraft, setUrlDraft] = useState('');

  const onPickFile = () => fileRef.current?.click();

  const handleFile = async (file) => {
    if (!file || disabled) return;
    setErr('');
    setBusy(true);
    try {
      const res = await uploader?.(file);
      onChange?.(res?.url || '');
    } catch (e) {
      setErr(e?.message || 'Ошибка загрузки');
    } finally {
      setBusy(false);
    }
  };

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  };

  const applyUrl = async () => {
    const url = urlDraft.trim();
    if (!url) return;
    setErr('');
    setBusy(true);
    try {
      if (urlUploader) {
        const res = await urlUploader(url);
        onChange?.(res?.url || '');
      } else {
        onChange?.(url);
      }
      setUrlDraft('');
    } catch (e) {
      setErr(e?.message || 'Не удалось применить URL');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.wrap} aria-busy={busy}>
      <div className={styles.preview}>
        {value ? <img src={value} alt="" /> : <div className={styles.ph}>no image</div>}
      </div>

      <div className={styles.row}>
        <button type="button" className={styles.primary} onClick={onPickFile} disabled={busy || disabled}>
          {busy ? 'Загружаем…' : label}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={onFileChange}
          disabled={busy || disabled}
        />
      </div>

      {allowUrlInput && (
        <div className={styles.row}>
          <input
            className={styles.input}
            placeholder="или вставьте ссылку https://…"
            value={urlDraft}
            onChange={(e)=> setUrlDraft(e.target.value)}
            disabled={busy || disabled}
          />
          <button type="button" className={styles.ghost} onClick={applyUrl} disabled={busy || disabled || !urlDraft}>
            Применить URL
          </button>
        </div>
      )}

      {err && <div className={styles.err}>{err}</div>}
    </div>
  );
}