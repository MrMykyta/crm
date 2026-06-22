import React from "react";
import FieldShell from "../FieldShell";
import s from "../fields.module.css";
import { cx, toInputValue, buildDescribedBy } from "../fieldUtils";

/**
 * TextareaField — многострочный input.
 *
 * onChange contract (dual-mode):
 *   onValueChange?.(value)
 *   onChange?.(value, event)
 *
 * autoResize — простая безопасная реализация: при изменении подгоняет
 * высоту под scrollHeight. По умолчанию выключено.
 */
export default function TextareaField({
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
  loading = false,
  rows = 4,
  maxLength,
  showCounter = false,
  autoResize = false,
  ...rest
}) {
  const fieldId = id || name;
  const strValue = toInputValue(value);
  const ref = React.useRef(null);

  const resize = React.useCallback(() => {
    if (!autoResize || !ref.current) return;
    const el = ref.current;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [autoResize]);

  React.useEffect(() => {
    resize();
  }, [strValue, resize]);

  const handleChange = (event) => {
    const nextValue = event.target.value;
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
      showCounter={showCounter}
      currentLength={strValue.length}
      maxLength={maxLength}
      className={className}
    >
      <textarea
        id={fieldId}
        ref={ref}
        name={name}
        className={cx(s.input, inputClassName)}
        value={strValue}
        onChange={handleChange}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        rows={rows}
        maxLength={maxLength}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
    </FieldShell>
  );
}
