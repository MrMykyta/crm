import React from "react";
import FieldShell from "../FieldShell";
import AutocompleteSelect from "../../../shared/AutocompleteSelect";
import s from "../fields.module.css";

/**
 * AutocompleteField — БЕЗОПАСНАЯ обёртка над существующим
 * components/shared/AutocompleteSelect. Сам AutocompleteSelect не меняется:
 * портал, позиционирование, create/edit/delete actions и UX остаются прежними.
 *
 * Задача обёртки — подключить AutocompleteSelect к FieldShell и единому API.
 *
 * Контракт AutocompleteSelect остаётся фактическим:
 *  - value: выбранный объект ({ id, name } по умолчанию)
 *  - inputValue / onInputChange: текст поиска (controlled)
 *  - options: массив опций
 *  - onSelect(opt): выбор опции
 * Дополнительно обёртка эмитит единый value:
 *   onValueChange?.(optionValue)
 *   onChange?.(optionValue, opt)
 *
 * Любые дополнительные нативные props (showCreateAction, createActionLabel,
 * createActionLoading, can/deletingOptionKey, hint, opaque и т.д.) пробрасываются
 * через ...rest без изменений.
 */
export default function AutocompleteField({
  name,
  id,
  label,
  value = null,
  inputValue = "",
  onInputChange,
  options = [],
  onSelect,
  onChange,
  onValueChange,
  placeholder,
  disabled = false,
  readOnly = false,
  required = false,
  loading = false,
  error,
  helperText,
  description,
  className = "",
  inputClassName = "",
  fullWidth = true,
  size = "md",
  float = false,
  isFilled,
  isFocused = false,
  clearable = false,
  // алиасы единого API → нативный контракт AutocompleteSelect
  getOptionLabel,
  getOptionValue,
  onCreateOption,
  onEditOption,
  onDeleteOption,
  ...rest
}) {
  const fieldId = id || name;

  // дефолты совместимы с AutocompleteSelect (id ?? value ?? key ?? name / label ?? name)
  const optKey = getOptionValue || ((o) => o?.id ?? o?.value ?? o?.key ?? o?.name);
  const optPrimary = getOptionLabel || ((o) => o?.label ?? o?.name ?? String(optKey(o) ?? ""));

  const handleSelect = (opt) => {
    onSelect?.(opt);
    const val = opt ? optKey(opt) : null;
    onValueChange?.(val);
    onChange?.(val, opt);
  };

  const handleClear = () => {
    onInputChange?.("");
    onValueChange?.(null);
    onChange?.(null, null);
  };

  const hasDisplayValue = Boolean(value || String(inputValue || "").trim());
  const clearControl =
    clearable && hasDisplayValue ? (
      <button
        type="button"
        className={s.clearBtn}
        onClick={handleClear}
        aria-label="Clear"
        disabled={disabled || readOnly}
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
      isFilled={isFilled ?? hasDisplayValue}
      isFocused={isFocused}
      className={className}
    >
      <AutocompleteSelect
        value={value}
        inputValue={inputValue}
        onInputChange={onInputChange}
        options={options}
        onSelect={handleSelect}
        placeholder={placeholder}
        loading={loading}
        disabled={disabled || readOnly}
        inputClassName={inputClassName}
        getOptionKey={optKey}
        getOptionPrimary={optPrimary}
        onEditOption={onEditOption}
        onDeleteOption={onDeleteOption}
        onCreateAction={onCreateOption}
        {...rest}
      />
    </FieldShell>
  );
}
