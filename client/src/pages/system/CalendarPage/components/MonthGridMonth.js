// src/components/Calendar/components/MonthGridMonth.jsx
import React from "react";
import s from "../CalendarPage.module.css";
import { isSameDay, toKey } from "./dateUtils";

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

// Компонент MonthGridMonth: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function MonthGridMonth({
  baseDate,
  today,
  selectedDate,
  onClickDay,
  calendarItems = [],
  onItemOpen,
  onCreateFromDate,
  locale = "en",
}) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const first = new Date(year, month, 1);
  const firstWeekday = (first.getDay() + 6) % 7;
  const nextMonth = new Date(year, month + 1, 1);
  const daysInMonth = Math.round((nextMonth - first) / 86400000);

  const days = [];

  // prev days
  for (let i = 0; i < firstWeekday; i++) {
    const d = new Date(first);
    d.setDate(d.getDate() - (firstWeekday - i));
    days.push({ date: d, outside: true });
  }

  // current month
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    days.push({ date: d, outside: false });
  }

  // tail
  while (days.length < 42) {
    const last = days[days.length - 1].date;
    const d = new Date(last);
    d.setDate(d.getDate() + 1);
    days.push({ date: d, outside: true });
  }

  return (
    <div className={s.monthGridMonth}>
      {days.map(({ date, outside }) => {
        const isToday = isSameDay(date, today);
        const isSelected = selectedDate && isSameDay(date, selectedDate);
        const weekday = date.getDay();
        const isWeekend = weekday === 0 || weekday === 6;
        const isFirstOfMonth = date.getDate() === 1;
        const events = calendarItems.filter((item) => item.dateKey === toKey(date));

        return (
          <div
            key={date.toISOString()}
            className={[
              s.monthCell,
              outside ? s.monthCellOutside : "",
              isToday ? s.monthCellToday : "",
              isSelected ? s.monthCellSelected : "",
              isWeekend ? s.monthCellWeekend : "",
            ].join(" ")}
            onClick={() => onClickDay && onClickDay(date)}
            onDoubleClick={(event) => onCreateFromDate?.(date, {
              isAllDay: true,
              anchorRect: rectSnapshot(event.currentTarget),
            })}
          >
            <div className={s.monthCellHeader}>
              <span className={isFirstOfMonth ? s.monthCellOtherMonthTitle : s.monthCellDay}>
                {isFirstOfMonth
                  ? `1 ${date.toLocaleString(locale, { month: "short" })}`
                  : date.getDate()}
              </span>
            </div>

            <div className={s.monthCellEvents}>
              {events.map((ev) => (
                <div
                    key={ev.id}
                    className={[
                      s.eventPill,
                      s.taskPill,
                      ev.completed ? s.taskPillCompleted : "",
                      ev.overdue ? s.taskPillOverdue : "",
                      ev.priority ? s[`taskPriority${ev.priority}`] || "" : "",
                    ].join(" ")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onItemOpen?.(ev);
                    }}
                  >
                  {ev.title}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
