import React from "react";
import FieldShell from "../FieldShell";
import s from "../fields.module.css";
import { cx, toInputValue, buildDescribedBy } from "../fieldUtils";

/**
 * NumberField — input type="number".
 *
 * emitAs:
 *   "string" (default) — наружу уходит строка как есть (безопасно для payload).
 *   "number"           — наружу уходит number или null (для пустого).
 *
 * Правила:
 *  - пустое значение НЕ превращается в 0: emitAs="string" -> "", emitAs="number" -> null.
 *  - NaN наружу не уходит (emitAs="number": при невалидном вводе emit пропускается).
 *  - value === undefined/null безопасно приводится к "".
 *
 * onChange contract (dual-mode):
 *   onValueChange?.(value)
 *   onChange?.(value, event)
 */
export default function NumberField({
  name,
  id,
  label,
  value,
  onChange,
  onValueChange,
  onBlur,
  placeholder,
  disabled = false,
  readOnly = false,
  required = false,
  error,
  helperText,
  description,
  className = "",
  inputClassName = "",
  fullWidth = true,
  size = "md",
  leftIcon = null,
  rightIcon = null,
  loading = false,
  min,
  max,
  step,
  allowEmpty = true,
  emitAs = "string",
  ...rest
}) {
  const fieldId = id || name;
  const strValue = toInputValue(value);

  // computeEmit: приводит сырой ввод к контрактному значению.
  // Возвращает undefined как сигнал "не эмитить" (NaN guard).
  const computeEmit = (raw) => {
    if (raw === "" || raw === null || raw === undefined) {
      if (!allowEmpty) return emitAs === "number" ? null : "";
      return emitAs === "number" ? null : "";
    }
    if (emitAs === "number") {
      const num = Number(raw);
      return Number.isNaN(num) ? undefined : num;
    }
    return raw;
  };

  const handleChange = (event) => {
    const next = computeEmit(event.target.value);
    if (next === undefined) return; // NaN — не пропускаем наружу
    onValueChange?.(next);
    onChange?.(next, event);
  };

  const describedBy = buildDescribedBy(fieldId, {
    hasDescription: Boolean(description),
    hasHelper: Boolean(helperText) && !error,
    hasError: Boolean(error),
  });

  return (
    <FieldShell
      id={fieldId}
      label={label}
      required={required}
      description={description}
      helperText={helperText}
      error={error}
      disabled={disabled}
      readOnly={readOnly}
      loading={loading}
      fullWidth={fullWidth}
      size={size}
      leftIcon={leftIcon}
      rightIcon={rightIcon}
      className={className}
    >
      <input
        id={fieldId}
        name={name}
        type="number"
        className={cx(s.input, inputClassName)}
        value={strValue}
        onChange={handleChange}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        min={min}
        max={max}
        step={step}
        inputMode="decimal"
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
    </FieldShell>
  );
}
