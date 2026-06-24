import React from "react";
import TimePickerField from "../TimePickerField";

/**
 * TimeField — back-compat wrapper over custom TimePickerField.
 * Эмитит строку "HH:mm". dual-mode onChange наследуется от TextField:
 *   onValueChange?.(value)
 *   onChange?.(value, null)
 */
export default function TimeField(props) {
  return <TimePickerField {...props} />;
}
