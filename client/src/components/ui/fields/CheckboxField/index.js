import React from "react";
import FieldShell from "../FieldShell";
import { cx, buildDescribedBy } from "../fieldUtils";

/**
 * CheckboxField — булевый чекбокс с лейблом справа.
 *
 * Эмитит boolean.
 * onChange contract (dual-mode):
 *   onValueChange?.(checked)
 *   onChange?.(checked, event)
 *
 * checked имеет приоритет; если не задан — берётся value как fallback.
 */
export default function CheckboxField({
  name,
  id,
  label,
  checked,
  value,
  onChange,
  onValueChange,
  onBlur,
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
  ...rest
}) {
  const fieldId = id || name;
  const isChecked = checked !== undefined ? Boolean(checked) : Boolean(value);

  const handleChange = (event) => {
    if (readOnly) return;
    const next = event.target.checked;
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
      className={className}
      inlineLabel
    >
      <input
        id={fieldId}
        name={name}
        type="checkbox"
        className={cx(inputClassName)}
        checked={isChecked}
        onChange={handleChange}
        onBlur={onBlur}
        disabled={disabled}
        required={required}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
    </FieldShell>
  );
}
