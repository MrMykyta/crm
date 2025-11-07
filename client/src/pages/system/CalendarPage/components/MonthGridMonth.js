// src/components/Calendar/components/MonthGridMonth.jsx
import React from "react";
import s from "../CalendarPage.module.css";
import { isSameDay, toKey } from "./dateUtils";

export default function MonthGridMonth({ baseDate, today, onClickDay, onEventOpen }) {
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

  // demo-events
  const fakeEvents = {
    [toKey(new Date())]: [
      {
        id: "1",
        title: "W – Prawo międzynarodowe cz. 1",
        color: "red",
        start: "11:45",
        end: "13:15",
        location: "ul. Narutowicza 59a",
      },
      {
        id: "2",
        title: "CK – Sojusze стратегiczne",
        color: "violet",
        start: "13:30",
        end: "15:00",
      },
    ],
  };

  return (
    <div className={s.monthGridMonth}>
      {days.map(({ date, outside }) => {
        const isToday = isSameDay(date, today);
        const weekday = date.getDay();
        const isWeekend = weekday === 0 || weekday === 6;
        const isFirstOfMonth = date.getDate() === 1;
        const events = fakeEvents[toKey(date)] || [];

        return (
          <div
            key={date.toISOString()}
            className={[
              s.monthCell,
              outside ? s.monthCellOutside : "",
              isToday ? s.monthCellToday : "",
              isWeekend ? s.monthCellWeekend : "",
            ].join(" ")}
            onClick={() => onClickDay && onClickDay(date)}
          >
            <div className={s.monthCellHeader}>
              <span className={isFirstOfMonth ? s.monthCellOtherMonthTitle : s.monthCellDay}>
                {isFirstOfMonth
                  ? `1 ${date.toLocaleString("ru-RU", { month: "short" })}`
                  : date.getDate()}
              </span>
            </div>

            <div className={s.monthCellEvents}>
              {events.map((ev) => (
                <div
                    key={ev.id}
                    className={`${s.eventPill} ${
                      ev.color === "red"
                        ? s.eventRed
                        : ev.color === "violet"
                        ? s.eventViolet
                        : ""
                    }`}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (!onEventOpen) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      onEventOpen(
                        {
                          ...ev,
                          date: date.toISOString(),
                          dateReadable: date.toLocaleDateString("ru-RU", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          }),
                        },
                        rect
                      );
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