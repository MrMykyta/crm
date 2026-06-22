import React from "react";
import FieldShell from "../FieldShell";
import ThemedSelect from "../../../inputs/RadixSelect";
import s from "../fields.module.css";

/**
 * SelectField — обёртка над существующим ThemedSelect (components/inputs/RadixSelect).
 * RadixSelect НЕ переписывается. Сохраняется его string-based модель.
 *
 * valueType:
 *   "string" (default) — наружу уходит строка (как у ThemedSelect).
 *   "number"           — наружу уходит number или null (только явно).
 *
 * onChange contract (dual-mode):
 *   onValueChange?.(value)
 *   onChange?.(value, null)   // нативного DOM-события у Radix нет → второй аргумент null
 */
export default function SelectField({
  name,
  id,
  label,
  value,
  options = [],
  onChange,
  onValueChange,
  placeholder,
  disabled = false,
  readOnly = false,
  required = false,
  error,
  helperText,
  description,
  className = "",
  fullWidth = true,
  size = "md",
  loading = false,
  clearable = false,
  valueType = "string",
  ...rest
}) {
  const fieldId = id || name;
  const stringValue = value === undefined || value === null ? "" : String(value);

  const coerceOut = (next) => {
    if (valueType !== "number") return next;
    if (next === "" || next === null || next === undefined) return null;
    const num = Number(next);
    return Number.isNaN(num) ? null : num;
  };

  const emit = (next) => {
    const out = coerceOut(next);
    onValueChange?.(out);
    onChange?.(out, null);
  };

  // RadixSelect size принимает 'sm' | 'md'; 'lg' маппим в 'md'.
  const radixSize = size === "lg" ? "md" : size;

  const clearControl =
    clearable && stringValue ? (
      <button
        type="button"
        className={s.clearBtn}
        onClick={() => emit("")}
        aria-label="Clear"
        disabled={disabled || readOnly}
      >
        ✕
      </button>
    ) : null;

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
      rightIcon={clearControl}
      className={className}
    >
      <ThemedSelect
        options={options}
        value={stringValue}
        onChange={emit}
        placeholder={placeholder}
        size={radixSize}
        disabled={disabled || readOnly}
        {...rest}
      />
    </FieldShell>
  );
}
