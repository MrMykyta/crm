import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import s from './AutocompleteSelect.module.css';

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
}) {
  const wrapRef = useRef(null);
  const portalId = useRef(`ac-menu-${Math.random().toString(36).slice(2)}`);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, placeAbove: false });

  const items = Array.isArray(options) ? options : [];
  const hasQuery = String(inputValue || '').trim().length > 0;
  const selectedKey = value ? String(getOptionKey(value)) : null;

  const computePosition = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const spaceBelow = vh - r.bottom;
    const placeAbove = spaceBelow < 220;
    setPos({ top: placeAbove ? r.top : r.bottom, left: r.left, width: r.width, placeAbove });
  }, []);

  useEffect(() => {
    if (!open) return;
    computePosition();

    const onDoc = (e) => {
      const menu = document.getElementById(portalId.current);
      const insideWrap = wrapRef.current && wrapRef.current.contains(e.target);
      const insideMenu = menu && menu.contains(e.target);
      if (!insideWrap && !insideMenu) setOpen(false);
    };
    const onScroll = () => computePosition();
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
    if (activeIndex >= items.length) {
      setActiveIndex(items.length - 1);
    }
  }, [activeIndex, items.length, open]);

  const pick = (opt) => {
    onSelect?.(opt);
    setOpen(false);
    setActiveIndex(-1);
  };

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

  const menuNode = open ? (
    <div
      id={portalId.current}
      className={s.menuFixed}
      style={{
        top: pos.top,
        left: pos.left,
        width: pos.width,
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

      {items.length > 0 && (
        <div className={s.list} role="listbox">
          {items.map((opt, idx) => {
            const key = String(getOptionKey(opt));
            const primary = getOptionPrimary(opt);
            const secondary = getOptionSecondary ? getOptionSecondary(opt) : null;
            const active = idx === activeIndex;
            const selected = selectedKey && key === selectedKey;
            return (
              <button
                type="button"
                key={key}
                className={clsx(s.option, active && s.optionActive, selected && s.optionSelected)}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => pick(opt)}
              >
                <span className={s.optionPrimary}>{primary}</span>
                {secondary ? <span className={s.optionSecondary}>{secondary}</span> : null}
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
      <span className={s.caret} />
      {open && menuNode ? createPortal(menuNode, document.body) : null}
    </div>
  );
}
