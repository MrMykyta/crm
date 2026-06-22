import React from "react";
import TextField from "../TextField";
import s from "../fields.module.css";

/**
 * SearchField — TextField preset for search inputs.
 *
 * No debounce by default: consumers keep their existing debounce/query behavior.
 */
export default function SearchField({
  value,
  onChange,
  onValueChange,
  clearable = false,
  loading = false,
  disabled = false,
  readOnly = false,
  onClear,
  searchIcon = null,
  rightIcon,
  ...rest
}) {
  const stringValue = value === undefined || value === null ? "" : String(value);

  const emitClear = () => {
    if (disabled || readOnly) return;
    onValueChange?.("");
    onChange?.("", null);
    onClear?.();
  };

  const clearControl =
    clearable && stringValue ? (
      <button
        type="button"
        className={s.clearBtn}
        onClick={emitClear}
        aria-label="Clear search"
        disabled={disabled || readOnly}
      >
        ✕
      </button>
    ) : (
      rightIcon
    );

  return (
    <TextField
      {...rest}
      type="search"
      value={stringValue}
      onChange={onChange}
      onValueChange={onValueChange}
      loading={loading}
      disabled={disabled}
      readOnly={readOnly}
      leftIcon={searchIcon}
      rightIcon={clearControl}
    />
  );
}
