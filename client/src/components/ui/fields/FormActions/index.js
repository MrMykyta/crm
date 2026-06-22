import React from "react";
import s from "../fields.module.css";
import { cx } from "../fieldUtils";

/**
 * FormActions — единый блок кнопок формы.
 * Использует существующие глобальные классы кнопок (.btn--primary из styles/forms.css)
 * + безопасные module-стили для раскладки. Общий Button-компонент НЕ создаётся.
 *
 * align: "left" | "right" | "space-between"
 */
export default function FormActions({
  submitLabel = "Save",
  submittingLabel,
  cancelLabel = "Cancel",
  onSubmit,
  onCancel,
  isSubmitting = false,
  loading = false,
  disabled = false,
  submitDisabled = false,
  cancelDisabled = false,
  showCancel = true,
  align = "right",
  submitType = "submit",
  className = "",
  children,
}) {
  const busy = Boolean(isSubmitting || loading);
  const alignClass =
    align === "left" ? s.alignLeft : align === "space-between" ? s.alignBetween : s.alignRight;

  return (
    <div className={cx(s.actions, alignClass, className)}>
      {showCancel ? (
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled || cancelDisabled || busy}
        >
          {cancelLabel}
        </button>
      ) : null}

      {children}

      <button
        type={submitType}
        className="btn--primary"
        onClick={onSubmit}
        disabled={disabled || submitDisabled || busy}
      >
        {busy && submittingLabel ? submittingLabel : submitLabel}
      </button>
    </div>
  );
}
