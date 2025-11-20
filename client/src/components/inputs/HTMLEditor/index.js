import React, { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import {
  TextStyle,
  Color,
  BackgroundColor,
  FontFamily,
  FontSize,
} from "@tiptap/extension-text-style";

import s from "./HTMLEditor.module.css";

/* ---------- helpers ---------- */
const parsePx = (v, fallback = 14) => {
  if (v === "" || v === null || v === undefined) return fallback;
  const m = String(v).match(/(\d+(?:\.\d+)?)\s*px/i);
  const num = m ? Number(m[1]) : Number(v);
  return Number.isFinite(num) ? num : fallback;
};
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const markActive = (editor, name) => {
  if (!editor) return false;
  if (editor.isActive(name)) return true;
  const stored = editor.state?.storedMarks || [];
  return stored.some((m) => m.type?.name === name);
};

/* ---------- icons ---------- */
const IconUndo = (p) => (
  <svg viewBox="0 0 24 24" className={s.icon} {...p}>
    <path d="M7 8H3v4M3 12a9 9 0 0 1 15.364-6.364" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconRedo = (p) => (
  <svg viewBox="0 0 24 24" className={s.icon} {...p}>
    <path d="M17 8h4v4M21 12a9 9 0 0 0-15.364-6.364" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconMarker = () => (
  <svg viewBox="0 0 24 24" className={s.icon}>
    <path d="M3 21h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M13 3l8 8-7 7-8-8 7-7z" fill="currentColor" opacity=".2"/>
    <path d="M6 10l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

/* ---------- SizeMenu (portal) ---------- */
function SizeMenu({ open, anchorRect, value, onPick, onClose }) {
  if (!open || !anchorRect) return null;
  const PRESETS = [8,9,10,11,12,14,18,24,30,36,48,60,72,96];

  const style = {
    position: "fixed",
    top: Math.round(anchorRect.bottom + 6),
    left: Math.round(anchorRect.left + anchorRect.width / 2 - 32),
    zIndex: 10000,
  };

  return createPortal(
    <div
      className={s.menu}
      style={style}
      // критично: блокируем mousedown, чтобы глобальный обработчик «клик-вне» не закрыл меню раньше клика по пункту
      onMouseDown={(e) => e.stopPropagation()}
    >
      {PRESETS.map((p) => (
        <button
          key={p}
          type="button"
          className={`${s.menuItem} ${p === value ? s.menuItemActive : ""}`}
          onClick={() => {
            onPick(p);
            onClose?.();
          }}
        >
          {p}
        </button>
      ))}
    </div>,
    document.body
  );
}

export default function HTMLEditor({
  value,
  defaultValue = "",
  onChange,
  placeholder = "Начните вводить текст…",
  minHeight = 220,
}) {
  const [uiColor, setUiColor] = useState("#e9edff");
  const [uiBg, setUiBg] = useState("#000000");

  // font-size state
  const [fontPx, setFontPx] = useState(14);
  const [sizeDraft, setSizeDraft] = useState("14");
  const lastSizeRef = useRef(14);

  // dropdown state for size (with portal)
  const [openSize, setOpenSize] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const sizeComboRef = useRef(null);

  /* ---------- extensions ---------- */
  const extensions = useMemo(
    () => [
      TextStyle,
      Color.configure({ types: ["textStyle"] }),
      BackgroundColor.configure({ types: ["textStyle"] }),
      FontFamily.configure({ types: ["textStyle"] }),
      FontSize.configure({ types: ["textStyle"] }),
      Underline,
      Link.configure({
        openOnClick: true,
        autolink: true,
        protocols: ["http", "https", "mailto", "tel"],
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      TextAlign.configure({ types: ["paragraph", "heading"] }),
      Image.configure({ allowBase64: true }),
      StarterKit.configure({
        history: true,
        bulletList: { keepMarks: true, keepAttributes: true },
        orderedList: { keepMarks: true, keepAttributes: true },
      }),
    ],
    []
  );

  const editor = useEditor({
    extensions,
    content: value ?? defaultValue,
    editorProps: {
      attributes: {
        class: s.editor,
        "data-placeholder": placeholder,
        style: `min-height:${typeof minHeight === "number" ? `${minHeight}px` : minHeight}`,
      },
      handleDrop(view, event) {
        const e = event;
        if (!e.dataTransfer) return false;
        const file = Array.from(e.dataTransfer.files || [])[0];
        if (file && file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = () => editor?.chain().focus().setImage({ src: reader.result }).run();
          reader.readAsDataURL(file);
          e.preventDefault();
          return true;
        }
        const url = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
        if (url && /^https?:\/\//i.test(url) && /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(url)) {
          editor?.chain().focus().setImage({ src: url }).run();
          e.preventDefault();
          return true;
        }
        return false;
      },
    },
    onCreate: ({ editor }) => {
      const fs = editor.getAttributes("textStyle")?.fontSize;
      if (!fs) editor.chain().focus().setFontSize("14px").run();
    },
    onUpdate: ({ editor }) => {
      onChange && onChange(editor.getHTML());
      const a = editor.getAttributes("textStyle");
      if (a?.color && a.color !== uiColor) setUiColor(a.color);
      if (a?.backgroundColor && a.backgroundColor !== uiBg) setUiBg(a.backgroundColor);
      if (a?.fontSize) {
        const parsed = parsePx(a.fontSize, 14);
        if (parsed !== fontPx) {
          setFontPx(parsed);
          setSizeDraft(String(parsed));
          lastSizeRef.current = parsed;
        }
      }
    },
  });

  // синхронизация на выбор/транзакции
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      const a = editor.getAttributes("textStyle");
      const parsed = parsePx(a?.fontSize, 14);
      setFontPx(parsed);
      setSizeDraft(String(parsed));
      lastSizeRef.current = parsed;
    };
    editor.on("selectionUpdate", handler);
    editor.on("transaction", handler);
    editor.on("update", handler);
    return () => {
      editor.off("selectionUpdate", handler);
      editor.off("transaction", handler);
      editor.off("update", handler);
    };
  }, [editor]);

  // клик вне — применяем и закрываем
  useEffect(() => {
    const onDoc = (e) => {
      if (openSize) {
        if (sizeComboRef.current && !sizeComboRef.current.contains(e.target)) {
          const v = parsePx(sizeDraft, fontPx);
          applyFont(v);
          setOpenSize(false);
        }
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openSize, sizeDraft, fontPx]); // eslint-disable-line

  const chain = () => (editor ? editor.chain().focus() : null);
  const can = (cmd) => (editor ? editor.can().chain().focus()[cmd]().run() : false);
  const holdCursor = (e) => e.preventDefault();

  /* ---------- font size ---------- */
  const STEP = 1, MIN = 8, MAX = 96;

  const applyFont = (px) => {
    if (!editor) return;
    const v = clamp(Math.round(px), MIN, MAX);
    editor.chain().focus().setFontSize(`${v}px`).run();
    setFontPx(v);
    setSizeDraft(String(v));
    lastSizeRef.current = v;
  };
  const incFont = () => applyFont(lastSizeRef.current + STEP);
  const decFont = () => applyFont(lastSizeRef.current - STEP);

  const onSizeInput = (e) => setSizeDraft(e.target.value.replace(/[^\d.]/g, ""));
  const onSizeEnter = (e) => {
    e.preventDefault(); e.stopPropagation();
    applyFont(parsePx(sizeDraft, fontPx));
  };

  // для списков — не терять текущий размер
  const toggleBulletKeepSize = () => {
    const v = lastSizeRef.current;
    chain()?.toggleBulletList().setFontSize(`${v}px`).run();
  };
  const toggleOrderedKeepSize = () => {
    const v = lastSizeRef.current;
    chain()?.toggleOrderedList().setFontSize(`${v}px`).run();
  };

  /* ---------- color actions ---------- */
  const applyColor = (hex) => { setUiColor(hex); editor?.chain().focus().setColor(hex).run(); };
  const applyBg = (hex)   => { setUiBg(hex);   editor?.chain().focus().setBackgroundColor(hex).run(); };
  const unsetBg  = ()     => editor?.chain().focus().unsetBackgroundColor().run();

  /* ---------- image picker ---------- */
  const insertImage = () => {
    if (!editor) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => chain()?.setImage({ src: reader.result }).run();
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const fonts = [
    { label: "System", value: "" },
    { label: "Arial", value: "Arial, sans-serif" },
    { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
    { label: "Georgia", value: "Georgia, serif" },
    { label: "Verdana", value: "Verdana, sans-serif" },
    { label: "Roboto", value: "Roboto, system-ui, sans-serif" },
  ];

  return (
    <div className={s.wrap}>
      <div className={s.toolbar} role="toolbar" aria-label="HTMLEditor toolbar">
        {/* Undo / Redo */}
        <button
          type="button"
          className={`${s.btn} ${s.btnIcon} ${!can("undo") ? s.disabled : ""}`}
          onMouseDown={holdCursor}
          onClick={() => chain()?.undo().run()}
          title="Отменить"
        ><IconUndo /></button>

        <button
          type="button"
          className={`${s.btn} ${s.btnIcon} ${!can("redo") ? s.disabled : ""}`}
          onMouseDown={holdCursor}
          onClick={() => chain()?.redo().run()}
          title="Повторить"
        ><IconRedo /></button>

        {/* Размер */}
        <div className={s.group} ref={sizeComboRef}>
          <button
            type="button"
            className={`${s.btn} ${s.btnIcon}`}
            onMouseDown={holdCursor}
            onClick={decFont}
            title="Меньше"
          >
            <svg viewBox="0 0 24 24" className={s.icon}><rect x="5" y="11" width="14" height="2" rx="1"/></svg>
          </button>

          <div
            className={`${s.sizeCombo} ${openSize ? s.sizeOpen : ""}`}
            onMouseDown={(e) => { if ((e.target).tagName !== "INPUT") e.preventDefault(); }}
            onClick={() => {
              const rect = sizeComboRef.current?.getBoundingClientRect();
              setAnchorRect(rect || null);
              setOpenSize((o) => !o);
            }}
          >
            <input
              className={s.sizeInput}
              value={sizeDraft}
              readOnly={!openSize}
              onChange={onSizeInput}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSizeEnter(e);
                if (e.key === "ArrowUp") { e.preventDefault(); incFont(); }
                if (e.key === "ArrowDown") { e.preventDefault(); decFont(); }
              }}
              inputMode="numeric"
              aria-label="Размер шрифта"
            />
          </div>

          <button
            type="button"
            className={`${s.btn} ${s.btnIcon}`}
            onMouseDown={holdCursor}
            onClick={incFont}
            title="Больше"
          >
            <svg viewBox="0 0 24 24" className={s.icon}>
              <rect x="11" y="5" width="2" height="14" rx="1"/>
              <rect x="5" y="11" width="14" height="2" rx="1"/>
            </svg>
          </button>
        </div>

        {/* B / I / U */}
        <button
          type="button"
          className={`${s.btn} ${markActive(editor,"bold") ? s.active : ""}`}
          onMouseDown={holdCursor}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          title="Жирный"
        >B</button>

        <button
          type="button"
          className={`${s.btn} ${markActive(editor,"italic") ? s.active : ""}`}
          onMouseDown={holdCursor}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          title="Курсив"
        >I</button>

        <button
          type="button"
          className={`${s.btn} ${markActive(editor,"underline") ? s.active : ""}`}
          onMouseDown={holdCursor}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          title="Подчёркнутый"
        >U</button>

        {/* Цвет */}
        <div className={s.swatch} onMouseDown={holdCursor} title="Цвет текста">
          <span className={s.swatchA}>A</span>
          <span className={s.swatchLine} style={{ background: uiColor }} />
          <input type="color" className={s.color} value={uiColor} onChange={(e)=>applyColor(e.target.value)} />
        </div>

        {/* Фон */}
        <div className={s.swatch} onMouseDown={holdCursor} title="Цвет фона за текстом">
          <span className={s.marker}><IconMarker/></span>
          <span className={s.swatchLine} style={{ background: uiBg }} />
          <input type="color" className={s.color} value={uiBg} onChange={(e)=>applyBg(e.target.value)} />
          <button type="button" className={`${s.btn} ${s.btnTiny}`} onMouseDown={holdCursor} onClick={unsetBg}>×</button>
        </div>

        {/* Шрифт */}
        <select
          className={`${s.select} ${s.selectWide}`}
          value={editor?.getAttributes("textStyle")?.fontFamily || ""}
          onChange={(e) => chain()?.setFontFamily(e.target.value).run()}
          title="Шрифт"
        >
          {[
            { label: "System", value: "" },
            { label: "Arial", value: "Arial, sans-serif" },
            { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
            { label: "Georgia", value: "Georgia, serif" },
            { label: "Verdana", value: "Verdana, sans-serif" },
            { label: "Roboto", value: "Roboto, system-ui, sans-serif" },
          ].map(f => (
            <option key={f.label} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
          ))}
        </select>

        {/* Выравнивание */}
        <select
          className={`${s.select} ${s.selectAlign}`}
          value={
            (editor?.isActive({ textAlign: "center" }) && "center") ||
            (editor?.isActive({ textAlign: "right" }) && "right") ||
            (editor?.isActive({ textAlign: "justify" }) && "justify") || "left"
          }
          onChange={(e) => chain()?.setTextAlign(e.target.value).run()}
          title="Выравнивание"
        >
          <option value="left">Лево</option>
          <option value="center">Центр</option>
          <option value="right">Право</option>
          <option value="justify">Ширина</option>
        </select>

        {/* Списки (с сохранением размера) */}
        <button
          type="button"
          className={`${s.btn} ${editor?.isActive("bulletList") ? s.active : ""}`}
          onMouseDown={holdCursor}
          onClick={toggleBulletKeepSize}
          title="Маркированный список"
        >•</button>
        <button
          type="button"
          className={`${s.btn} ${editor?.isActive("orderedList") ? s.active : ""}`}
          onMouseDown={holdCursor}
          onClick={toggleOrderedKeepSize}
          title="Нумерованный список"
        >1.</button>

        {/* Фото (d&d тоже работает) */}
        <button type="button" className={s.btn} onMouseDown={holdCursor} onClick={insertImage} title="Вставить фото">🖼️</button>
      </div>

      {/* портал выпадашки размеров */}
      <SizeMenu
        open={openSize}
        anchorRect={anchorRect}
        value={fontPx}
        onPick={(p) => applyFont(p)}
        onClose={() => setOpenSize(false)}
      />

      <div className={s.editorWrap}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}