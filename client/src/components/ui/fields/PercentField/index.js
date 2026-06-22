import React from "react";
import NumberField from "../NumberField";
import s from "../fields.module.css";

/**
 * PercentField — на основе NumberField с суффиксом "%".
 * min/max по умолчанию 0/100 (переопределяемо). default emitAs="string".
 * payload type не меняется, насильного округления нет.
 */
export default function PercentField({
  min = 0,
  max = 100,
  emitAs = "string",
  suffix = "%",
  ...props
}) {
  return (
    <NumberField
      emitAs={emitAs}
      min={min}
      max={max}
      rightIcon={<span className={s.affix}>{suffix}</span>}
      {...props}
    />
  );
}
