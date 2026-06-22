import React from "react";
import FieldShell from "../FieldShell";
import DateTimePicker from "../../../inputs/DateTimePicker";
import { cx } from "../fieldUtils";

/**
 * DateField — обёртка над существующим components/inputs/DateTimePicker (date-only).
 * DateTimePicker НЕ переписывается. Наружу уходит та же local-naive строка
 * (YYYY-MM-DD), что и сейчас — никаких Date objects и timezone-конвертаций.
 *
 * onChange contract: нативного DOM-события нет → onChange(value, null).
 */
export default function DateField({
  name,
  id,
  label,
  value,
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
  inputClassName = "",
  fullWidth = true,
  size = "md",
  loading = false,
  locale,
  ...rest
}) {
  const fieldId = id || name;

  const emit = (next) => {
    onValueChange?.(next);
    onChange?.(next, null);
  };

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
      className={className}
    >
      <DateTimePicker
        id={fieldId}
        value={value === undefined || value === null ? "" : String(value)}
        withTime={false}
        onChange={emit}
        disabled={disabled || readOnly}
        placeholder={placeholder}
        className={cx(inputClassName)}
        {...(locale ? { locale } : null)}
        {...rest}
      />
    </FieldShell>
  );
}
