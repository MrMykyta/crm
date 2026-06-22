import React from "react";
import FieldShell from "../FieldShell";
import s from "../fields.module.css";
import { cx, buildDescribedBy } from "../fieldUtils";

/**
 * RadioGroupField — grouped native radio field.
 *
 * Value stays string. No number coercion, no undefined emit.
 * onChange contract (dual-mode):
 *   onValueChange?.(value)
 *   onChange?.(value, event)
 *
 * `float` is accepted for API parity, but radio groups render as a normal labelled group.
 */
export default function RadioGroupField({
  name,
  id,
  label,
  value,
  options = [],
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
  layout = "vertical",
  inline = false,
  float: _float = false,
  ...rest
}) {
  const generatedId = React.useId();
  const fieldId = id || name || `radio-${generatedId.replace(/:/g, "")}`;
  const groupName = name || id || fieldId;
  const stringValue = value === undefined || value === null ? "" : String(value);
  const inactive = disabled || readOnly;

  const describedBy = buildDescribedBy(fieldId, {
    hasDescription: Boolean(description),
    hasHelper: Boolean(helperText) && !error,
    hasError: Boolean(error),
  });

  const emit = (nextValue, event) => {
    if (inactive) return;
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
      className={className}
    >
      <div
        id={fieldId}
        role="radiogroup"
        className={cx(s.radioGroup, (inline || layout === "horizontal") && s.radioGroupHorizontal)}
        aria-label={typeof label === "string" ? label : undefined}
        aria-required={required ? "true" : undefined}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        {...rest}
      >
        {(Array.isArray(options) ? options : []).map((option, index) => {
          const optionValue = option?.value === undefined || option?.value === null ? "" : String(option.value);
          const optionId = `${fieldId}-${index}`;
          const optionDescriptionId = option?.description ? `${optionId}-description` : undefined;
          const optionDisabled = disabled || Boolean(option?.disabled);

          return (
            <label
              key={`${optionValue}-${index}`}
              htmlFor={optionId}
              className={cx(s.radioOption, optionDisabled && s.radioOptionDisabled)}
            >
              <input
                id={optionId}
                name={groupName}
                type="radio"
                className={cx(s.radioInput, inputClassName)}
                value={optionValue}
                checked={stringValue === optionValue}
                onChange={(event) => {
                  if (optionDisabled || readOnly) return;
                  emit(optionValue, event);
                }}
                onBlur={onBlur}
                disabled={optionDisabled}
                readOnly={readOnly}
                required={required}
                aria-describedby={optionDescriptionId}
              />
              <span className={s.radioLabel}>{option?.label ?? optionValue}</span>
              {option?.description ? (
                <span id={optionDescriptionId} className={s.radioDescription}>
                  {option.description}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </FieldShell>
  );
}
