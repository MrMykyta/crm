import React from "react";
import s from "../fields.module.css";
import { cx, getFieldIds } from "../fieldUtils";

/**
 * FieldShell — оболочка поля. Отвечает ТОЛЬКО за презентацию:
 * label, required marker, description, helperText, error, counter,
 * left/right icon layout, disabled/loading visual, fullWidth, size,
 * aria-describedby. Никакой бизнес-логики.
 *
 * Контрол передаётся через children. Состояния (size/invalid/icon padding)
 * применяются к вложенным input/textarea/select через descendant-классы
 * на корне (см. fields.module.css).
 */
export default function FieldShell({
  id,
  label,
  required = false,
  description,
  helperText,
  error,
  disabled = false,
  loading = false,
  readOnly = false,
  fullWidth = true,
  size = "md",
  leftIcon = null,
  rightIcon = null,
  showCounter = false,
  currentLength = 0,
  maxLength,
  inlineLabel = false,
  className = "",
  children,
}) {
  const ids = getFieldIds(id);
  const hasError = Boolean(error);
  const errorText = typeof error === "string" ? error : hasError ? String(error) : "";
  const hasHelper = Boolean(helperText) && !hasError;
  const hasDescription = Boolean(description);
  const counterText =
    showCounter && Number.isFinite(maxLength) ? `${currentLength} / ${maxLength}` : null;

  const rootClass = cx(
    s.field,
    fullWidth && s.fullWidth,
    hasError && s.invalid,
    leftIcon && s.hasLeftIcon,
    rightIcon && s.hasRightIcon,
    className
  );

  const labelNode = label ? (
    <span className={s.label}>
      {label}
      {required ? (
        <span className={s.req} aria-hidden="true">
          *
        </span>
      ) : null}
    </span>
  ) : null;

  const rightAdornment = loading ? (
    <span className={s.spinner} role="status" aria-hidden="true" />
  ) : (
    rightIcon
  );

  return (
    <div
      className={rootClass}
      data-size={size}
      data-disabled={disabled ? "true" : undefined}
      data-readonly={readOnly ? "true" : undefined}
      data-loading={loading ? "true" : undefined}
    >
      {/* inline label (checkbox/radio) — лейбл оборачивает контрол */}
      {inlineLabel ? (
        <label className={s.checkboxLine} htmlFor={ids.controlId}>
          {children}
          {label ? (
            <span>
              {label}
              {required ? (
                <span className={s.req} aria-hidden="true">
                  {" *"}
                </span>
              ) : null}
            </span>
          ) : null}
        </label>
      ) : (
        <>
          {label ? (
            <label className={s.labelRow} htmlFor={ids.controlId}>
              {labelNode}
            </label>
          ) : null}

          {hasDescription ? (
            <div id={ids.descriptionId} className={s.description}>
              {description}
            </div>
          ) : null}

          <div className={s.controlWrap}>
            {leftIcon ? (
              <span className={s.adornLeft} aria-hidden="true">
                {leftIcon}
              </span>
            ) : null}
            {children}
            {rightAdornment ? (
              <span className={s.adornRight}>{rightAdornment}</span>
            ) : null}
          </div>
        </>
      )}

      {(hasError || hasHelper || counterText) && (
        <div className={s.helpRow}>
          {hasError ? (
            <span id={ids.errorId} className={s.error} role="alert">
              {errorText}
            </span>
          ) : hasHelper ? (
            <span id={ids.helperId} className={s.helper}>
              {helperText}
            </span>
          ) : (
            <span />
          )}
          {counterText ? <span className={s.counter}>{counterText}</span> : null}
        </div>
      )}
    </div>
  );
}
