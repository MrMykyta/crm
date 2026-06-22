import React from "react";
import FieldShell from "../FieldShell";
import s from "../fields.module.css";
import { cx, toInputValue, buildDescribedBy } from "../fieldUtils";

const SliderField = React.forwardRef(function SliderField({
  name,
  id,
  label,
  value,
  min,
  max,
  step,
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
  leftIcon = null,
  rightIcon = null,
  showValue = false,
  formatValue,
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

  const displayValue =
    typeof formatValue === "function" ? formatValue(strValue) : strValue;

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
      leftIcon={leftIcon}
      rightIcon={rightIcon}
      isFilled={strValue !== ""}
      className={className}
    >
      <div className={s.sliderControl}>
        <input
          ref={ref}
          id={fieldId}
          name={name}
          type="range"
          className={cx(s.sliderInput, inputClassName)}
          value={strValue}
          min={min}
          max={max}
          step={step}
          onChange={handleChange}
          onBlur={onBlur}
          disabled={isDisabled}
          required={required}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {showValue ? <span className={s.sliderValue}>{displayValue}</span> : null}
      </div>
    </FieldShell>
  );
});

export default SliderField;
