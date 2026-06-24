import React from "react";
import { useTranslation } from "react-i18next";
import FieldShell from "../FieldShell";
import DateTimePicker from "../../../inputs/DateTimePicker";
import { cx } from "../fieldUtils";

function getLocale(language = "en") {
  const normalized = String(language || "en").toLowerCase();
  if (normalized.startsWith("ua") || normalized.startsWith("uk")) return "uk-UA";
  if (normalized.startsWith("ru")) return "ru-RU";
  if (normalized.startsWith("pl")) return "pl-PL";
  return "en-US";
}

export default function DatePickerField({
  name,
  id,
  label,
  value,
  onChange,
  onValueChange,
  placeholder,
  disabled = false,
  readOnly = false,
  required = false,
  error,
  helperText,
  description,
  className = "",
  inputClassName = "",
  fullWidth = true,
  size = "md",
  loading = false,
  float = false,
  isFilled,
  isFocused = false,
  withTime = false,
  allowTimeToggle = false,
  onWithTimeChange,
  timeToggleLabel,
  locale,
  min,
  max,
  isDateDisabled,
  presets,
  ...rest
}) {
  const { t, i18n } = useTranslation();
  const fieldId = id || name;
  const resolvedLocale = locale || getLocale(i18n.resolvedLanguage || i18n.language);

  const emit = (next) => {
    onValueChange?.(next);
    onChange?.(next, null);
  };

  return (
    <FieldShell
      id={fieldId}
      label={label}
      required={required}
      description={description}
      helperText={helperText}
      error={error}
      disabled={disabled}
      readOnly={readOnly}
      loading={loading}
      fullWidth={fullWidth}
      size={size}
      float={float}
      isFilled={isFilled ?? (value !== undefined && value !== null && String(value) !== "")}
      isFocused={isFocused}
      className={className}
    >
      <DateTimePicker
        id={fieldId}
        value={value === undefined || value === null ? "" : String(value)}
        withTime={withTime}
        allowTimeToggle={allowTimeToggle}
        onWithTimeChange={onWithTimeChange}
        onChange={emit}
        disabled={disabled || readOnly}
        placeholder={placeholder}
        className={cx(inputClassName)}
        locale={resolvedLocale}
        min={min}
        max={max}
        isDateDisabled={isDateDisabled}
        presets={presets}
        timeToggleLabel={timeToggleLabel || t("fields.dateTime.withTime")}
        timeLabel={t("fields.dateTime.time")}
        todayLabel={t("fields.dateTime.today")}
        clearLabel={t("fields.dateTime.clear")}
        previousMonthLabel={t("fields.dateTime.previousMonth")}
        nextMonthLabel={t("fields.dateTime.nextMonth")}
        openCalendarLabel={t("fields.dateTime.openCalendar")}
        {...rest}
      />
    </FieldShell>
  );
}
