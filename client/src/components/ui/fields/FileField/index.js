import React from "react";
import FieldShell from "../FieldShell";
import s from "../fields.module.css";
import { cx, buildDescribedBy } from "../fieldUtils";

/**
 * FileField — базовый file input через FieldShell.
 *
 * ВАЖНО: file input НЕ контролируется (value не задаётся) — это требование
 * браузера (controlled file input недопустим). Выбор отдаётся через колбэки:
 *   onFilesChange?.(files, event)
 *   onValueChange?.(files)
 *   onChange?.(files, event)
 * где files — это FileList из event.target.files.
 *
 * Существующий ImagePicker в этой фазе НЕ трогаем (будущий ImageField — см. docs).
 */
export default function FileField({
  name,
  id,
  label,
  accept,
  multiple = false,
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
  onFilesChange,
  onValueChange,
  onChange,
  onBlur,
  ...rest
}) {
  const fieldId = id || name;

  const handleChange = (event) => {
    const files = event.target.files;
    onFilesChange?.(files, event);
    onValueChange?.(files);
    onChange?.(files, event);
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
    >
      <input
        id={fieldId}
        name={name}
        type="file"
        className={cx(s.fileInput, inputClassName)}
        accept={accept}
        multiple={multiple}
        // file input нельзя делать readOnly — трактуем как disabled
        disabled={disabled || readOnly}
        required={required}
        onChange={handleChange}
        onBlur={onBlur}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
    </FieldShell>
  );
}
