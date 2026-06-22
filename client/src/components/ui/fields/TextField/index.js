import React from "react";
import FieldShell from "../FieldShell";
import s from "../fields.module.css";
import { cx, toInputValue, buildDescribedBy } from "../fieldUtils";

/**
 * TextField — текстовый input (по умолчанию type="text").
 * type можно переопределить, чтобы позже строить EmailField/PasswordField и т.п.
 *
 * onChange contract (dual-mode):
 *   onValueChange?.(value)
 *   onChange?.(value, event)
 *
 * value === undefined/null безопасно приводится к "".
 */
export default function TextField({
  name,
  id,
  type = "text",
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
  maxLength,
  showCounter = false,
  transform,
  upper = false,
  autoComplete,
  inputMode,
  ...rest
}) {
  const fieldId = id || name;
  const strValue = toInputValue(value);

  const applyTransform = (raw) => {
    let next = raw;
    if (upper) next = next.toUpperCase();
    if (typeof transform === "function") next = transform(next);
    return next;
  };

  const handleChange = (event) => {
    const nextValue = applyTransform(event.target.value);
    onValueChange?.(nextValue);
    onChange?.(nextValue, event);
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
      showCounter={showCounter}
      currentLength={strValue.length}
      maxLength={maxLength}
      className={className}
    >
      <input
        id={fieldId}
        name={name}
        type={type}
        className={cx(s.input, inputClassName)}
        value={strValue}
        onChange={handleChange}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        maxLength={maxLength}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
    </FieldShell>
  );
}
