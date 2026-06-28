import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { TextField, TimePickerField } from "../../ui/fields";
import styles from "./QuickCreateTaskPopover.module.css";

const TIME_STEP_MINUTES = 15;
const POPOVER_WIDTH = 440;
const POPOVER_GAP = 10;

function pad2(value) {
  return String(value).padStart(2, "0");
}

function localDateValue(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function localTimeValue(date = new Date()) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function parseDateOnly(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [year, month, day] = text.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function combineLocalDateTime(dateValue, timeValue) {
  const date = parseDateOnly(dateValue);
  const [hours, minutes] = String(timeValue || "").split(":").map(Number);
  if (!date || !Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function roundUpTime(date = new Date(), step = TIME_STEP_MINUTES) {
  const next = new Date(date);
  next.setSeconds(0, 0);
  const minutes = next.getMinutes();
  const rounded = Math.ceil(minutes / step) * step;
  if (rounded >= 60) {
    next.setHours(next.getHours() + 1, 0, 0, 0);
  } else {
    next.setMinutes(rounded, 0, 0);
  }
  return next;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function normalizeTime(value, fallback) {
  return /^\d{2}:\d{2}$/.test(String(value || "")) ? String(value) : fallback;
}

function isBeforeToday(dateValue) {
  const date = parseDateOnly(dateValue);
  const today = parseDateOnly(localDateValue());
  return Boolean(date && today && date < today);
}

function buildPosition(anchorRect) {
  if (typeof window === "undefined") return {};
  const width = Math.min(POPOVER_WIDTH, Math.max(320, window.innerWidth - 24));
  if (!anchorRect) {
    return {
      left: Math.max(12, (window.innerWidth - width) / 2),
      top: Math.max(82, window.innerHeight * 0.18),
      width,
    };
  }
  const anchorCenter = anchorRect.left + anchorRect.width / 2;
  const left = Math.min(
    Math.max(12, anchorCenter - width / 2),
    Math.max(12, window.innerWidth - width - 12)
  );
  const topBelow = anchorRect.bottom + POPOVER_GAP;
  const topAbove = anchorRect.top - POPOVER_GAP;
  const spaceBelow = window.innerHeight - topBelow;
  return {
    left,
    top: spaceBelow < 360 ? Math.max(12, topAbove) : topBelow,
    width,
    transform: spaceBelow < 360 ? "translateY(-100%)" : "none",
  };
}

function buildInitialState(initialValue = {}) {
  const rounded = roundUpTime(addMinutes(new Date(), TIME_STEP_MINUTES));
  const defaultStart = normalizeTime(initialValue.startTime, localTimeValue(rounded));
  const defaultEnd = normalizeTime(
    initialValue.endTime,
    localTimeValue(addMinutes(combineLocalDateTime(initialValue.date || localDateValue(), defaultStart) || rounded, 60))
  );
  return {
    title: initialValue.title || "",
    isAllDay: initialValue.isAllDay !== false,
    startTime: defaultStart,
    endTime: defaultEnd,
  };
}

export default function QuickCreateTaskPopover({
  date,
  anchorRect,
  initialValue,
  locale,
  busy = false,
  onClose,
  onSubmit,
  onMoreOptions,
}) {
  const { t } = useTranslation();
  const cardRef = useRef(null);
  const titleRef = useRef(null);
  const [form, setForm] = useState(() => buildInitialState(initialValue));
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    setForm(buildInitialState(initialValue));
    setSubmitError("");
  }, [initialValue]);

  useEffect(() => {
    titleRef.current?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const position = useMemo(() => buildPosition(anchorRect), [anchorRect]);
  const dateLabel = useMemo(() => {
    const parsed = parseDateOnly(date);
    if (!parsed) return date || "";
    return parsed.toLocaleDateString(locale || undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }, [date, locale]);

  const scheduleErrorKey = useMemo(() => {
    if (!date) return "calendar.createTask.errors.dateRequired";
    if (form.isAllDay) return isBeforeToday(date) ? "calendar.createTask.errors.pastDate" : "";
    if (!form.startTime) return "calendar.createTask.errors.startTimeRequired";
    if (!form.endTime) return "calendar.createTask.errors.endTimeRequired";
    const start = combineLocalDateTime(date, form.startTime);
    const end = combineLocalDateTime(date, form.endTime);
    if (!start || !end) return "calendar.createTask.errors.invalidDateTime";
    if (end <= start) return "calendar.createTask.errors.endAfterStart";
    if (date === localDateValue() && start < new Date()) return "calendar.createTask.errors.pastDateTime";
    return "";
  }, [date, form.endTime, form.isAllDay, form.startTime]);

  const titleError = !form.title.trim() ? t("crm.task.detail.validation.titleRequired", "Title is required") : "";
  const canSubmit = Boolean(form.title.trim()) && !scheduleErrorKey && !busy;

  const updateTitle = (value) => {
    setSubmitError("");
    setForm((prev) => ({ ...prev, title: value }));
  };

  const setAllDay = (isAllDay) => {
    setSubmitError("");
    setForm((prev) => ({ ...prev, isAllDay }));
  };

  const selectTime = (field, value) => {
    setSubmitError("");
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "startTime") {
        const start = combineLocalDateTime(date, value);
        const end = combineLocalDateTime(date, prev.endTime);
        if (start && (!end || end <= start)) {
          next.endTime = localTimeValue(addMinutes(start, 60));
        }
      }
      return next;
    });
  };

  const buildPayload = () => {
    const payload = {
      title: form.title.trim(),
      description: "",
      status: "todo",
      priority: 50,
      visibility: "company",
      participantMode: "none",
      watcherMode: "none",
    };
    if (form.isAllDay) {
      payload.startAt = date;
      payload.endAt = date;
      payload.startAtHasTime = false;
      payload.endAtHasTime = false;
      return payload;
    }
    const start = combineLocalDateTime(date, form.startTime);
    const end = combineLocalDateTime(date, form.endTime);
    if (start) {
      payload.startAt = start.toISOString();
      payload.startAtHasTime = true;
    }
    if (end) {
      payload.endAt = end.toISOString();
      payload.endAtHasTime = true;
    }
    return payload;
  };

  const submit = async (event) => {
    event?.preventDefault();
    if (!canSubmit) return;
    setSubmitError("");
    try {
      await onSubmit?.(buildPayload());
    } catch (error) {
      setSubmitError(
        error?.data?.message
        || error?.data?.error
        || error?.error
        || error?.message
        || t("crm.task.messages.createFailed")
      );
    }
  };

  const moreOptions = () => {
    onMoreOptions?.({
      date,
      title: form.title,
      allDay: form.isAllDay,
      start: form.startTime,
      end: form.endTime,
    });
  };

  const minimumStartTime = date === localDateValue() ? localTimeValue(roundUpTime(new Date())) : undefined;
  const startDate = combineLocalDateTime(date, form.startTime);
  const minimumEndTime = startDate ? localTimeValue(addMinutes(startDate, TIME_STEP_MINUTES)) : undefined;
  const scheduleError = scheduleErrorKey ? t(scheduleErrorKey) : "";

  return createPortal(
    <div
      className={styles.layer}
      onMouseDown={(event) => {
        if (cardRef.current && !cardRef.current.contains(event.target)) onClose?.();
      }}
    >
      <form
        ref={cardRef}
        className={styles.card}
        style={{
          "--quick-left": `${position.left || 12}px`,
          "--quick-top": `${position.top || 80}px`,
          "--quick-width": `${position.width || POPOVER_WIDTH}px`,
          "--quick-transform": position.transform || "none",
        }}
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>{dateLabel}</span>
            <h2>{t("calendar.quickCreate.title", "New task")}</h2>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </header>

        <TextField
          name="quick-task-title"
          label={t("crm.task.fields.title")}
          value={form.title}
          onValueChange={updateTitle}
          placeholder={t("crm.task.placeholders.title")}
          required
          error={form.title ? "" : titleError}
          disabled={busy}
          inputRef={titleRef}
        />

        <div className={styles.modeGroup} role="group" aria-label={t("calendar.createTask.dateTime")}>
          <button
            type="button"
            className={`${styles.modeButton} ${form.isAllDay ? styles.modeButtonActive : ""}`}
            onClick={() => setAllDay(true)}
            disabled={busy}
          >
            {t("calendar.createTask.allDay")}
          </button>
          <button
            type="button"
            className={`${styles.modeButton} ${!form.isAllDay ? styles.modeButtonActive : ""}`}
            onClick={() => setAllDay(false)}
            disabled={busy}
          >
            {t("calendar.createTask.timed")}
          </button>
        </div>

        {!form.isAllDay ? (
          <div className={styles.timeGrid}>
            <TimePickerField
              label={t("calendar.createTask.start")}
              value={form.startTime}
              onValueChange={(value) => selectTime("startTime", value)}
              step={TIME_STEP_MINUTES}
              min={minimumStartTime}
              disabled={busy}
            />
            <TimePickerField
              label={t("calendar.createTask.end")}
              value={form.endTime}
              onValueChange={(value) => selectTime("endTime", value)}
              step={TIME_STEP_MINUTES}
              min={minimumEndTime}
              disabled={busy}
            />
          </div>
        ) : null}

        {scheduleError ? <div className={styles.error}>{scheduleError}</div> : null}
        {submitError ? <div className={styles.error}>{submitError}</div> : null}

        <footer className={styles.footer}>
          <button type="button" className={styles.moreButton} onClick={moreOptions} disabled={busy}>
            {t("calendar.quickCreate.moreOptions", "More options")} →
          </button>
          <button type="submit" className={styles.createButton} disabled={!canSubmit}>
            {busy ? t("common.creating") : t("crm.task.actions.create")}
          </button>
        </footer>
      </form>
    </div>,
    document.body
  );
}
