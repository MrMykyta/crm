import React from "react";
import TextField from "../TextField";

/**
 * EmailField — на основе TextField. type="email". Внутри ничего не валидирует —
 * валидация остаётся снаружи (Yup/Formik/ручная).
 */
export default function EmailField({
  inputMode = "email",
  autoComplete = "email",
  ...props
}) {
  return (
    <TextField type="email" inputMode={inputMode} autoComplete={autoComplete} {...props} />
  );
}
