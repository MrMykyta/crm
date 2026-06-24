import React from "react";
import DatePickerField from "../DatePickerField";

/**
 * DateField — обёртка над существующим components/inputs/DateTimePicker (date-only).
 * DateTimePicker НЕ переписывается. Наружу уходит та же local-naive строка
 * (YYYY-MM-DD), что и сейчас — никаких Date objects и timezone-конвертаций.
 *
 * onChange contract: нативного DOM-события нет → onChange(value, null).
 */
export default function DateField(props) {
  return <DatePickerField {...props} withTime={false} allowTimeToggle={false} />;
}
