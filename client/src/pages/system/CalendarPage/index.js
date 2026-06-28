// src/components/Calendar/CalendarPage.jsx
import React, { useMemo, useState, useRef, useLayoutEffect, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import s from "./CalendarPage.module.css";

import YearView from "./components/YearView";
import MonthView from "./components/MonthView";
import WeekView from "./components/WeekView";
import DayView from "./components/DayView";
import MiniMonth from "./components/MiniMonth";
import QuickCreateTaskPopover from "../../../components/calendar/QuickCreateTaskPopover";
import { useCreateTaskMutation, useListTasksQuery } from "../../../store/rtk/tasksApi";
import {
  PRIORITY_I18N_KEYS,
  PRIORITY_OPTIONS,
  normalizePriority,
} from "../../../config/priority";
import { toKey } from "./components/dateUtils";

const VIEW = {
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
  YEAR: "year",
};

const TASK_DONE_STATUSES = new Set(["done", "completed", "closed"]);

function getDateLocale(language) {
  const value = String(language || "en").toLowerCase();
  if (value.startsWith("ru")) return "ru-RU";
  if (value.startsWith("ua") || value.startsWith("uk")) return "uk-UA";
  if (value.startsWith("pl")) return "pl-PL";
  return "en-US";
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date) {
  const next = startOfDay(date);
  const day = next.getDay();
  const diff = (day + 6) % 7;
  next.setDate(next.getDate() - diff);
  return next;
}

function dateInputValue(date) {
  return toKey(date);
}

function parseDateInput(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function rectSnapshot(element) {
  const rect = element?.getBoundingClientRect?.();
  if (!rect) return null;
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

function extractTasksList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function formatTasksError(error) {
  if (!error) return "";
  const status = error.status ? `HTTP ${error.status}` : "";
  const message =
    error.data?.message ||
    error.data?.error ||
    error.error ||
    error.message ||
    "Unknown error";
  return [status, message].filter(Boolean).join(": ");
}

function parseTaskDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function hasDateTime(value) {
  return Boolean(value && String(value).includes("T"));
}

function formatTime(date, locale = undefined) {
  return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

function minutesFromDate(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function taskText(item) {
  const task = item?.task || {};
  return [
    item?.title,
    task.description,
    task.counterparty?.shortName,
    task.counterparty?.fullName,
    task.counterparty?.name,
    task.deal?.title,
    task.deal?.name,
  ].map(normalizeText).filter(Boolean).join(" ");
}

function formatPriorityLabel(t, priority) {
  const value = normalizePriority(priority);
  return `${value} · ${t(PRIORITY_I18N_KEYS[value])}`;
}

function userIdSetFromTask(task) {
  const ids = new Set();
  if (task?.assigneeId) ids.add(String(task.assigneeId));
  if (Array.isArray(task?.assigneeIds)) task.assigneeIds.forEach((id) => ids.add(String(id)));
  if (Array.isArray(task?.userParticipants)) {
    task.userParticipants.forEach((user) => {
      if (user?.id) ids.add(String(user.id));
      if (user?.userId) ids.add(String(user.userId));
    });
  }
  if (Array.isArray(task?.assignees)) {
    task.assignees.forEach((user) => {
      if (user?.id) ids.add(String(user.id));
      if (user?.userId) ids.add(String(user.userId));
    });
  }
  return ids;
}

function hasAssignableTaskData(task) {
  return Boolean(
    task?.assigneeId ||
    (Array.isArray(task?.assigneeIds) && task.assigneeIds.length) ||
    (Array.isArray(task?.userParticipants) && task.userParticipants.length) ||
    (Array.isArray(task?.assignees) && task.assignees.length)
  );
}

function getVisibleRange(view, cursor) {
  if (view === VIEW.YEAR) {
    return {
      start: startOfDay(new Date(cursor.getFullYear(), 0, 1)),
      end: endOfDay(new Date(cursor.getFullYear(), 11, 31)),
    };
  }
  if (view === VIEW.MONTH) {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const firstWeekday = (first.getDay() + 6) % 7;
    const start = addDays(first, -firstWeekday);
    return { start: startOfDay(start), end: endOfDay(addDays(start, 41)) };
  }
  if (view === VIEW.WEEK) {
    const start = startOfWeek(cursor);
    return { start, end: endOfDay(addDays(start, 6)) };
  }
  return { start: startOfDay(cursor), end: endOfDay(cursor) };
}

export function normalizeTaskToCalendarItem(task, locale) {
  const dateSource = task?.startAt || task?.start || task?.endAt || task?.end || task?.plannedEndAt;
  const date = parseTaskDate(dateSource);
  if (!task?.id || !date) return null;

  const completed = TASK_DONE_STATUSES.has(String(task.status || "").toLowerCase()) || Boolean(task.completedAt);
  const overdue = !completed && endOfDay(date).getTime() < Date.now();
  const hasTime = (
    ((task.startAt || task.start) && task.startAtHasTime !== false && task.plannedStartHasTime !== false && hasDateTime(task.startAt || task.start)) ||
    ((task.endAt || task.end) && task.endAtHasTime !== false && task.plannedEndHasTime !== false && hasDateTime(task.endAt || task.end))
  );
  const startDate = parseTaskDate(task.startAt || task.start) || date;
  const endDate = parseTaskDate(task.endAt || task.end) || null;
  const allDay = typeof task.allDay === "boolean" ? task.allDay : !hasTime;

  return {
    id: `task:${task.id}`,
    taskId: task.id,
    type: "task",
    task,
    title: task.title || "Untitled task",
    date,
    dateKey: toKey(date),
    allDay,
    start: !allDay ? formatTime(startDate, locale) : "",
    end: !allDay && endDate ? formatTime(endDate, locale) : "",
    startMinutes: !allDay ? minutesFromDate(startDate) : null,
    endMinutes: !allDay && endDate ? minutesFromDate(endDate) : null,
    priority: task.priority,
    status: task.status,
    completed,
    overdue,
  };
}

function isItemInRange(item, range) {
  const time = item?.date?.getTime?.();
  return Number.isFinite(time) && time >= range.start.getTime() && time <= range.end.getTime();
}

// Компонент IconCalendar: отвечает за отображение UI и обработку взаимодействий пользователя.
const IconCalendar = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
    <rect x="4" y="5" width="16" height="15" rx="3" ry="3" stroke="currentColor" strokeWidth="1.4" fill="none" />
    <line x1="4" y1="9" x2="20" y2="9" stroke="currentColor" strokeWidth="1.2" />
    <circle cx="9" cy="13" r="0.9" fill="currentColor" />
    <circle cx="13" cy="13" r="0.9" fill="currentColor" />
    <circle cx="17" cy="13" r="0.9" fill="currentColor" />
  </svg>
);

// Компонент IconInbox: отвечает за отображение UI и обработку взаимодействий пользователя.
const IconInbox = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
    <path
      d="M4.5 5.5h15l-1.2 10.5a2 2 0 0 1-2 1.8h-8.6a2 2 0 0 1-2-1.8L4.5 5.5Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
    <path
      d="M8 13.5h2.4a1.6 1.6 0 0 0 3.2 0H16"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Компонент IconPlus: отвечает за отображение UI и обработку взаимодействий пользователя.
const IconPlus = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.4" fill="none" />
    <line x1="12" y1="8.2" x2="12" y2="15.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <line x1="8.2" y1="12" x2="15.8" y2="12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

// Компонент IconSearch: отвечает за отображение UI и обработку взаимодействий пользователя.
const IconSearch = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
    <circle cx="11" cy="11" r="4.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
    <line x1="15" y1="15" x2="19" y2="19" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

// Компонент CalendarPage: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function CalendarPage() {
  const { t, i18n } = useTranslation();
  const locale = getDateLocale(i18n.language);
  const navigate = useNavigate();
  const currentUser = useSelector((state) => state.auth?.currentUser || null);
  const [view, setView] = useState(VIEW.MONTH);
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [quickCreate, setQuickCreate] = useState(null);
  const [filters, setFilters] = useState({
    showCompleted: true,
    overdueOnly: false,
    priority: "all",
    myTasksOnly: false,
    search: "",
  });

  // выпадающий список годов
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [yearDropdownPos, setYearDropdownPos] = useState({ top: 0, left: 0, width: 180 });
  const yearBtnRef = useRef(null);
  const visibleRange = useMemo(() => getVisibleRange(view, cursor), [cursor, view]);
  const tasksQuery = useMemo(() => ({
    calendar: true,
    from: visibleRange.start.toISOString(),
    to: visibleRange.end.toISOString(),
    sort: "startAt",
    dir: "ASC",
    page: 1,
    limit: 200,
  }), [visibleRange]);
  const {
    data: tasksData,
    isLoading: tasksLoading,
    isFetching: tasksFetching,
    isError: tasksError,
    error: tasksLoadError,
  } = useListTasksQuery(tasksQuery);
  const [createTask, { isLoading: creatingTask }] = useCreateTaskMutation();

  const rawTasks = useMemo(() => extractTasksList(tasksData), [tasksData]);
  const myTasksAvailable = useMemo(
    () => Boolean(currentUser?.id) && rawTasks.some(hasAssignableTaskData),
    [currentUser?.id, rawTasks]
  );

  const calendarItems = useMemo(() => {
    return rawTasks
      .map((task) => normalizeTaskToCalendarItem(task, locale))
      .filter(Boolean)
      .filter((item) => isItemInRange(item, visibleRange));
  }, [locale, rawTasks, visibleRange]);

  const priorityOptions = useMemo(
    () => ["all", ...PRIORITY_OPTIONS.map((option) => String(option.value))],
    []
  );

  const filteredCalendarItems = useMemo(() => {
    const search = normalizeText(filters.search);
    const currentUserId = currentUser?.id ? String(currentUser.id) : "";
    return calendarItems.filter((item) => {
      if (!filters.showCompleted && item.completed) return false;
      if (filters.overdueOnly && !item.overdue) return false;
      if (filters.priority !== "all" && normalizePriority(item.priority) !== Number(filters.priority)) return false;
      if (search && !taskText(item).includes(search)) return false;
      if (filters.myTasksOnly && currentUserId) {
        const ids = userIdSetFromTask(item.task);
        if (!ids.has(currentUserId)) return false;
      }
      return true;
    });
  }, [calendarItems, currentUser?.id, filters]);

  const selectedDayItems = useMemo(() => {
    const key = toKey(selectedDate);
    return filteredCalendarItems.filter((item) => item.dateKey === key);
  }, [filteredCalendarItems, selectedDate]);

  useEffect(() => {
    if ((!myTasksAvailable && filters.myTasksOnly) || !priorityOptions.includes(filters.priority)) {
      setFilters((prev) => ({
        ...prev,
        myTasksOnly: myTasksAvailable ? prev.myTasksOnly : false,
        priority: priorityOptions.includes(prev.priority) ? prev.priority : "all",
      }));
    }
  }, [filters.myTasksOnly, filters.priority, myTasksAvailable, priorityOptions]);

  const today = new Date();
  const yearNumber = cursor.getFullYear();
  const monthLabel = cursor.toLocaleString(locale, {
    month: "long",
    year: "numeric",
  });

    // goToday: вспомогательная логика компонента.
const goToday = () => {
    const d = new Date();
    setCursor(d);
    setSelectedDate(d);
    setView(VIEW.DAY);
  };

    // shift: вспомогательная логика компонента.
const shift = (dir) => {
    const base = new Date(cursor);
    if (view === VIEW.YEAR) base.setFullYear(base.getFullYear() + dir);
    else if (view === VIEW.MONTH) base.setMonth(base.getMonth() + dir);
    else if (view === VIEW.WEEK) base.setDate(base.getDate() + dir * 7);
    else base.setDate(base.getDate() + dir);
    setCursor(base);
  };

  const pickDate = (date) => {
    setSelectedDate(date);
    setCursor(date);
  };

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // список годов вокруг текущего
  const years = [];
  for (let y = yearNumber - 5; y <= yearNumber + 5; y++) years.push(y);

  // позиция дропа годов
  useLayoutEffect(() => {
    if (yearPickerOpen && yearBtnRef.current) {
      const rect = yearBtnRef.current.getBoundingClientRect();
      setYearDropdownPos({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width + 40,
      });
    }
  }, [yearPickerOpen]);

  // клик мимо — закрыть дроп годов
  useEffect(() => {
    if (!yearPickerOpen) return;
        // onClick: вспомогательная логика компонента.
const onClick = (e) => {
      if (yearBtnRef.current && yearBtnRef.current.contains(e.target)) return;
      setYearPickerOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [yearPickerOpen]);

  const openCreateTask = (date = cursor, options = {}) => {
    const parsed = parseDateInput(date) || cursor;
    setSelectedDate(parsed);
    setCursor(parsed);
    setQuickCreate({
      date: dateInputValue(parsed),
      anchorRect: options.anchorRect || null,
      initialValue: {
        title: options.title || "",
        isAllDay: options.isAllDay !== false,
        startTime: options.startTime || "",
        endTime: options.endTime || "",
      },
    });
  };

  const closeCreateTask = () => setQuickCreate(null);

  const handleTaskOpen = (item) => {
    const taskId = item?.taskId || item?.task?.id;
    if (taskId) navigate(`/main/tasks/${encodeURIComponent(taskId)}`);
  };

  const handleCreateTask = async (payload) => {
    await createTask(payload).unwrap();
    closeCreateTask();
  };

  const handleMoreCreateOptions = ({ date, title, allDay, start, end }) => {
    const params = [
      ["date", date],
      ["title", title],
      ["allDay", allDay ? "1" : "0"],
      ["start", start],
      ["end", end],
    ]
      .filter(([, value]) => value !== undefined && value !== null && String(value) !== "")
      .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
      .join("&");
    navigate(`/main/tasks/new${params ? `?${params}` : ""}`);
  };

  const tasksErrorText = formatTasksError(tasksLoadError);
  const statusText = tasksLoading
    ? t("calendar.state.loading")
    : tasksError
      ? `${t("calendar.state.loadError")}${tasksErrorText ? `: ${tasksErrorText}` : ""}`
      : !filteredCalendarItems.length
        ? t("calendar.state.emptyPeriod")
        : "";
  const selectedDateLabel = selectedDate.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const labels = {
    allDay: t("calendar.task.allDay"),
    allDayTasksOn: t("calendar.week.allDayTasksOn"),
    close: t("common.close", "Close"),
    noTasksForDay: t("calendar.state.noTasksForDay"),
  };

  return (
    <div className={s.wrap}>
      {/* ===== TOPBAR ===== */}
      <div className={s.topbar}>
        {/* LEFT */}
        <div className={s.topbarLeft}>
          <div className={s.iconGroup}>
            <button type="button" className={s.iconBtn} aria-label={t("calendar.actions.calendarView")}>
              <IconCalendar />
            </button>
            <button type="button" className={s.iconBtn} aria-label={t("calendar.actions.taskInbox")}>
              <IconInbox />
            </button>
            <button
              type="button"
              className={s.iconBtn}
              aria-label={t("calendar.actions.createTask")}
              onClick={(event) => openCreateTask(selectedDate, { anchorRect: rectSnapshot(event.currentTarget), isAllDay: true })}
            >
              <IconPlus />
            </button>
          </div>

          {view === VIEW.YEAR ? (
            <div className={s.yearPickerWrap}>
              <button
                type="button"
                ref={yearBtnRef}
                className={s.yearPickerBtn}
                onClick={() => setYearPickerOpen((v) => !v)}
              >
                {yearNumber}
                <span className={s.chevronSmall} aria-hidden />
              </button>
            </div>
          ) : (
            <div className={s.monthTitle}>
              {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
            </div>
          )}
        </div>

        {/* CENTER */}
        <div className={s.topbarCenter}>
          <div className={s.segmentSimple}>
            <div className={s.segmentSlider} data-view={view} />
            <div className={`${s.segmentItem} ${view === VIEW.DAY ? s.segmentItemActive : ""}`}>
              <button
                onClick={() => {
                  setView(VIEW.DAY);
                  setYearPickerOpen(false);
                }}
              >
                {t("calendar.view.day")}
              </button>
            </div>
            <div className={`${s.segmentItem} ${view === VIEW.WEEK ? s.segmentItemActive : ""}`}>
              <button
                onClick={() => {
                  setView(VIEW.WEEK);
                  setYearPickerOpen(false);
                }}
              >
                {t("calendar.view.week")}
              </button>
            </div>
            <div className={`${s.segmentItem} ${view === VIEW.MONTH ? s.segmentItemActive : ""}`}>
              <button
                onClick={() => {
                  setView(VIEW.MONTH);
                  setYearPickerOpen(false);
                }}
              >
                {t("calendar.view.month")}
              </button>
            </div>
            <div className={`${s.segmentItem} ${view === VIEW.YEAR ? s.segmentItemActive : ""}`}>
              <button
                onClick={() => {
                  setView(VIEW.YEAR);
                  // не закрываем dropdown
                }}
              >
                {t("calendar.view.year")}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className={s.topbarRight}>
          <div className={s.nav}>
            <button onClick={() => shift(-1)} aria-label={t("calendar.actions.previousPeriod")} className={s.navBtn}>
              ‹
            </button>
            <button onClick={goToday} className={`${s.navBtn} ${s.todayBtn}`}>
              {t("calendar.actions.today")}
            </button>
            <button onClick={() => shift(1)} aria-label={t("calendar.actions.nextPeriod")} className={s.navBtn}>
              ›
            </button>
          </div>
          <label className={s.toolbarSearch} aria-label={t("calendar.filters.search")}>
            <IconSearch />
            <input
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder={t("calendar.filters.searchPlaceholder")}
            />
          </label>
        </div>
      </div>

      {statusText ? (
        <div className={`${s.calendarState} ${tasksError ? s.calendarStateError : ""}`.trim()}>
          {statusText}
          {tasksFetching && !tasksLoading && !tasksError ? ` ${t("calendar.state.updating")}` : ""}
        </div>
      ) : null}

      {/* ===== PORTAL: YEAR DROPDOWN ===== */}
      {yearPickerOpen &&
        createPortal(
          <div
            className={s.yearDropdownPortal}
            style={{
              top: yearDropdownPos.top,
              left: yearDropdownPos.left,
              minWidth: yearDropdownPos.width,
            }}
          >
            {years.map((y) => (
              <button
                key={y}
                type="button"
                className={`${s.yearDropdownItem} ${y === yearNumber ? s.yearDropdownItemActive : ""}`}
                onClick={() => {
                  const d = new Date(cursor);
                  d.setFullYear(y);
                  setCursor(d);
                  setYearPickerOpen(false);
                }}
              >
                {y}
              </button>
            ))}
          </div>,
          document.body
        )}

      {/* ===== BODY ===== */}
      <div className={s.bodyWithSide}>
        <div className={view === VIEW.YEAR ? `${s.main} ${s.mainYear}` : s.main}>
          {view === VIEW.YEAR && (
            <YearView year={yearNumber} today={today} selectedDate={selectedDate} setCursor={pickDate} locale={locale} />
          )}
          {view === VIEW.MONTH && (
            <MonthView
              baseDate={cursor}
              today={today}
              selectedDate={selectedDate}
              setCursor={pickDate}
              calendarItems={filteredCalendarItems}
              onItemOpen={handleTaskOpen}
              onCreateFromDate={openCreateTask}
              locale={locale}
            />
          )}
          {view === VIEW.WEEK && (
            <WeekView
              baseDate={cursor}
              today={today}
              selectedDate={selectedDate}
              calendarItems={filteredCalendarItems}
              onItemOpen={handleTaskOpen}
              onCreateFromDate={openCreateTask}
              locale={locale}
              labels={labels}
            />
          )}
          {view === VIEW.DAY && (
            <DayView
              baseDate={cursor}
              today={today}
              calendarItems={filteredCalendarItems}
              onItemOpen={handleTaskOpen}
              onCreateFromDate={openCreateTask}
              locale={locale}
              labels={labels}
            />
          )}
        </div>

        <aside className={s.side}>
          <MiniMonth
            date={cursor}
            today={today}
            selectedDate={selectedDate}
            onPick={pickDate}
            locale={locale}
          />

          <section className={s.sideCard}>
            <div className={s.sideCardHeader}>
              <div>
                <div className={s.sideEyebrow}>{t("calendar.sidebar.filters")}</div>
                <h3>{t("calendar.sidebar.tasks")}</h3>
              </div>
            </div>
            <label className={s.sidebarSearch}>
              <span>{t("calendar.filters.search")}</span>
              <input
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder={t("calendar.filters.searchPlaceholder")}
              />
            </label>
            <label className={s.filterCheck}>
              <input
                type="checkbox"
                checked={filters.showCompleted}
                onChange={(event) => updateFilter("showCompleted", event.target.checked)}
              />
              <span>{t("calendar.filters.showCompleted")}</span>
            </label>
            <label className={s.filterCheck}>
              <input
                type="checkbox"
                checked={filters.overdueOnly}
                onChange={(event) => updateFilter("overdueOnly", event.target.checked)}
              />
              <span>{t("calendar.filters.overdueOnly")}</span>
            </label>
            {myTasksAvailable ? (
              <label className={s.filterCheck}>
                <input
                  type="checkbox"
                  checked={filters.myTasksOnly}
                  onChange={(event) => updateFilter("myTasksOnly", event.target.checked)}
                />
                <span>{t("calendar.filters.myTasksOnly")}</span>
              </label>
            ) : null}
            <label className={s.sidebarSelect}>
              <span>{t("calendar.filters.priority")}</span>
              <select value={filters.priority} onChange={(event) => updateFilter("priority", event.target.value)}>
                {priorityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? t("priority.all") : `${option} · ${t(PRIORITY_I18N_KEYS[Number(option)])}`}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className={s.sideCard}>
            <div className={s.sideCardHeader}>
              <div>
                <div className={s.sideEyebrow}>{t("calendar.sidebar.selectedDay")}</div>
                <h3>{selectedDateLabel.charAt(0).toUpperCase() + selectedDateLabel.slice(1)}</h3>
              </div>
              <div className={s.sideHeaderActions}>
                <span className={s.sideCount}>{selectedDayItems.length}</span>
                <button
                  type="button"
                  className={s.sideCreateBtn}
                  aria-label={t("calendar.actions.createTask")}
                  onClick={(event) => openCreateTask(selectedDate, { anchorRect: rectSnapshot(event.currentTarget), isAllDay: true })}
                >
                  +
                </button>
              </div>
            </div>

            {selectedDayItems.length ? (
              <div className={s.sideTaskList}>
                {selectedDayItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={[
                      s.sideTask,
                      item.completed ? s.sideTaskCompleted : "",
                      item.overdue ? s.sideTaskOverdue : "",
                    ].join(" ")}
                    onClick={() => handleTaskOpen(item)}
                  >
                    <span className={s.sideTaskTitle}>{item.title}</span>
                    <span className={s.sideTaskMeta}>
                      {item.allDay ? t("calendar.task.allDay") : [item.start, item.end].filter(Boolean).join(" - ")}
                    </span>
                    <span className={s.sideTaskBadges}>
                      <span className={s.priorityBadge}>{formatPriorityLabel(t, item.priority)}</span>
                      <span className={item.completed ? s.statusDoneBadge : s.statusBadge}>
                        {item.completed ? t("calendar.task.completed") : (item.status || t("calendar.task.active"))}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className={s.sideEmpty}>
                <p>{t("calendar.state.noTasksForDay")}</p>
              </div>
            )}
          </section>
        </aside>
      </div>

      {quickCreate ? (
        <QuickCreateTaskPopover
          key={`${quickCreate.date}-${quickCreate.initialValue.isAllDay ? "all-day" : "timed"}-${quickCreate.initialValue.startTime || ""}`}
          date={quickCreate.date}
          anchorRect={quickCreate.anchorRect}
          initialValue={quickCreate.initialValue}
          locale={locale}
          busy={creatingTask}
          onClose={closeCreateTask}
          onSubmit={handleCreateTask}
          onMoreOptions={handleMoreCreateOptions}
        />
      ) : null}
    </div>
  );
}
