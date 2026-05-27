import { useEffect, useMemo, useState } from 'react';
import { Extension } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import TextAlign from '@tiptap/extension-text-align';
import { Redo2, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import FontSizeControl from './FontSizeControl';
import s from './HTMLEditor.module.css';

const FONT_MIN = 6;
const FONT_MAX = 96;
const FONT_STEP = 1;
const DEFAULT_FONT = 11;
const FONT_PRESETS = [8, 9, 10, 11, 12, 14, 18, 24, 30, 36, 48, 60, 72];
const PT_PER_PX = 0.75;

// clampSize: вспомогательная логика компонента.
const clampSize = (size) => Math.max(FONT_MIN, Math.min(FONT_MAX, size));

const FontSize = Extension.create({
  name: 'fontSize',
    // addOptions: добавляет элемент в локальное состояние компонента.
addOptions() {
    return {
      types: ['textStyle'],
    };
  },
    // addGlobalAttributes: добавляет элемент в локальное состояние компонента.
addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
                        // parseHTML: парсит входные данные для UI.
parseHTML: (element) => element.style.fontSize || null,
                        // renderHTML: описывает рендер соответствующего блока UI.
renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
    // addCommands: добавляет элемент в локальное состояние компонента.
addCommands() {
    return {
            // setFontSize: обновляет состояние компонента.
setFontSize:
        (fontSize) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize }).run(),
            // unsetFontSize: вспомогательная логика компонента.
unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

// normalizeUrl: нормализует данные для отображения и ввода.
const normalizeUrl = (value = '') => {
  const url = String(value || '').trim();
  if (!url) return '';
  if (/^(https?:\/\/|mailto:|tel:|\/|#|\.\.?\/)/i.test(url)) return url;
  if (/^www\./i.test(url)) return `https://${url}`;
  return '';
};

// parseFontSize: парсит входные данные для UI.
const parseFontSize = (raw) => {
  if (!raw) return null;
  const text = String(raw).trim().toLowerCase();
  const pt = text.match(/^(\d+(?:\.\d+)?)pt$/);
  if (pt) {
    const num = Number(pt[1]);
    if (Number.isFinite(num)) return clampSize(Math.round(num));
    return null;
  }

  const px = text.match(/^(\d+(?:\.\d+)?)px$/);
  if (px) {
    const num = Number(px[1]);
    if (Number.isFinite(num)) return clampSize(Math.round(num * PT_PER_PX));
    return null;
  }

  const plain = text.match(/^(\d+)$/);
  if (plain) {
    const num = Number(plain[1]);
    if (Number.isFinite(num)) return clampSize(Math.round(num));
  }

  return null;
};

// fontSizeFromMarks: вспомогательная логика компонента.
const fontSizeFromMarks = (marks = []) => {
  const mark = marks.find((entry) => entry?.type?.name === 'textStyle');
  return parseFontSize(mark?.attrs?.fontSize || null);
};

// getSelectionFontState: возвращает вычисленное значение для UI.
const getSelectionFontState = (editor) => {
  const selection = editor?.state?.selection;
  if (!selection) {
    return { size: null, mixed: false };
  }

  if (selection.empty) {
    const marks = editor.state.storedMarks || selection.$from.marks();
    return { size: fontSizeFromMarks(marks), mixed: false };
  }

  const values = new Set();
  editor.state.doc.nodesBetween(selection.from, selection.to, (node) => {
    if (!node.isText || !node.text) return;
    const size = fontSizeFromMarks(node.marks);
    values.add(size == null ? 'unset' : String(size));
  });

  if (values.size === 0) return { size: null, mixed: false };
  if (values.size > 1) return { size: null, mixed: true };

  const [only] = Array.from(values);
  if (only === 'unset') return { size: null, mixed: false };
  return { size: Number(only), mixed: false };
};

// Компонент ToolButton: отвечает за отображение UI и обработку взаимодействий пользователя.
function ToolButton({ active = false, disabled = false, title = '', onClick, className = '', children }) {
  return (
    <button
      type="button"
      className={`${s.toolBtn} ${active ? s.active : ''} ${className}`.trim()}
      disabled={disabled}
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// Компонент HTMLEditor: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function HTMLEditor({
  value,
  defaultValue = '',
  onChange,
  placeholder,
  minHeight = 220,
  disabled = false,
  toolbarPreset = 'full',
  linkPromptLabel,
}) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder || t('htmlEditor.placeholder');
  const resolvedLinkPromptLabel = linkPromptLabel || t('htmlEditor.annotation.linkPrompt');

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Underline,
      TextStyle,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        protocols: ['http', 'https', 'mailto', 'tel'],
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Placeholder.configure({ placeholder: resolvedPlaceholder }),
    ],
    [resolvedPlaceholder]
  );

  const editor = useEditor({
    extensions,
    content: value ?? defaultValue,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: s.editor,
        style: `min-height:${typeof minHeight === 'number' ? `${minHeight}px` : minHeight}`,
      },
    },
        // onUpdate: вспомогательная логика компонента.
onUpdate: ({ editor: instance }) => {
      onChange?.(instance.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (value === undefined) return;
    if (value === editor.getHTML()) return;
    editor.commands.setContent(value || '', false);
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  const [fontState, setFontState] = useState({
    size: DEFAULT_FONT,
    mixed: false,
  });

  useEffect(() => {
    if (!editor) return undefined;

        // syncFontState: вспомогательная логика компонента.
const syncFontState = () => {
      const next = getSelectionFontState(editor);
      setFontState({
        size: next.size ?? DEFAULT_FONT,
        mixed: Boolean(next.mixed),
      });
    };

    syncFontState();
    editor.on('selectionUpdate', syncFontState);
    editor.on('transaction', syncFontState);
    editor.on('update', syncFontState);

    return () => {
      editor.off('selectionUpdate', syncFontState);
      editor.off('transaction', syncFontState);
      editor.off('update', syncFontState);
    };
  }, [editor]);

    // chain: вспомогательная логика компонента.
const chain = () => (disabled ? null : editor?.chain().focus());
  const canUndo = !disabled && !!editor?.can().chain().focus().undo().run();
  const canRedo = !disabled && !!editor?.can().chain().focus().redo().run();

    // applyFontSize: вспомогательная логика компонента.
const applyFontSize = (next) => {
    const parsed = Number(next);
    if (!Number.isFinite(parsed)) return;

    const size = clampSize(Math.round(parsed));
    chain()?.setFontSize(`${size}pt`).run();
    setFontState({ size, mixed: false });
  };

    // stepFontSize: вспомогательная логика компонента.
const stepFontSize = (delta) => {
    const base = fontState.mixed ? DEFAULT_FONT : fontState.size || DEFAULT_FONT;
    applyFontSize(base + delta);
  };

    // toggleLink: переключает состояние компонента.
const toggleLink = () => {
    if (!editor) return;
    if (disabled) return;

    if (editor.isActive('link')) {
      chain()?.extendMarkRange('link').unsetLink().run();
      return;
    }

    const { from, to } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to, ' ').trim();
    const clean = normalizeUrl(selected);
    if (!clean) return;

    chain()?.extendMarkRange('link').setLink({ href: clean }).run();
  };

const setAlignLeft = () => {
    chain()?.setTextAlign('left').run();
  };

const setAlignCenter = () => {
    chain()?.setTextAlign('center').run();
  };

const setPromptLink = () => {
    if (!editor || disabled) return;

    const currentHref = String(editor.getAttributes('link')?.href || '').trim();
    const suggested = currentHref || 'https://';
    const raw = window.prompt(resolvedLinkPromptLabel, suggested);
    if (raw === null) return;

    const normalized = normalizeUrl(raw);
    if (!normalized) {
      chain()?.extendMarkRange('link').unsetLink().run();
      return;
    }
    chain()?.extendMarkRange('link').setLink({ href: normalized }).run();
  };

  if (toolbarPreset === 'annotation') {
    return (
      <div className={s.wrap}>
        <div className={s.toolbar} role="toolbar" aria-label={t('htmlEditor.annotation.ariaLabel')}>
          <ToolButton
            title={t('htmlEditor.annotation.bold')}
            active={editor?.isActive('bold')}
            disabled={disabled}
            onClick={() => chain()?.toggleBold().run()}
          >
            {t('htmlEditor.annotation.bold')}
          </ToolButton>
          <ToolButton
            title={t('htmlEditor.annotation.alignLeft')}
            active={editor?.isActive({ textAlign: 'left' })}
            disabled={disabled}
            onClick={setAlignLeft}
          >
            {t('htmlEditor.annotation.alignLeft')}
          </ToolButton>
          <ToolButton
            title={t('htmlEditor.annotation.alignCenter')}
            active={editor?.isActive({ textAlign: 'center' })}
            disabled={disabled}
            onClick={setAlignCenter}
          >
            {t('htmlEditor.annotation.alignCenter')}
          </ToolButton>
          <ToolButton
            title={t('htmlEditor.annotation.link')}
            active={editor?.isActive('link')}
            disabled={disabled}
            onClick={setPromptLink}
          >
            {t('htmlEditor.annotation.link')}
          </ToolButton>
        </div>

        <div className={s.editorWrap}>
          <EditorContent editor={editor} />
        </div>
      </div>
    );
  }

  return (
    <div className={s.wrap}>
      <div className={s.toolbar} role="toolbar" aria-label={t('htmlEditor.toolbar.ariaLabel')}>
        <ToolButton title={t('htmlEditor.toolbar.undo')} disabled={!canUndo} onClick={() => chain()?.undo().run()}>
          <Undo2 className={s.toolIcon} />
        </ToolButton>
        <ToolButton title={t('htmlEditor.toolbar.redo')} disabled={!canRedo} onClick={() => chain()?.redo().run()}>
          <Redo2 className={s.toolIcon} />
        </ToolButton>

        <span className={s.divider} />

        <ToolButton
          title={t('htmlEditor.toolbar.heading')}
          active={editor?.isActive('heading', { level: 2 })}
          onClick={() => chain()?.toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolButton>
        <ToolButton
          title={t('htmlEditor.toolbar.bold')}
          active={editor?.isActive('bold')}
          onClick={() => chain()?.toggleBold().run()}
        >
          B
        </ToolButton>
        <ToolButton
          title={t('htmlEditor.toolbar.italic')}
          active={editor?.isActive('italic')}
          onClick={() => chain()?.toggleItalic().run()}
        >
          I
        </ToolButton>
        <ToolButton
          title={t('htmlEditor.toolbar.underline')}
          active={editor?.isActive('underline')}
          onClick={() => chain()?.toggleUnderline().run()}
        >
          U
        </ToolButton>

        <span className={s.divider} />

        <FontSizeControl
          value={fontState.size}
          mixed={fontState.mixed}
          min={FONT_MIN}
          max={FONT_MAX}
          presets={FONT_PRESETS}
          onApply={applyFontSize}
          onStep={(delta) => stepFontSize(delta * FONT_STEP)}
        />

        <span className={s.divider} />

        <ToolButton
          title={t('htmlEditor.toolbar.bulletList')}
          active={editor?.isActive('bulletList')}
          onClick={() => chain()?.toggleBulletList().run()}
        >
          •
        </ToolButton>
        <ToolButton
          title={t('htmlEditor.toolbar.orderedList')}
          active={editor?.isActive('orderedList')}
          onClick={() => chain()?.toggleOrderedList().run()}
        >
          1.
        </ToolButton>
        <ToolButton
          title={t('htmlEditor.toolbar.link')}
          active={editor?.isActive('link')}
          onClick={toggleLink}
        >
          ⛓
        </ToolButton>

        <span className={s.divider} />

        <label className={s.colorControl} title={t('htmlEditor.toolbar.textColor')}>
          <span className={s.colorLabel}>A</span>
          <input
            className={s.colorInput}
            type="color"
            defaultValue="#5fa8ff"
            onChange={(e) => chain()?.setColor(e.target.value).run()}
          />
        </label>
        <ToolButton title={t('htmlEditor.toolbar.clearTextColor')} onClick={() => chain()?.unsetColor().run()}>
          A×
        </ToolButton>

        <label className={s.colorControl} title={t('htmlEditor.toolbar.highlightColor')}>
          <span className={s.colorLabel}>▦</span>
          <input
            className={s.colorInput}
            type="color"
            defaultValue="#fff59d"
            onChange={(e) => chain()?.setHighlight({ color: e.target.value }).run()}
          />
        </label>
        <ToolButton title={t('htmlEditor.toolbar.clearHighlight')} onClick={() => chain()?.unsetHighlight().run()}>
          ⌫
        </ToolButton>
      </div>

      <div className={s.editorWrap}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
