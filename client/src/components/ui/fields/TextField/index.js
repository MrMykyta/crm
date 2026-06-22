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
const TextField = React.forwardRef(function TextField({
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
  float = false,
  isFilled,
  isFocused = false,
  maxLength,
  counterMaxLength,
  showCounter = false,
  transform,
  upper = false,
  autoComplete,
  inputMode,
  inputRef,
  ...rest
}, ref) {
  const fieldId = id || name;
  const strValue = toInputValue(value);

  const setInputRef = React.useCallback(
    (node) => {
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }

      if (typeof inputRef === "function") {
        inputRef(node);
      } else if (inputRef) {
        inputRef.current = node;
      }
    },
    [ref, inputRef]
  );

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
      float={float}
      isFilled={isFilled ?? strValue !== ""}
      isFocused={isFocused}
      showCounter={showCounter}
      currentLength={strValue.length}
      maxLength={counterMaxLength ?? maxLength}
      className={className}
    >
      <input
        ref={setInputRef}
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
});

export default TextField;
