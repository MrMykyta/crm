import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import FieldShell from "../FieldShell";
import { cx } from "../fieldUtils";
import s from "./TimePickerField.module.css";

function pad2(value) {
  return String(value).padStart(2, "0");
}

function parseTime(value) {
  const text = String(value || "").trim();
  if (!/^\d{2}:\d{2}$/.test(text)) return null;
  const [hours, minutes] = text.split(":").map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatTime(minutes) {
  const safe = Math.max(0, Math.min(1439, Number(minutes) || 0));
  return `${pad2(Math.floor(safe / 60))}:${pad2(safe % 60)}`;
}

function buildOptions(step) {
  const size = Math.max(1, Math.min(720, Number(step) || 60));
  const options = [];
  for (let minute = 0; minute < 24 * 60; minute += size) {
    options.push(formatTime(minute));
  }
  return options;
}

export default function TimePickerField({
  name,
  id,
  label,
  value,
  onChange,
  onValueChange,
  placeholder = "HH:mm",
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
  step = 60,
  min,
  max,
  use24h = true,
  ...rest
}) {
  const fieldId = id || name;
  const wrapRef = useRef(null);
  const popoverId = useRef(`time-menu-${Math.random().toString(36).slice(2)}`);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const options = useMemo(() => buildOptions(step), [step]);
  const selected = value === undefined || value === null ? "" : String(value);
  const minMinutes = useMemo(() => parseTime(min), [min]);
  const maxMinutes = useMemo(() => parseTime(max), [max]);

  const displayValue = useMemo(() => {
    if (!selected) return "";
    const minutes = parseTime(selected);
    if (minutes == null) return selected;
    return use24h ? formatTime(minutes) : selected;
  }, [selected, use24h]);

  const computePosition = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(240, Math.max(180, rect.width));
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < 280;
    setPos({
      left,
      width,
      top: placeAbove ? rect.top : rect.bottom,
      transform: placeAbove ? "translateY(calc(-100% - 8px))" : "translateY(8px)",
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    computePosition();

    const onDoc = (event) => {
      const popover = document.getElementById(popoverId.current);
      if (wrapRef.current?.contains(event.target) || popover?.contains(event.target)) return;
      setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onReposition = () => computePosition();

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [computePosition, open]);

  const emit = (next) => {
    onValueChange?.(next);
    onChange?.(next, null);
  };

  const isDisabledOption = (option) => {
    const minutes = parseTime(option);
    if (minutes == null) return true;
    if (minMinutes != null && minutes < minMinutes) return true;
    if (maxMinutes != null && minutes > maxMinutes) return true;
    return false;
  };

  const select = (option) => {
    if (isDisabledOption(option)) return;
    emit(option);
    setOpen(false);
  };

  const toggleOpen = () => {
    if (disabled || readOnly) return;
    setOpen((current) => !current);
  };

  const popover = open ? (
    <div
      id={popoverId.current}
      className={s.popover}
      role="listbox"
      style={{
        left: pos?.left || 0,
        top: pos?.top || 0,
        width: pos?.width || 240,
        transform: pos?.transform || "translateY(8px)",
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="option"
          aria-selected={selected === option}
          className={cx(s.option, selected === option && s.optionActive)}
          disabled={isDisabledOption(option)}
          onClick={() => select(option)}
        >
          {option}
        </button>
      ))}
    </div>
  ) : null;

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
      isFilled={isFilled ?? selected !== ""}
      isFocused={isFocused || open}
      className={className}
    >
      <div className={s.wrap} ref={wrapRef}>
        <button
          id={fieldId}
          name={name}
          type="button"
          className={cx(s.button, inputClassName)}
          disabled={disabled || readOnly}
          aria-haspopup="listbox"
          aria-expanded={open}
          onMouseDown={(event) => {
            event.preventDefault();
            toggleOpen();
          }}
          onClick={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if (disabled || readOnly) return;
            if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
            }
          }}
          {...rest}
        >
          {displayValue ? (
            <span>{displayValue}</span>
          ) : (
            <span className={s.placeholder}>{placeholder}</span>
          )}
        </button>
        <span className={s.icon} aria-hidden="true">◷</span>
        {open && popover ? createPortal(popover, document.body) : null}
      </div>
    </FieldShell>
  );
}
