// src/components/Calendar/DayView.jsx
import React from "react";
import s from "../CalendarPage.module.css";
import { isSameDay } from "./dateUtils";
import CurrentTimeLineWeek from "./CurrentTimeLineWeek";

function pad2(value) {
  return String(value).padStart(2, "0");
}

function slotTime(hour) {
  const safeHour = Math.max(0, Math.min(23, Number(hour) || 0));
  return `${pad2(safeHour)}:00`;
}

function slotEndTime(hour) {
  const safeHour = Math.max(0, Math.min(23, Number(hour) || 0));
  if (safeHour >= 23) return "23:45";
  return `${pad2(safeHour + 1)}:00`;
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

// Компонент DayView: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function DayView({
  baseDate,
  today,
  calendarItems = [],
  onItemOpen,
  onCreateFromDate,
  locale = "en",
  labels = {},
}) {
  const isToday = isSameDay(baseDate, today);
  const events = calendarItems.filter((item) => isSameDay(item.date, baseDate));
  const allDay = events.filter((item) => item.allDay);
  const timed = events.filter((item) => !item.allDay);

  return (
    <div className={s.dayView}>
      <div className={s.dayHeader}>
        <div className={s.dayTitle}>
          {baseDate.toLocaleString(locale, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>
        {allDay.length ? (
          <div className={s.dayAllDayList}>
            {allDay.map((item) => (
              <button
                key={item.id}
                type="button"
                className={[
                  s.allDayChip,
                  s.taskPill,
                  item.completed ? s.taskPillCompleted : "",
                  item.overdue ? s.taskPillOverdue : "",
                ].join(" ")}
                onClick={() => onItemOpen?.(item)}
              >
                {item.title}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className={s.dayBody}>
        <div className={s.dayScroll}>
          {isToday && <CurrentTimeLineWeek offsetTop={0} />}

          <div className={s.timeCol}>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className={s.timeSlot}>
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          <div className={s.dayCol}>
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className={s.weekHourBg}
                onDoubleClick={(event) => onCreateFromDate?.(baseDate, {
                  isAllDay: false,
                  startTime: slotTime(h),
                  endTime: slotEndTime(h),
                  anchorRect: rectSnapshot(event.currentTarget),
                })}
              ></div>
            ))}

            {!events.length ? (
              <div className={s.calendarEmptyDay}>{labels.noTasksForDay || "No tasks for this day"}</div>
            ) : null}

            {timed.map((ev) => {
              const startMin = Number.isFinite(ev.startMinutes) ? ev.startMinutes : 0;
              const endMin = Number.isFinite(ev.endMinutes) ? ev.endMinutes : startMin + 60;
              const dur = Math.max(30, endMin - startMin);
              const top = (startMin / 60) * 48;
              const height = (dur / 60) * 48;

              return (
                <div
                  key={ev.id}
                  className={[
                    s.weekEvent,
                    s.taskEvent,
                    ev.completed ? s.taskPillCompleted : "",
                    ev.overdue ? s.taskPillOverdue : "",
                  ].join(" ")}
                  style={{ top: `${top}px`, height: `${height}px`, left: "8px", right: "8px" }}
                  onClick={() => onItemOpen?.(ev)}
                >
                  <div className={s.weekEventTitle}>{ev.title}</div>
                  <div className={s.weekEventTime}>
                    {ev.start} – {ev.end}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
