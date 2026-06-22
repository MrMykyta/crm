import React from "react";
import FieldShell from "../FieldShell";
import MultiSelectDropdown from "../../../inputs/MultiSelectDropdown";
import s from "../fields.module.css";

/**
 * MultiSelectField — тонкая обёртка над components/inputs/MultiSelectDropdown.
 * Сам MultiSelectDropdown не меняется: портал, фильтр, select-all и UX остаются прежними.
 *
 * Value rules:
 * - multi mode: value string[] -> emits string[]
 * - single mode: value string -> internally [value], emits string
 *
 * IDs всегда остаются строками. undefined наружу не эмитится.
 */
export default function MultiSelectField({
  name,
  id,
  label,
  value,
  options = [],
  placeholder = "",
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
  clearable = false,
  filterable = true,
  single = false,
  maxPreview = 3,
  onOpenChange,
  onChange,
  onValueChange,
  onBlur,
  float = false,
  isFilled,
  isFocused = false,
  showCounter = false,
  currentLength,
  maxLength,
  counterMaxLength,
  ...rest
}) {
  const fieldId = id || name;

  const selected = React.useMemo(() => {
    if (single) {
      if (Array.isArray(value)) return value[0] ? [String(value[0])] : [];
      if (value === undefined || value === null || value === "") return [];
      return [String(value)];
    }
    return Array.isArray(value) ? value.map(String) : [];
  }, [value, single]);

  const filled = isFilled ?? selected.length > 0;
  const inactive = disabled || readOnly || loading;

  const emit = (nextArray) => {
    const safeArray = Array.isArray(nextArray) ? nextArray.map(String) : [];
    const nextValue = single ? safeArray[0] || "" : safeArray;
    onValueChange?.(nextValue);
    onChange?.(nextValue, null);
  };

  const clearControl =
    clearable && filled ? (
      <button
        type="button"
        className={s.clearBtn}
        onClick={() => emit([])}
        aria-label="Clear"
        disabled={inactive}
      >
        ✕
      </button>
    ) : null;

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
      rightIcon={clearControl}
      float={float}
      isFilled={filled}
      isFocused={isFocused}
      showCounter={showCounter}
      currentLength={currentLength ?? selected.length}
      maxLength={counterMaxLength ?? maxLength}
      className={className}
    >
      <div onBlur={onBlur}>
        <MultiSelectDropdown
          options={options}
          value={selected}
          onChange={emit}
          placeholder={placeholder}
          maxPreview={maxPreview}
          disabled={inactive}
          filterable={filterable}
          single={single}
          onOpenChange={onOpenChange}
          className={inputClassName}
          {...rest}
        />
      </div>
    </FieldShell>
  );
}
