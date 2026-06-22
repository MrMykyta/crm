import React from "react";
import FieldShell from "../FieldShell";
import s from "../fields.module.css";
import { cx, toInputValue, buildDescribedBy } from "../fieldUtils";

const ColorField = React.forwardRef(function ColorField({
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
  ...rest
}, ref) {
  const fieldId = id || name;
  const strValue = toInputValue(value);
  const isDisabled = disabled || readOnly;
  const describedBy = buildDescribedBy(fieldId, {
    hasDescription: Boolean(description),
    hasHelper: Boolean(helperText) && !error,
    hasError: Boolean(error),
  });

  const handleChange = (event) => {
    const nextValue = event.target.value;
    onValueChange?.(nextValue);
    onChange?.(nextValue, event);
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
      isFilled={strValue !== ""}
      className={className}
    >
      <input
        ref={ref}
        id={fieldId}
        name={name}
        type="color"
        className={cx(s.colorInput, inputClassName)}
        value={strValue}
        onChange={handleChange}
        onBlur={onBlur}
        disabled={isDisabled}
        required={required}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
    </FieldShell>
  );
});

export default ColorField;
