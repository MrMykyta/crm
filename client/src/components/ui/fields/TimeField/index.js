import React from "react";
import TextField from "../TextField";

/**
 * TimeField — простой input type="time" поверх TextField (→ FieldShell).
 * Эмитит строку "HH:mm". dual-mode onChange наследуется от TextField:
 *   onValueChange?.(value)
 *   onChange?.(value, event)
 */
export default function TimeField(props) {
  return <TextField type="time" {...props} />;
}
