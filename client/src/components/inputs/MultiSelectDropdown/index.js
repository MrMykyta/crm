import React from 'react';
import { createPortal } from 'react-dom';
import styles from './MultiSelectDropdown.module.css';

/**
 * MultiSelectDropdown
 * props:
 * - options: [{ value, label }]
 * - value: string[]
 * - onChange: (next: string[]) => void
 * - placeholder: string
 * - maxPreview: number
 * - disabled: boolean
 * - menuMaxHeight: number
 * - filterable: boolean
 * - allowCreate: boolean
 * - createText: (q)=>string
 * - className: string   // используется для стилей "как input" (напр. .asInput)
 */
export default function MultiSelectDropdown({
  options = [],
  value = [],
  onChange = () => {},
  placeholder = '',
  maxPreview = 3,
  disabled = false,
  menuMaxHeight = 320,
  filterable = true,
  allowCreate = false,
  createText = (q) => `Добавить «${q}»`,
  className = '',
}) {
  const [open, setOpen]   = React.useState(false);
  const [pos, setPos]     = React.useState({ top: 0, left: 0, width: 0, placeAbove: false });
  const [query, setQuery] = React.useState('');
  const trigRef  = React.useRef(null);
  const inputRef = React.useRef(null);
  const selectAllRef = React.useRef(null);
  const portalId = React.useRef(`msd-menu-${Math.random().toString(36).slice(2)}`);

  const toggle = React.useCallback(() => {
    if (!disabled) setOpen(o => !o);
  }, [disabled]);

  const map = React.useMemo(() => {
    const m = new Map();
    for (const o of options) m.set(String(o.value), o.label ?? String(o.value));
    return m;
  }, [options]);

  const selected = React.useMemo(
    () => (Array.isArray(value) ? value.map(String) : []),
    [value]
  );

  const selectedLabels = React.useMemo(
    () => selected.map(v => map.get(v) ?? v).filter(Boolean),
    [selected, map]
  );

  let triggerText = placeholder;
  if (selectedLabels.length > 0) {
    triggerText =
      selectedLabels.length <= maxPreview
        ? selectedLabels.join(', ')
        : `${selectedLabels.slice(0, maxPreview).join(', ')} +${selectedLabels.length - maxPreview}`;
  }

  const q = query.trim().toLowerCase();

  const filteredOptions = React.useMemo(() => {
    if (!filterable || !q) return options;
    return options.filter(o =>
      String(o.label ?? o.value).toLowerCase().includes(q)
    );
  }, [options, filterable, q]);

  const filteredIds = React.useMemo(
    () => filteredOptions.map(o => String(o.value)),
    [filteredOptions]
  );

  const filteredSelectedCount = React.useMemo(
    () => filteredIds.reduce((acc, id) => acc + (selected.includes(id) ? 1 : 0), 0),
    [filteredIds, selected]
  );

  const allFilteredSelected  = filteredOptions.length > 0 && filteredSelectedCount === filteredOptions.length;
  const noneFilteredSelected = filteredSelectedCount === 0;
  const someFilteredSelected = !noneFilteredSelected && !allFilteredSelected;

  React.useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someFilteredSelected;
  }, [someFilteredSelected]);

  const onToggleAllFiltered = () => {
    if (!filteredOptions.length) return;
    const set = new Set(selected);
    if (allFilteredSelected) filteredIds.forEach(id => set.delete(id));
    else filteredIds.forEach(id => set.add(id));
    onChange(Array.from(set));
  };

  const toggleItem = (val) => {
    const v = String(val);
    const set = new Set(selected);
    if (set.has(v)) set.delete(v); else set.add(v);
    onChange(Array.from(set));
  };

  const computePosition = React.useCallback(() => {
    const el = trigRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const spaceBelow = vh - r.bottom;
    const placeAbove = spaceBelow < 220;
    setPos({ top: placeAbove ? r.top : r.bottom, left: r.left, width: r.width, placeAbove });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    computePosition();

    const onDoc = (e) => {
      const menu = document.getElementById(portalId.current);
      const insideTrigger = trigRef.current && trigRef.current.contains(e.target);
      const insideMenu = menu && menu.contains(e.target);
      if (!insideTrigger && !insideMenu) setOpen(false);
    };
    const onScroll = () => computePosition();
    const onResize = () => computePosition();

    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);

    const id = setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 0);

    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, computePosition]);

  const canCreate = allowCreate && q.length > 0 && !options.some(o => String(o.value).toLowerCase() === q);
  const createAndSelect = () => {
    if (!canCreate) return;
    const v = query.trim();
    if (!v) return;
    const set = new Set(selected);
    set.add(v);
    onChange(Array.from(set));
    setQuery('');
  };

  const menuNode = open ? (
    <div
      id={portalId.current}
      className={styles.menuFixed}
      style={{
        top: pos.top,
        left: pos.left,
        width: pos.width,
        transform: pos.placeAbove ? 'translateY(calc(-100% - 6px))' : 'translateY(6px)',
        maxHeight: menuMaxHeight,
      }}
    >
      {filterable && (
        <div className={styles.searchRow}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={styles.searchInput}
            placeholder="Поиск…"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canCreate) {
                e.preventDefault();
                createAndSelect();
              }
            }}
          />
          {query && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => setQuery('')}
              aria-label="Очистить"
            >
              ×
            </button>
          )}
        </div>
      )}

      <div className={styles.allRow}>
        <label className={styles.allLabel} title="По текущему фильтру">
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allFilteredSelected}
            onChange={onToggleAllFiltered}
          />
          <span>Выбрать всех</span>
          <span className={styles.count}>
            {filteredSelectedCount}/{filteredOptions.length}
          </span>
        </label>
      </div>

      <div
        className={styles.list}
        style={{
          maxHeight: menuMaxHeight - 48 - (filterable ? 44 : 0),
          overflow: 'auto',
        }}
      >
        {filteredOptions.length === 0 && !canCreate && (
          <div className={styles.empty}>Ничего не найдено</div>
        )}

        {filteredOptions.map(o => {
          const id = String(o.value);
          const checked = selected.includes(id);
          return (
            <label key={id} className={styles.item} title={o.label}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleItem(id)}
              />
              <span className={styles.itemText}>{o.label}</span>
            </label>
          );
        })}

        {canCreate && (
          <button
            type="button"
            className={`${styles.item} ${styles.createItem}`}
            onClick={createAndSelect}
          >
            {createText(query.trim())}
          </button>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.trigger} ${className || ''}`}
        onClick={toggle}
        disabled={disabled}
        title={selectedLabels.join(', ')}
        ref={trigRef}
      >
        <span className={styles.triggerText}>{triggerText}</span>
        <span className={styles.caret} />
      </button>

      {open && createPortal(menuNode, document.body)}
    </div>
  );
}