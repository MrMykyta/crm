import React from "react";
import TextField from "../TextField";

/**
 * UrlField — на основе TextField. type="url". Внутри не валидирует.
 */
export default function UrlField({
  inputMode = "url",
  autoComplete = "url",
  ...props
}) {
  return (
    <TextField type="url" inputMode={inputMode} autoComplete={autoComplete} {...props} />
  );
}
