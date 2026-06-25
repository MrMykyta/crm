import * as Select from '@radix-ui/react-select';
import React from 'react';
import clsx from 'clsx';
import s from './RadixSelect.module.css';

const EMPTY_TOKEN = '__EMPTY__RADIX__';

/**
 * ThemedSelect — обёртка над Radix Select.
 * Поддерживает:
 * - options: [{ value, label }]
 * - value: string
 * - onChange: (value) => void
 * - placeholder?: string
 * - size?: 'sm' | 'md'
 * - className?: string   // прокид для внешних правил (напр. .asInput для float-label)
 * - disabled?: boolean
 */
export default function ThemedSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Выбрать…',
  size = 'md',
  className = '',
  contentClassName = '',
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Поиск…',
  emptyLabel = 'Ничего не найдено',
}) {
  const internalValue = value === '' ? EMPTY_TOKEN : String(value);
  const triggerRef = React.useRef(null);
  const searchRef = React.useRef(null);
  const [collisionBoundary, setCollisionBoundary] = React.useState(null);
  const [open, setOpen] = React.useState(false);
  const [contentSide, setContentSide] = React.useState('bottom');
  const [query, setQuery] = React.useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const visibleOptions = React.useMemo(() => {
    if (!searchable || !normalizedQuery) return options;
    return options.filter((option) => {
      const label = String(option?.label ?? '');
      const optionValue = String(option?.value ?? '');
      return (
        label.toLowerCase().includes(normalizedQuery)
        || optionValue.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [normalizedQuery, options, searchable]);

  // Определяет границу dropdown и сторону открытия (вверх/вниз)
  // по доступному месту в текущей видимой области.
  const resolveBoundary = React.useCallback(() => {
    const triggerEl = triggerRef.current;
    if (!triggerEl) {
      setCollisionBoundary(null);
      setContentSide('bottom');
      return;
    }
    const boundaryEl = triggerEl.closest?.(
      '[data-select-boundary="1"], [data-autocomplete-boundary="1"]'
    ) || null;

    const rect = triggerEl.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    const visibleTop = boundaryEl
      ? Math.max(0, boundaryEl.getBoundingClientRect().top)
      : 0;
    const visibleBottom = boundaryEl
      ? Math.min(vh, boundaryEl.getBoundingClientRect().bottom)
      : vh;
    const spaceBelow = visibleBottom - rect.bottom;
    const spaceAbove = rect.top - visibleTop;
    const nextSide = spaceBelow < 220 && spaceAbove > spaceBelow ? 'top' : 'bottom';

    setCollisionBoundary(boundaryEl);
    setContentSide(nextSide);
  }, []);

  React.useEffect(() => {
    if (!open) return undefined;
    // Во время открытого меню пересчитываем позицию при скролле/ресайзе.
    const onRecalc = () => resolveBoundary();
    window.addEventListener('resize', onRecalc);
    window.addEventListener('scroll', onRecalc, true);
    return () => {
      window.removeEventListener('resize', onRecalc);
      window.removeEventListener('scroll', onRecalc, true);
    };
  }, [open, resolveBoundary]);

  React.useEffect(() => {
    if (!open || !searchable) return undefined;
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open, searchable]);

  // Нормализует "пустое" значение из Radix-токена обратно в обычную пустую строку.
  const handleChange = (v) => {
    const out = v === EMPTY_TOKEN ? '' : v;
    onChange?.(out);
  };

  return (
    <Select.Root
      value={internalValue}
      onValueChange={handleChange}
      disabled={disabled}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          resolveBoundary();
        } else {
          setQuery('');
        }
      }}
    >
      <Select.Trigger
        ref={triggerRef}
        className={clsx(s.trigger, s[`size_${size}`], className)}
        aria-label={placeholder}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon className={s.icon}>▾</Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className={clsx(s.content, contentClassName)}
          position="popper"
          side={contentSide}
          align="start"
          sideOffset={6}
          avoidCollisions
          collisionPadding={8}
          collisionBoundary={collisionBoundary ? [collisionBoundary] : undefined}
        >
          {searchable ? (
            <div className={s.searchRow}>
              <input
                ref={searchRef}
                className={s.searchInput}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Escape') event.stopPropagation();
                }}
                onPointerDown={(event) => event.stopPropagation()}
                placeholder={searchPlaceholder}
                autoComplete="off"
              />
            </div>
          ) : null}
          <Select.Viewport className={s.viewport}>
            {visibleOptions.map((o) => {
              const itemVal = o.value === '' ? EMPTY_TOKEN : String(o.value);
              return (
                <Select.Item
                  key={itemVal}
                  value={itemVal}
                  className={s.item}
                  disabled={Boolean(o.disabled)}
                >
                  <Select.ItemText>{o.label}</Select.ItemText>
                  <Select.ItemIndicator className={s.check}>✓</Select.ItemIndicator>
                </Select.Item>
              );
            })}
            {searchable && visibleOptions.length === 0 ? (
              <div className={s.emptyState}>{emptyLabel}</div>
            ) : null}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
