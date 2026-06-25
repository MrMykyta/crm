import React from "react";
import FieldShell from "../FieldShell";
import PriorityInput from "../../../inputs/PriorityInput";
import s from "../fields.module.css";
import { cx } from "../fieldUtils";

/**
 * PriorityField — тонкая обёртка над components/inputs/PriorityInput.
 * PriorityInput/NumericWithPresets не переписываются; value model сохраняется как есть.
 *
 * onChange contract (dual-mode):
 *   onValueChange?.(nextValue)
 *   onChange?.(nextValue, null)
 */
export default function PriorityField({
  name,
  id,
  label,
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
  float = false,
  placeholder,
  min,
  max,
  ...rest
}) {
  const fieldId = id || name;
  const inactive = disabled || readOnly;
  const isFilled = value !== undefined && value !== null && value !== "";

  const emit = (nextValue) => {
    if (inactive || nextValue === undefined) return;
    onValueChange?.(nextValue);
    onChange?.(nextValue, null);
  };

  const priorityProps = {
    ...rest,
    ...(min !== undefined ? { min } : null),
    ...(max !== undefined ? { max } : null),
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
      fullWidth={fullWidth}
      size={size}
      float={float}
      isFilled={isFilled}
      className={cx(s.priorityField, className)}
    >
      <div onBlur={onBlur}>
        <PriorityInput
          value={value ?? ""}
          onChange={emit}
          disabled={inactive}
          placeholder={placeholder}
          size={size === "lg" ? "md" : size}
          className={cx(s.priorityControl, inputClassName)}
          {...priorityProps}
        />
      </div>
    </FieldShell>
  );
}
