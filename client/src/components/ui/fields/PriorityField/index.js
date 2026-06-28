import SelectField from "../SelectField";
import { PRIORITY_LEVELS, normalizePriority, snapPriority } from "../../../../config/priority";

const PRIORITY_SELECT_OPTIONS = PRIORITY_LEVELS.map((level) => ({
  value: level,
  label: String(level),
}));

/**
 * PriorityField — numeric priority select over canonical values.
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
  disabled = false,
  readOnly = false,
  required = false,
  error,
  helperText,
  description,
  className = "",
  inputClassName = "",
  contentClassName = "",
  fullWidth = true,
  size = "md",
  float = false,
  placeholder,
  ...rest
}) {
  const normalizedValue = normalizePriority(value);

  const emit = (nextValue) => {
    const normalized = snapPriority(nextValue);
    onValueChange?.(normalized);
    onChange?.(normalized, null);
  };

  return (
    <SelectField
      id={id}
      name={name}
      label={label}
      value={normalizedValue}
      options={PRIORITY_SELECT_OPTIONS}
      onValueChange={emit}
      placeholder={placeholder || "50"}
      disabled={disabled}
      readOnly={readOnly}
      required={required}
      error={error}
      helperText={helperText}
      description={description}
      className={className}
      inputClassName={inputClassName}
      contentClassName={contentClassName}
      fullWidth={fullWidth}
      size={size}
      float={float}
      valueType="number"
      searchable={false}
      {...rest}
    />
  );
}
