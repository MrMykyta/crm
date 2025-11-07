import { useEffect, useMemo, useRef, useState } from "react";
import s from "./DescriptionHtml.module.css";

/**
 * DescriptionHtml — HTML-редактор с вставкой изображений
 *
 * props:
 *  - value: string (html)
 *  - onChange: (html: string) => void
 *  - placeholder?: string
 *  - disabled?: boolean
 *  - maxLength?: number  (лимит по plain text)
 *  - className?: string
 *  - onUploadImage?: async (file: File) => Promise<string>  // верни url
 *  - onAttachImageUrl?: async (url: string) => Promise<string> // верни url (после сервера)
 *  - imgMaxMb?: number (по умолчанию 5)
 */
export default function DescriptionHtml({
  value = "",
  onChange,
  placeholder = "Введите описание…",
  disabled = false,
  maxLength,
  className = "",
  onUploadImage,
  onAttachImageUrl,
  imgMaxMb = 5,
}) {
  const ref = useRef(null);
  const [focused, setFocused] = useState(false);
  const fileRef = useRef(null);

  // длина «чистого» текста
  const plainLength = useMemo(() => toPlain(value).length, [value]);

  // синхронизируем value → DOM
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const html = value || "";
    if (el.innerHTML !== html) el.innerHTML = html;
  }, [value]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    let html = normalizeHtml(el.innerHTML);
    if (maxLength && toPlain(html).length > maxLength) {
      document.execCommand("undo");
      html = normalizeHtml(el.innerHTML);
    }
    onChange?.(html);
  };

  const cmd = (command, valueArg = null) => {
    if (disabled) return;
    ref.current?.focus();
    document.execCommand(command, false, valueArg);
    emit();
  };

  const clearFormatting = () => {
    cmd("removeFormat");
    cmd("unlink");
  };

  const insertHtmlAtCursor = (html) => {
    ref.current?.focus();
    document.execCommand("insertHTML", false, html);
    emit();
  };

  const insertImageByUrl = async () => {
    if (disabled) return;
    const raw = prompt("Вставьте URL картинки:", "https://");
    if (!raw) return;
    let finalUrl = raw.trim();
    if (onAttachImageUrl) {
      try { finalUrl = await onAttachImageUrl(raw); } catch { /* no-op */ }
    }
    if (finalUrl) {
      insertHtmlAtCursor(`<img src="${escapeHtml(finalUrl)}" alt="" />`);
    }
  };

  const onChooseImageFile = () => fileRef.current?.click();

  const onFileInput = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (disabled) return;
    if (!onUploadImage) return alert("Загрузка файлов не настроена");
    if (f.size > imgMaxMb * 1024 * 1024) return alert(`Файл больше ${imgMaxMb} MB`);
    try {
      const url = await onUploadImage(f);
      if (url) insertHtmlAtCursor(`<img src="${escapeHtml(url)}" alt="" />`);
    } catch (err) {
      alert(err?.message || "Не удалось загрузить изображение");
    }
  };

  const onPaste = async (e) => {
    // если в буфере файл-изображение — загрузим
    const items = e.clipboardData?.items || [];
    const fileItem = [...items].find((i) => i.kind === "file");
    if (fileItem) {
      e.preventDefault();
      const f = fileItem.getAsFile();
      if (f && f.type.startsWith("image/") && onUploadImage) {
        if (f.size > imgMaxMb * 1024 * 1024) return alert(`Файл больше ${imgMaxMb} MB`);
        try {
          const url = await onUploadImage(f);
          if (url) insertHtmlAtCursor(`<img src="${escapeHtml(url)}" alt="" />`);
        } catch (err) {
          alert(err?.message || "Не удалось загрузить изображение");
        }
        return;
      }
    }
    // иначе — обычная вставка как безопасный HTML из текста
    const text = (e.clipboardData || window.clipboardData).getData("text/plain");
    if (text) {
      e.preventDefault();
      const safe = escapeHtml(text)
        .replace(/\n{2,}/g, "</p><p>")
        .replace(/\n/g, "<br>");
      document.execCommand("insertHTML", false, `<p>${safe}</p>`);
      emit();
    }
  };

  const onDrop = async (e) => {
    if (!e.dataTransfer) return;
    const file = [...(e.dataTransfer.files || [])][0];
    if (!file) return;
    if (!file.type?.startsWith("image/")) return; // даём браузеру стандартный дроп не-картинок
    e.preventDefault();
    if (disabled) return;
    if (!onUploadImage) return alert("Загрузка файлов не настроена");
    if (file.size > imgMaxMb * 1024 * 1024) return alert(`Файл больше ${imgMaxMb} MB`);
    try {
      const url = await onUploadImage(file);
      if (url) insertHtmlAtCursor(`<img src="${escapeHtml(url)}" alt="" />`);
    } catch (err) {
      alert(err?.message || "Не удалось загрузить изображение");
    }
  };

  const insertLink = () => {
    if (disabled) return;
    const url = prompt("Ссылка:", "https://");
    if (!url) return;
    cmd("createLink", url);
  };

  return (
    <div className={`${s.wrap} ${className}`} data-focused={focused ? "1" : "0"} data-disabled={disabled ? "1" : "0"}>
      <div className={s.toolbar}>
        <button type="button" onClick={() => cmd("bold")} title="Жирный" disabled={disabled}>B</button>
        <button type="button" onClick={() => cmd("italic")} title="Курсив" disabled={disabled}><i>I</i></button>
        <button type="button" onClick={() => cmd("underline")} title="Подчеркнутый" disabled={disabled}><u>U</u></button>
        <span className={s.sep} />
        <button type="button" onClick={() => cmd("insertUnorderedList")} title="Маркированный список" disabled={disabled}>• List</button>
        <button type="button" onClick={() => cmd("insertOrderedList")} title="Нумерованный список" disabled={disabled}>1. List</button>
        <span className={s.sep} />
        <button type="button" onClick={insertLink} title="Ссылка" disabled={disabled}>🔗</button>
        <button type="button" onClick={clearFormatting} title="Очистить форматирование" disabled={disabled}>⌫</button>
        <span className={s.sep} />
        <button type="button" onClick={onChooseImageFile} title="Вставить изображение (файл)" disabled={disabled}>🖼️</button>
        <button type="button" onClick={insertImageByUrl} title="Вставить изображение по URL" disabled={disabled}>URL</button>
        <span className={s.sep} />
        <button type="button" onClick={() => cmd("undo")} title="Отменить" disabled={disabled}>↶</button>
        <button type="button" onClick={() => cmd("redo")} title="Повторить" disabled={disabled}>↷</button>

        {maxLength ? (
          <div className={s.counter} title="Длина текста (без тегов)">
            {plainLength}/{maxLength}
          </div>
        ) : null}
      </div>

      <div
        ref={ref}
        className={s.editor}
        contentEditable={!disabled}
        role="textbox"
        aria-multiline="true"
        spellCheck={true}
        onInput={emit}
        onBlur={() => setFocused(false)}
        onFocus={() => setFocused(true)}
        onPaste={onPaste}
        onDrop={onDrop}
        data-placeholder={placeholder}
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={onFileInput}
        disabled={disabled}
      />
    </div>
  );
}

/* -------- utils ---------- */

function normalizeHtml(html) {
  return (html || "")
    .replace(/<div>(\s|&nbsp;)*<\/div>/gi, "")
    .replace(/<br>\s*<\/p>/gi, "</p>")
    .trim();
}

function toPlain(html) {
  const div = document.createElement("div");
  div.innerHTML = html || "";
  return (div.textContent || "").trim();
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}