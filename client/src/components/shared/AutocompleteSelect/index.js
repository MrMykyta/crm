import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import s from './AutocompleteSelect.module.css';

/**
 * Универсальный autocomplete-select c портал-меню и адаптивным позиционированием.
 * Используется там, где нужно искать/выбирать сущности и держать dropdown в рамках видимой зоны.
 */
export default function AutocompleteSelect({
  value = null,
  inputValue = '',
  onInputChange,
  options = [],
  onSelect,
  placeholder = '',
  hint = '',
  loading = false,
  emptyLabel = 'No results',
  searchingLabel = 'Searching...',
  getOptionKey = (o) => o?.id ?? o?.value ?? o?.key ?? o?.name,
  getOptionPrimary = (o) => o?.label ?? o?.name ?? String(getOptionKey(o)),
  getOptionSecondary,
  disabled = false,
  className = '',
  inputClassName = '',
  menuClassName = '',
  opaque = false,
  showCreateAction = false,
  createActionLabel = '',
  createActionLoading = false,
  createActionLoadingLabel = 'Creating...',
  onCreateAction,
  canDeleteOption,
  onDeleteOption,
  deletingOptionKey = null,
  canEditOption,
  onEditOption,
  editingOptionKey = null,
}) {
  const wrapRef = useRef(null);
  const portalId = useRef(`ac-menu-${Math.random().toString(36).slice(2)}`);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, placeAbove: false, maxHeight: 320 });

  const items = Array.isArray(options) ? options : [];
  const hasQuery = String(inputValue || '').trim().length > 0;
  const selectedKey = value ? String(getOptionKey(value)) : null;

  // Считает координаты меню и решает, открывать его вверх или вниз,
  // чтобы список не вылезал за доступные границы контейнера/экрана.
  const computePosition = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const boundaryEl = el.closest?.('[data-autocomplete-boundary="1"]');
    const boundaryRect = boundaryEl?.getBoundingClientRect?.() || null;

    const visibleTop = boundaryRect ? Math.max(0, boundaryRect.top) : 0;
    const visibleBottom = boundaryRect ? Math.min(vh, boundaryRect.bottom) : vh;
    const spaceBelow = visibleBottom - r.bottom;
    const spaceAbove = r.top - visibleTop;
    const chromeReserve = 56; // input hint/create row and menu paddings
    const usableBelow = spaceBelow - chromeReserve;
    const usableAbove = spaceAbove - chromeReserve;
    const placeAbove = usableBelow < 120 && usableAbove > usableBelow;

    const minLeft = boundaryRect ? boundaryRect.left + 8 : 8;
    const maxRight = boundaryRect ? boundaryRect.right - 8 : vw - 8;
    const maxWidth = Math.max(180, maxRight - minLeft);
    const width = Math.min(r.width, maxWidth);
    const unclampedLeft = r.left;
    const left = Math.min(Math.max(unclampedLeft, minLeft), maxRight - width);
    const available = Math.max(0, placeAbove ? spaceAbove : spaceBelow);
    const preferredListHeight = Math.min(360, Math.max(120, Math.floor(available - chromeReserve)));
    const maxListHeightBySpace = Math.max(0, Math.floor(available - 8));
    const maxHeight = Math.max(0, Math.min(preferredListHeight, maxListHeightBySpace));

    setPos({
      top: placeAbove ? r.top : r.bottom,
      left,
      width,
      placeAbove,
      maxHeight,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    computePosition();

    // Закрывает меню по клику вне инпута и вне самого portal-меню.
    const onDoc = (e) => {
      const menu = document.getElementById(portalId.current);
      const insideWrap = wrapRef.current && wrapRef.current.contains(e.target);
      const insideMenu = menu && menu.contains(e.target);
      if (!insideWrap && !insideMenu) setOpen(false);
    };
    // При скролле/ресайзе перепозиционирует меню относительно инпута.
    const onScroll = () => computePosition();
        // onResize: вспомогательная логика компонента.
const onResize = () => computePosition();

    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);

    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return;
    // Если список опций стал короче, держим активный индекс в валидных границах.
    if (activeIndex >= items.length) {
      setActiveIndex(items.length - 1);
    }
  }, [activeIndex, items.length, open]);

  // Выбирает опцию и закрывает dropdown.
  const pick = (opt) => {
    onSelect?.(opt);
    setOpen(false);
    setActiveIndex(-1);
  };

  // Перемещает активный пункт стрелками вверх/вниз.
  const moveActive = (dir) => {
    if (!items.length) return;
    setActiveIndex((idx) => {
      if (idx < 0) return dir > 0 ? 0 : items.length - 1;
      const next = idx + dir;
      if (next < 0) return 0;
      if (next >= items.length) return items.length - 1;
      return next;
    });
  };

  // Клавиатурное управление списком: Esc/ArrowUp/ArrowDown/Enter.
  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      moveActive(1);
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) setOpen(true);
      moveActive(-1);
    }
    if (e.key === 'Enter' && open && activeIndex >= 0 && items[activeIndex]) {
      e.preventDefault();
      pick(items[activeIndex]);
    }
  };

  // Узел меню рендерится в portal, чтобы не ломаться из-за overflow родителя.
  const menuNode = open ? (
    <div
      id={portalId.current}
      className={clsx(s.menuFixed, opaque && s.menuOpaque, menuClassName)}
      style={{
        top: pos.top,
        left: pos.left,
        width: pos.width,
        '--ac-menu-max-height': `${pos.maxHeight}px`,
        transform: pos.placeAbove ? 'translateY(calc(-100% - 6px))' : 'translateY(6px)',
      }}
    >
      {loading && hasQuery && (
        <div className={s.state}>{searchingLabel}</div>
      )}

      {!loading && !hasQuery && hint && (
        <div className={s.state}>{hint}</div>
      )}

      {!loading && hasQuery && items.length === 0 && (
        <div className={s.state}>{emptyLabel}</div>
      )}

      {showCreateAction && (
        <div className={s.createRow}>
          <button
            type="button"
            className={clsx(s.createAction, opaque && s.createActionOpaque)}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              await onCreateAction?.();
              setOpen(false);
              setActiveIndex(-1);
            }}
            disabled={createActionLoading}
          >
            {createActionLoading ? createActionLoadingLabel : createActionLabel}
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div className={s.list} role="listbox">
          {items.map((opt, idx) => {
            const key = String(getOptionKey(opt));
            const primary = getOptionPrimary(opt);
            const secondary = getOptionSecondary ? getOptionSecondary(opt) : null;
            const chip = opt?.chip || opt?.typeLabel || opt?.kindLabel || '';
            const active = idx === activeIndex;
            const selected = selectedKey && key === selectedKey;
            const canDelete = Boolean(canDeleteOption?.(opt));
            const canEdit = Boolean(canEditOption?.(opt));
            const isDeleting = String(deletingOptionKey || '') === key;
            const isEditing = String(editingOptionKey || '') === key;
            return (
              <button
                type="button"
                key={key}
                className={clsx(
                  s.option,
                  opaque && s.optionOpaque,
                  active && s.optionActive,
                  selected && s.optionSelected
                )}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => pick(opt)}
              >
                <span className={s.optionMain}>
                  {chip ? <span className={s.optionChip}>{chip}</span> : null}
                  <span className={s.optionPrimary}>{primary}</span>
                </span>
                <span className={s.optionRight}>
                  {secondary ? <span className={s.optionSecondary}>{secondary}</span> : null}
                  {canEdit ? (
                    <button
                      type="button"
                      className={s.optionEditBtn}
                      aria-disabled={isEditing}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isEditing) return;
                        onEditOption?.(opt);
                      }}
                      title="Редактировать"
                      aria-label="Редактировать"
                    >
                      {isEditing ? '…' : '✎'}
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button
                      type="button"
                      className={s.optionDeleteBtn}
                      aria-disabled={isDeleting}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isDeleting) return;
                        onDeleteOption?.(opt);
                      }}
                      title="Удалить"
                      aria-label="Удалить"
                    >
                      {isDeleting ? '…' : '✕'}
                    </button>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className={clsx(s.wrap, className)} ref={wrapRef}>
      <input
        className={clsx(s.input, inputClassName)}
        value={inputValue}
        onChange={(e) => {
          onInputChange?.(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => !disabled && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      <span className={clsx(s.caret, open && s.caretOpen)} />
      {open && menuNode ? createPortal(menuNode, document.body) : null}
    </div>
  );
}
