import React from "react";
import NumberField from "../NumberField";
import s from "../fields.module.css";

/**
 * CurrencyField — на основе NumberField. Показывает валюту через prefix/suffix.
 *
 * Правила payload:
 *  - default emitAs="string" → payload остаётся строковым.
 *  - пустое значение НЕ превращается в 0 (наследуется от NumberField).
 *  - precision НЕ задан → насильного округления нет.
 *  - precision задан → округление применяется только на blur.
 */
export default function CurrencyField({
  prefix,
  suffix,
  currency,
  precision,
  step,
  emitAs = "string",
  onChange,
  onValueChange,
  onBlur,
  ...props
}) {
  const hasPrecision = precision !== undefined && precision !== null && Number.isFinite(Number(precision));

  const left = prefix ?? (currency ? <span className={s.affix}>{currency}</span> : null);
  const right = suffix ? <span className={s.affix}>{suffix}</span> : null;

  const handleBlur = (event) => {
    if (hasPrecision) {
      const raw = event?.target?.value ?? "";
      if (raw !== "") {
        const num = Number(raw);
        if (!Number.isNaN(num)) {
          const fixed = num.toFixed(Number(precision));
          const out = emitAs === "number" ? Number(fixed) : fixed;
          onValueChange?.(out);
          onChange?.(out, event);
        }
      }
    }
    onBlur?.(event);
  };

  const resolvedStep = step ?? (hasPrecision ? Math.pow(10, -Number(precision)) : undefined);

  return (
    <NumberField
      emitAs={emitAs}
      leftIcon={left}
      rightIcon={right}
      step={resolvedStep}
      onChange={onChange}
      onValueChange={onValueChange}
      onBlur={handleBlur}
      {...props}
    />
  );
}
