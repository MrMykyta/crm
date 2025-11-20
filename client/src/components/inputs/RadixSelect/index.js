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
  disabled = false,
}) {
  const internalValue = value === '' ? EMPTY_TOKEN : String(value);

  const handleChange = (v) => {
    const out = v === EMPTY_TOKEN ? '' : v;
    onChange?.(out);
  };

  return (
    <Select.Root value={internalValue} onValueChange={handleChange} disabled={disabled}>
      <Select.Trigger
        className={clsx(s.trigger, s[`size_${size}`], className)}
        aria-label={placeholder}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon className={s.icon}>▾</Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content className={s.content} position="popper">
          <Select.Viewport className={s.viewport}>
            {options.map((o) => {
              const itemVal = o.value === '' ? EMPTY_TOKEN : String(o.value);
              return (
                <Select.Item key={itemVal} value={itemVal} className={s.item}>
                  <Select.ItemText>{o.label}</Select.ItemText>
                  <Select.ItemIndicator className={s.check}>✓</Select.ItemIndicator>
                </Select.Item>
              );
            })}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}