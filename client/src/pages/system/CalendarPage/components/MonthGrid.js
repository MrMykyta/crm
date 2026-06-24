// src/components/Calendar/MonthGrid.jsx
import React from "react";
import s from "../CalendarPage.module.css";
import { isSameDay } from "./dateUtils";

// Компонент MonthGrid: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function MonthGrid({
  baseDate,
  today,
  selectedDate,
  onClickDay,
  compact = false,
  yearMode = false,
}) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const first = new Date(year, month, 1);
  const firstWeekday = (first.getDay() + 6) % 7;

  const nextMonth = new Date(year, month + 1, 1);
  const daysInMonth = Math.round((nextMonth - first) / 86400000);

  const days = [];

  for (let i = 0; i < firstWeekday; i++) {
    const d = new Date(first);
    d.setDate(d.getDate() - (firstWeekday - i));
    days.push({ date: d, outside: true });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    days.push({ date: d, outside: false });
  }
  while (days.length % 7 !== 0 || days.length < 42) {
    const last = days[days.length - 1].date;
    const d = new Date(last);
    d.setDate(d.getDate() + 1);
    days.push({ date: d, outside: true });
  }

  return (
    <div className={compact ? s.monthGridCompact : s.monthGrid}>
      {days.map(({ date, outside }) => {
        const isToday = isSameDay(date, today);
        const isSelected = selectedDate && isSameDay(date, selectedDate);

        const shouldHighlightToday = !yearMode || month === today.getMonth();

        return (
          <button
            key={date.toISOString()}
            type="button"
            className={[
              s.mgCell,
              outside ? s.mgOutside : "",
              isToday && shouldHighlightToday ? s.mgToday : "",
              isSelected ? s.mgSelected : "",
            ].join(" ")}
            onClick={() => onClickDay && onClickDay(date)}
          >
            <span>{date.getDate()}</span>
          </button>
        );
      })}
    </div>
  );
}
