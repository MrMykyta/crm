import React from "react";
import FieldShell from "../FieldShell";
import DateTimePicker from "../../../inputs/DateTimePicker";
import { cx } from "../fieldUtils";

/**
 * DateTimeField — обёртка над components/inputs/DateTimePicker (withTime).
 * DateTimePicker НЕ переписывается. Наружу — та же local-naive строка
 * (YYYY-MM-DDTHH:mm), без timezone-конвертаций и без Date objects.
 *
 * allowTimeToggle поддерживается нативным компонентом (onWithTimeChange).
 * onChange contract: onChange(value, null).
 */
export default function DateTimeField({
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
  float = false,
  isFilled,
  isFocused = false,
  withTime = true,
  allowTimeToggle = false,
  onWithTimeChange,
  timeToggleLabel,
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
      float={float}
      isFilled={isFilled ?? (value !== undefined && value !== null && String(value) !== "")}
      isFocused={isFocused}
      className={className}
    >
      <DateTimePicker
        id={fieldId}
        value={value === undefined || value === null ? "" : String(value)}
        withTime={withTime}
        allowTimeToggle={allowTimeToggle}
        onWithTimeChange={onWithTimeChange}
        onChange={emit}
        disabled={disabled || readOnly}
        placeholder={placeholder}
        className={cx(inputClassName)}
        {...(timeToggleLabel ? { timeToggleLabel } : null)}
        {...(locale ? { locale } : null)}
        {...rest}
      />
    </FieldShell>
  );
}
