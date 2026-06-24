import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../../Modal";
import s from "../../../pages/styles/CrmUsers.module.css";
import dt from "./CreateTaskModal.module.css";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "../../../config/taskOptions";
import { useListCompanyUsersQuery } from "../../../store/rtk/companyUsersApi";
import {
  DatePickerField,
  SelectField,
  TextField,
  TextareaField,
  TimePickerField,
} from "../../ui/fields";

const TIME_STEP_MINUTES = 15;

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
  if (!text) return null;
  let parts = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    parts = text.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  }
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
    const [day, month, year] = text.split(".").map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function parseDateTime(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function splitDateTime(value) {
  const parsed = parseDateTime(value);
  if (!parsed) return { date: "", time: "" };
  return { date: localDateValue(parsed), time: localTimeValue(parsed) };
}

function combineLocalDateTime(dateValue, timeValue) {
  const date = parseDateOnly(dateValue);
  const [hours, minutes] = String(timeValue || "").split(":").map(Number);
  if (!date || !Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function isSameDate(a, b) {
  return Boolean(a && b)
    && a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function isBeforeToday(date) {
  const today = parseDateOnly(localDateValue());
  const day = parseDateOnly(localDateValue(date));
  return Boolean(day && today && day < today);
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

function buildInitialSchedule(initialValues = {}, defaultDate = "") {
  const start = splitDateTime(initialValues.startAt);
  const end = splitDateTime(initialValues.endAt);
  const eventDate = initialValues.eventDate || initialValues.dueDate || defaultDate || start.date || end.date || "";
  const defaultStart = roundUpTime(new Date(Date.now() + TIME_STEP_MINUTES * 60 * 1000));
  const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000);
  return {
    eventDate,
    startTime: initialValues.startTime || start.time || localTimeValue(defaultStart),
    endTime: initialValues.endTime || end.time || localTimeValue(defaultEnd),
  };
}

function buildInitialForm(initialValues = {}) {
  const defaultDate = initialValues.defaultDate || initialValues.eventDate || initialValues.dueDate || "";
  const schedule = buildInitialSchedule(initialValues, defaultDate);
  return {
    title: initialValues.title || "",
    description: initialValues.description || "",
    status: initialValues.status || "todo",
    priority: initialValues.priority ?? 3,
    dueDate: initialValues.dueDate || defaultDate,
    assigneeId: initialValues.assigneeId || "",
    counterpartyId: initialValues.counterpartyId || "",
    dealId: initialValues.dealId || "",
    planOpen: Boolean(initialValues.planOpen || defaultDate),
    isAllDay: initialValues.isAllDay ?? Boolean(defaultDate),
    eventDate: schedule.eventDate,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    startAt: initialValues.startAt || "",
    endAt: initialValues.endAt || "",
  };
}

function getScheduleErrorKey(form) {
  if (!form.planOpen) return "";

  const today = parseDateOnly(localDateValue());
  const eventDate = parseDateOnly(form.eventDate);
  if (!eventDate) return "calendar.createTask.errors.dateRequired";

  if (form.isAllDay) {
    return eventDate < today ? "calendar.createTask.errors.pastDate" : "";
  }

  if (!form.startTime) return "calendar.createTask.errors.startTimeRequired";
  if (!form.endTime) return "calendar.createTask.errors.endTimeRequired";

  const start = combineLocalDateTime(form.eventDate, form.startTime);
  const end = combineLocalDateTime(form.eventDate, form.endTime);
  if (!start || !end) return "calendar.createTask.errors.invalidDateTime";
  if (end <= start) return "calendar.createTask.errors.endAfterStart";
  if (start < new Date()) return "calendar.createTask.errors.pastDateTime";
  return "";
}

// Компонент CreateTaskModal: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function CreateTaskModal({ onSubmit, onClose, currentUser, initialValues }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => buildInitialForm(initialValues));

  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [titleError, setTitleError] = useState("");
  const [scheduleErrorKey, setScheduleErrorKey] = useState(() => getScheduleErrorKey(buildInitialForm(initialValues)));
  const { data: usersData, isLoading: usersLoading } = useListCompanyUsersQuery({
    page: 1,
    limit: 100,
    sort: "lastName",
    dir: "ASC",
  });

    // change: вспомогательная логика компонента.
const change = (k, v) => {
    const next = { ...form, [k]: v };
    setForm(next);
    if (k === "title" && titleError && String(v || "").trim()) {
      setTitleError("");
    }
    if (["planOpen", "isAllDay", "eventDate", "startTime", "endTime"].includes(k)) {
      setScheduleErrorKey(getScheduleErrorKey(next));
    }
  };

  const busy = useMemo(() => sending, [sending]);
  const statusOptions = useMemo(
    () => STATUS_OPTIONS.map((option) => ({
      ...option,
      label: t(`crm.task.enums.status.${option.value}`, option.value.replace(/_/g, " ")),
    })),
    [t]
  );
  const priorityOptions = useMemo(
    () => PRIORITY_OPTIONS.map((option) => ({
      ...option,
      label: t(`crm.task.priorityLevels.${option.value}`, String(option.value)),
    })),
    [t]
  );
  const userOptions = useMemo(() => {
    const items = Array.isArray(usersData?.items) ? usersData.items : [];
    const options = items
      .filter((user) => user?.userId || user?.id)
      .map((user) => {
        const id = String(user.userId || user.id);
        const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
        return {
          value: id,
          label: name || user.email || id,
        };
      });

    if (
      currentUser?.id
      && !options.some((option) => option.value === String(currentUser.id))
    ) {
      const name = [currentUser.firstName, currentUser.lastName].filter(Boolean).join(" ").trim();
      options.unshift({
        value: String(currentUser.id),
        label: name || currentUser.email || String(currentUser.id),
      });
    }

    return [{ value: "", label: t("crm.task.placeholders.noAssignee") }, ...options];
  }, [currentUser, t, usersData]);

    // validateTitle: валидирует введённые данные.
const validateTitle = (v) => {
    const val = String(v || "").trim();
    if (!val) { setTitleError(t("crm.task.errors.titleRequired")); return false; }
    if (val.length > 300) { setTitleError(t("crm.task.errors.titleMax", { max: 300 })); return false; }
    setTitleError(""); return true;
  };

    // buildPayload: собирает структуру данных для рендера или запроса.
const buildPayload = () => {
    const priority = Number(form.priority) || 3;
    const assigneeId = String(form.assigneeId || "").trim();
    const payload = {
      title: form.title.trim(),
      description: String(form.description || "").trim(),
      status: form.status || "todo",
      priority,
      counterpartyId: form.counterpartyId || null,
      dealId: form.dealId || null,
      participantMode: "none",
    };

    if (assigneeId) {
      payload.assigneeIds = [assigneeId];
      payload.participantMode = "lists";
    }

    if (form.dueDate && !form.planOpen) {
      payload.plannedEndAt = form.dueDate;
      payload.plannedEndHasTime = false;
    }

    if (form.planOpen) {
      if (form.isAllDay) {
        if (form.eventDate) {
          payload.startAt = form.eventDate;
          payload.endAt = form.eventDate;
          payload.startAtHasTime = false;
          payload.endAtHasTime = false;
        }
      } else {
        const start = combineLocalDateTime(form.eventDate, form.startTime);
        const end = combineLocalDateTime(form.eventDate, form.endTime);
        if (start) {
          payload.startAt = start.toISOString();
          payload.startAtHasTime = true;
        }
        if (end) {
          payload.endAt = end.toISOString();
          payload.endAtHasTime = true;
        }
      }
    }

    return payload;
  };

    // submit: вспомогательная логика компонента.
const submit = async (e) => {
    e?.preventDefault();
    setErr("");

    const okTitle = validateTitle(form.title);
    const nextScheduleErrorKey = getScheduleErrorKey(form);
    setScheduleErrorKey(nextScheduleErrorKey);
    if (!okTitle || nextScheduleErrorKey) return;
    if (busy) return;

    try {
      setSending(true);
      const payload = buildPayload();
      await onSubmit?.(payload);
    } catch (e2) {
      setErr(
        e2?.data?.message
        || e2?.data?.error
        || e2?.response?.data?.message
        || e2?.response?.data?.error
        || e2?.error
        || e2?.message
        || t("crm.task.messages.createFailed")
      );
      setSending(false);
    }
  };

  const scheduleError = scheduleErrorKey ? t(scheduleErrorKey) : "";

  const updateSchedule = (patchOrFactory) => {
    setForm((prev) => {
      const patch = typeof patchOrFactory === "function" ? patchOrFactory(prev) : patchOrFactory;
      const next = { ...prev, ...patch };
      setScheduleErrorKey(getScheduleErrorKey(next));
      return next;
    });
  };

  const updateScheduleDate = (dateValue) => {
    const patch = {
      eventDate: dateValue,
      dueDate: dateValue,
      planOpen: true,
    };
    if (!form.isAllDay) {
      const selectedDate = parseDateOnly(dateValue);
      const start = combineLocalDateTime(dateValue, form.startTime);
      if (selectedDate && isSameDate(selectedDate, new Date()) && (!start || start < new Date())) {
        const rounded = roundUpTime(new Date(Date.now() + TIME_STEP_MINUTES * 60 * 1000));
        const end = new Date(rounded.getTime() + 60 * 60 * 1000);
        patch.startTime = localTimeValue(rounded);
        patch.endTime = localTimeValue(end);
      }
    }
    updateSchedule(patch);
  };

  const setTimedMode = () => {
    updateSchedule((prev) => {
      const patch = { isAllDay: false };
      const start = combineLocalDateTime(prev.eventDate, prev.startTime);
      if (start && start < new Date()) {
        const rounded = roundUpTime(new Date(Date.now() + TIME_STEP_MINUTES * 60 * 1000));
        const end = new Date(rounded.getTime() + 60 * 60 * 1000);
        patch.startTime = localTimeValue(rounded);
        patch.endTime = localTimeValue(end);
      }
      return patch;
    });
  };

  const setAllDayMode = () => {
    updateSchedule({ isAllDay: true });
  };

  const handleScheduleModePress = (event, action) => {
    event.preventDefault();
    action();
  };

  const selectTime = (field, value) => {
    const patch = { [field]: value };

    if (field === "startTime") {
      const nextStart = combineLocalDateTime(form.eventDate, value);
      const currentEnd = combineLocalDateTime(form.eventDate, form.endTime);
      if (nextStart && (!currentEnd || currentEnd <= nextStart)) {
        patch.endTime = localTimeValue(new Date(nextStart.getTime() + 60 * 60 * 1000));
      }
    }

    updateSchedule(patch);
  };

  const scheduleToday = localDateValue();
  const isScheduleToday = form.eventDate === scheduleToday;
  const minimumStartTime = isScheduleToday ? localTimeValue(roundUpTime(new Date())) : undefined;
  const minimumEndTime = useMemo(() => {
    const start = combineLocalDateTime(form.eventDate, form.startTime);
    if (!start) return undefined;
    return localTimeValue(new Date(start.getTime() + TIME_STEP_MINUTES * 60 * 1000));
  }, [form.eventDate, form.startTime]);

  const footer = (
    <>
      <Modal.Button onClick={onClose} disabled={busy}>{t("common.cancel")}</Modal.Button>
      <Modal.Button variant="primary" onClick={submit} disabled={busy || !!titleError || !!scheduleErrorKey}>
        {busy ? t("common.creating") : t("crm.task.actions.create")}
      </Modal.Button>
    </>
  );

  return (
    <Modal open title={t("crm.task.newTask")} size="md" onClose={busy ? undefined : onClose} footer={footer}>
      <form className={s.form} onSubmit={submit} noValidate>
        <TextField
          className={s.label}
          inputClassName={s.input}
          label={t("crm.task.fields.title")}
          placeholder={t("crm.task.placeholders.title")}
          value={form.title}
          onValueChange={(value) => change("title", value)}
          onBlur={(e) => validateTitle(e.target.value)}
          error={titleError}
          autoFocus
          required
          disabled={busy}
        />

        <TextareaField
          className={s.label}
          inputClassName={s.input}
          label={t("crm.task.fields.description")}
          rows={4}
          placeholder={t("crm.task.placeholders.description")}
          value={form.description}
          onValueChange={(value) => change("description", value)}
          helperText={t("calendar.createTask.descriptionOptional")}
          disabled={busy}
        />

        <div className={s.taskMetaGrid}>
          <SelectField
            className={`${s.label} ${s.taskSelectField}`}
            inputClassName={`${s.select} ${s.taskSelect}`}
            label={t("crm.task.fields.priority")}
            value={form.priority}
            options={priorityOptions}
            onValueChange={(val) => change("priority", Number(val))}
            placeholder={t("crm.task.placeholders.priority")}
            size="md"
            disabled={busy}
          />

          <SelectField
            className={`${s.label} ${s.taskSelectField}`}
            inputClassName={`${s.select} ${s.taskSelect}`}
            label={t("crm.task.fields.status")}
            value={form.status}
            options={statusOptions}
            onValueChange={(val) => change("status", String(val))}
            placeholder={t("crm.task.placeholders.status")}
            size="md"
            disabled={busy}
          />
        </div>

        <TextField
          className={s.label}
          inputClassName={s.input}
          label={t("crm.task.fields.dueDate")}
          placeholder="YYYY-MM-DD"
          value={form.dueDate}
          onValueChange={(nextValue) => change("dueDate", nextValue)}
          disabled={busy}
        />

        <div className={s.row3}>
          <SelectField
            className={s.label}
            inputClassName={`${s.select} ${s.taskSelect}`}
            label={t("crm.task.fields.assignee")}
            placeholder={usersLoading ? t("crm.task.messages.loadingUsers") : t("crm.task.placeholders.assignee")}
            value={form.assigneeId}
            options={usersLoading ? [{ value: "", label: t("crm.task.messages.loadingUsers") }] : userOptions}
            onValueChange={(value) => change("assigneeId", String(value || ""))}
            disabled={busy || usersLoading}
          />

          <TextField
            className={s.label}
            inputClassName={s.input}
            label={t("crm.task.fields.counterpartyId")}
            placeholder={t("crm.task.placeholders.counterpartyId")}
            value={form.counterpartyId}
            onValueChange={(value) => change("counterpartyId", value)}
            disabled={busy}
          />

          <TextField
            className={s.label}
            inputClassName={s.input}
            label={t("crm.task.fields.dealId")}
            placeholder={t("crm.task.placeholders.dealId")}
            value={form.dealId}
            onValueChange={(value) => change("dealId", value)}
            disabled={busy}
          />
        </div>

        <div className={dt.scheduleBlock}>
          <button
            type="button"
            className={dt.scheduleToggle}
            onClick={() => change("planOpen", !form.planOpen)}
            disabled={busy}
          >
            {form.planOpen ? "▾" : "▸"} {t("calendar.createTask.dateTime")}
          </button>

          {form.planOpen && (
            <div className={dt.schedulePanel}>
              <div className={dt.modeRow}>
                <button
                  type="button"
                  className={`${dt.modeButton} ${form.isAllDay ? dt.modeButtonActive : ""}`}
                  onMouseDown={(event) => handleScheduleModePress(event, setAllDayMode)}
                  onClick={setAllDayMode}
                  disabled={busy}
                >
                  {t("calendar.createTask.allDay")}
                </button>
                <button
                  type="button"
                  className={`${dt.modeButton} ${!form.isAllDay ? dt.modeButtonActive : ""}`}
                  onMouseDown={(event) => handleScheduleModePress(event, setTimedMode)}
                  onClick={setTimedMode}
                  disabled={busy}
                >
                  {t("calendar.createTask.timed")}
                </button>
              </div>

              <div className={dt.compactGrid}>
                <DatePickerField
                  className={dt.compactField}
                  inputClassName={dt.reusablePicker}
                  label={t("calendar.createTask.date")}
                  value={form.eventDate}
                  onValueChange={updateScheduleDate}
                  placeholder={t("calendar.createTask.selectDate")}
                  min={localDateValue()}
                  isDateDisabled={isBeforeToday}
                  disabled={busy}
                />

                {!form.isAllDay ? (
                  <div className={dt.timeGroup}>
                    <span className={dt.groupLabel}>{t("calendar.createTask.time")}</span>
                    <div className={dt.timeFields}>
                      <TimePickerField
                        className={dt.compactField}
                        inputClassName={dt.reusablePicker}
                        label={t("calendar.createTask.start")}
                        value={form.startTime}
                        onValueChange={(value) => selectTime("startTime", value)}
                        step={TIME_STEP_MINUTES}
                        min={minimumStartTime}
                        disabled={busy}
                      />
                      <TimePickerField
                        className={dt.compactField}
                        inputClassName={dt.reusablePicker}
                        label={t("calendar.createTask.end")}
                        value={form.endTime}
                        onValueChange={(value) => selectTime("endTime", value)}
                        step={TIME_STEP_MINUTES}
                        min={minimumEndTime}
                        disabled={busy}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              {scheduleError ? <div className={`${s.error} ${dt.scheduleError}`}>{scheduleError}</div> : null}
            </div>
          )}
        </div>

        {err ? <div className={s.error}>{err}</div> : null}
      </form>
    </Modal>
  );
}
