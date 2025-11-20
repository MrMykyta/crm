// src/components/filters/FilterToolbar/index.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import s from './Toolbar.module.css';
import ThemedSelect from '../../inputs/RadixSelect';

// — утилиты нормализации
const norm = (v) => (v ?? '').trim();
const toQueryValue = (v) => (v ? v : undefined);

/**
 * Универсальный Toolbar, рендерит контролы по декларативной схеме.
 *
 * props:
 * - query: объект текущих фильтров
 * - onChange: (updater | next) -> void, как в твоём ListPage
 * - controls: массив описаний контролов (см. ниже)
 * - mode?: текущее значение режима (строка) — если есть контрол type:'mode', он его покажет/меняет
 * - onModeChange?: (next) -> void — обработчик смены режима
 * - extra?: ReactNode — правый блок
 *
 * Типы контролов:
 * 1) { type:'search', key:'search', placeholder?: string | (mode)=>string, debounce?: number }
 * 2) { type:'select', key:'type', label?: string, options: Option[] | (mode)=>Option[], emptyAsUndefined?: boolean }
 *    Option: { value: string, label: string }
 * 3) { type:'mode', key:'mode', options: Option[] }  // вместо отдельного UsersToolbar
 * 4) { type:'custom', render: ({query, onChange, mode}) => ReactNode } // escape hatch
 */
export default function FilterToolbar({
  query,
  onChange,
  controls = [],
  mode,
  onModeChange,
  extra,
}) {
  // локальная «только для поиска» дебаунс-состояние по ключу 'search'
  const searchCfg = useMemo(() => controls.find(c => c.type === 'search'), [controls]);
  const [search, setSearch] = useState(norm(query[searchCfg?.key || 'search']));

  useEffect(() => {
    if (!searchCfg) return;
    const next = norm(query[searchCfg.key]);
    if (next !== search) setSearch(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchCfg?.key, query?.[searchCfg?.key || 'search']]);

  // единый дебаунс для поиска
  const timerRef = useRef(null);
  useEffect(() => {
    if (!searchCfg) return;
    const curr = norm(search);
    const currentInQuery = norm(query[searchCfg.key]);
    if (curr === currentInQuery) return;
    const delay = Number.isFinite(searchCfg.debounce) ? searchCfg.debounce : 400;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange((q) => {
        const currQ = norm(q[searchCfg.key]);
        if (currQ === curr) return q;
        return { ...q, [searchCfg.key]: toQueryValue(curr), page: 1 };
      });
    }, delay);
    return () => clearTimeout(timerRef.current);
  }, [search, searchCfg, onChange, query]);

  // — helpers для select
  const handleSelect = (key, v, emptyAsUndefined = true) => {
    onChange(q => {
      const nextVal = emptyAsUndefined ? (v || undefined) : v;
      if ((q[key] || '') === (v || '')) return q;
      return { ...q, [key]: nextVal, page: 1 };
    });
  };

  // — рендер по схеме
  const renderControl = (c, idx) => {
    switch (c.type) {
      case 'mode': {
        const opts = typeof c.options === 'function' ? c.options(mode) : c.options;
        return (
          <ThemedSelect
            key={`m-${idx}`}
            className={s.select}
            value={mode ?? ''}
            options={opts || []}
            placeholder={c.label || 'Режим'}
            size="sm"
            onChange={(val) => onModeChange?.(val)}
          />
        );
      }

      case 'search': {
        const ph = typeof c.placeholder === 'function' ? c.placeholder(mode) : c.placeholder;
        return (
          <input
            key={`s-${idx}`}
            className={s.input}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={ph || 'Search…'}
          />
        );
      }

      case 'select': {
        const opts = typeof c.options === 'function' ? c.options(mode) : c.options;
        const val = query?.[c.key] ?? '';
        return (
          <ThemedSelect
            key={`f-${c.key}-${idx}`}
            className={s.select}
            value={val}
            options={opts || []}
            placeholder={c.label || 'Выбор'}
            size="sm"
            onChange={(v) => handleSelect(c.key, v, c.emptyAsUndefined !== false)}
          />
        );
      }

      case 'custom': {
        return (
          <div key={`x-${idx}`} className={s.customWrap}>
            {c.render?.({ query, onChange, mode })}
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className={s.toolbar}>
      {controls.map(renderControl)}
      <div className={s.spacer} />
      {extra ? <div className={s.extra}>{extra}</div> : null}
    </div>
  );
}