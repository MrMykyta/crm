// src/components/Calendar/MiniMonth.jsx
import React from "react";
import s from "../CalendarPage.module.css";

export default function MiniMonth({ date, today, onPick }) {
  const monthLabel = date.toLocaleString("ru-RU", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className={s.miniMonth}>
      <div className={s.miniMonthHeader}>
        <span className={s.miniMonthTitle}>
          {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
        </span>
      </div>

      <div className={s.miniMonthWeekdays}>
        {["П", "В", "С", "Ч", "П", "С", "В"].map((d, idx) => (
          <div key={idx} className={s.miniMonthWeekday}>
            {d}
          </div>
        ))}
      </div>

      <MiniMonthGrid baseDate={date} today={today} onPick={onPick} />
    </div>
  );
}

function MiniMonthGrid({ baseDate, today, onPick }) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const first = new Date(year, month, 1);
  const firstWeekday = (first.getDay() + 6) % 7;

  const nextMonth = new Date(year, month + 1, 1);
  const daysInMonth = Math.round((nextMonth - first) / 86400000);

  const cells = [];

  for (let i = 0; i < firstWeekday; i++) {
    const d = new Date(first);
    d.setDate(d.getDate() - (firstWeekday - i));
    cells.push({ date: d, outside: true });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    cells.push({ date: d, outside: false });
  }

  while (cells.length < 42) {
    const last = cells[cells.length - 1].date;
    const d = new Date(last);
    d.setDate(d.getDate() + 1);
    cells.push({ date: d, outside: true });
  }

  return (
    <div className={s.miniMonthGrid}>
      {cells.map(({ date, outside }) => {
        const isToday =
          date.getFullYear() === today.getFullYear() &&
          date.getMonth() === today.getMonth() &&
          date.getDate() === today.getDate();

        const isCurrentMonth = date.getMonth() === month;

        return (
          <button
            key={date.toISOString()}
            type="button"
            onClick={() => onPick && onPick(date)}
            className={[
              s.miniMonthCell,
              !isCurrentMonth ? s.miniMonthCellOutside : "",
              isToday ? s.miniMonthCellToday : "",
            ].join(" ")}
          >
            {date.getDate()}
          </button>
        );
      })}
    </div>
  );
}