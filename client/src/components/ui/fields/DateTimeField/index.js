import React from "react";
import DatePickerField from "../DatePickerField";

/**
 * DateTimeField — обёртка над components/inputs/DateTimePicker (withTime).
 * DateTimePicker НЕ переписывается. Наружу — та же local-naive строка
 * (YYYY-MM-DDTHH:mm), без timezone-конвертаций и без Date objects.
 *
 * allowTimeToggle поддерживается нативным компонентом (onWithTimeChange).
 * onChange contract: onChange(value, null).
 */
export default function DateTimeField({ withTime = true, ...props }) {
  return <DatePickerField {...props} withTime={withTime} />;
}
