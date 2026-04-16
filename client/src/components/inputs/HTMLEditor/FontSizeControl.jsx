import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import s from './HTMLEditor.module.css';

// toDigits: вспомогательная логика компонента.
const toDigits = (value = '') => String(value || '').replace(/[^\d]/g, '');

// Компонент FontSizeControl: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function FontSizeControl({
  value,
  mixed = false,
  min = 6,
  max = 96,
  presets = [],
  onApply,
  onStep,
}) {
  const rootRef = useRef(null);
  const fieldRef = useRef(null);
  const menuRef = useRef(null);
  const inputRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(mixed ? '' : String(value || ''));
  const [menuRect, setMenuRect] = useState(null);

  useEffect(() => {
    setDraft(mixed ? '' : String(value || ''));
  }, [mixed, value]);

  useEffect(() => {
        // onDocMouseDown: вспомогательная логика компонента.
const onDocMouseDown = (event) => {
      if (rootRef.current?.contains(event.target)) return;
      if (menuRef.current?.contains(event.target)) return;
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setMenuRect(null);
      return undefined;
    }

        // updateMenuRect: обновляет данные внутри компонента.
const updateMenuRect = () => {
      const rect = fieldRef.current?.getBoundingClientRect();
      if (!rect) return;

      setMenuRect({
        top: rect.bottom + 6,
        left: rect.left,
        width: Math.max(94, Math.round(rect.width)),
      });
    };

    updateMenuRect();
    window.addEventListener('resize', updateMenuRect);
    window.addEventListener('scroll', updateMenuRect, true);

    return () => {
      window.removeEventListener('resize', updateMenuRect);
      window.removeEventListener('scroll', updateMenuRect, true);
    };
  }, [open]);

    // revertDraft: вспомогательная логика компонента.
const revertDraft = () => {
    setDraft(mixed ? '' : String(value || ''));
  };

    // commit: вспомогательная логика компонента.
const commit = () => {
    const raw = toDigits(draft);
    if (!raw) {
      revertDraft();
      return;
    }

    const parsed = Number(raw);
    if (!Number.isInteger(parsed)) {
      revertDraft();
      return;
    }

    const next = Math.max(min, Math.min(max, parsed));
    onApply?.(next);
    setDraft(String(next));
  };

    // applyPreset: вспомогательная логика компонента.
const applyPreset = (size) => {
    onApply?.(size);
    setDraft(String(size));
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className={s.fontSizeWrap} ref={rootRef}>
      <button
        type="button"
        className={`${s.toolBtn} ${s.fontSizeStepBtn}`.trim()}
        title="Уменьшить размер"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onStep?.(-1)}
      >
        A-
      </button>

      <div ref={fieldRef} className={`${s.fontSizeField} ${open ? s.fontSizeFieldOpen : ''}`}>
        <input
          ref={inputRef}
          className={`${s.fontSizeInput} ${mixed ? s.fontSizeInputMixed : ''}`.trim()}
          value={draft}
          placeholder={mixed ? '—' : ''}
          onFocus={(e) => {
            e.target.select();
          }}
          onChange={(e) => setDraft(toDigits(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
              setOpen(false);
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              revertDraft();
              setOpen(false);
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              onStep?.(1);
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              onStep?.(-1);
            }
          }}
          onBlur={() => {
            commit();
          }}
        />
        <button
          type="button"
          className={s.fontSizeChevronBtn}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setOpen((v) => !v);
            inputRef.current?.focus();
          }}
          title="Список размеров"
        >
          <span className={s.fontSizeChevronGlyph} aria-hidden="true">
            {open ? '▴' : '▾'}
          </span>
        </button>

      </div>

      <button
        type="button"
        className={`${s.toolBtn} ${s.fontSizeStepBtn}`.trim()}
        title="Увеличить размер"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onStep?.(1)}
      >
        A+
      </button>

      {open && menuRect
        ? createPortal(
            <div
              ref={menuRef}
              className={s.fontSizeMenu}
              style={{ top: `${menuRect.top}px`, left: `${menuRect.left}px`, width: `${menuRect.width}px` }}
              onMouseDown={(e) => e.preventDefault()}
            >
              {presets.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`${s.fontSizeItem} ${Number(value) === Number(size) ? s.fontSizeItemActive : ''}`.trim()}
                  onClick={() => applyPreset(size)}
                >
                  {size} pt
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

