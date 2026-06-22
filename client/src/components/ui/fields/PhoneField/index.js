import React from "react";
import TextField from "../TextField";

/**
 * PhoneField — на основе TextField. type="tel". Без маски в v1B и без
 * изменения формата payload. Валидация остаётся снаружи.
 */
export default function PhoneField({
  inputMode = "tel",
  autoComplete = "tel",
  ...props
}) {
  return (
    <TextField type="tel" inputMode={inputMode} autoComplete={autoComplete} {...props} />
  );
}
