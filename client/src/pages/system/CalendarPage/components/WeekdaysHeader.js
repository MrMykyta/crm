// src/components/Calendar/WeekdaysHeader.jsx
import React from "react";
import s from "../CalendarPage.module.css";

// Компонент WeekdaysHeader: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function WeekdaysHeader({ locale = "en" }) {
  const days = Array.from({ length: 7 }, (_, idx) => {
    const date = new Date(2026, 5, 22 + idx);
    return date.toLocaleDateString(locale, { weekday: "short" });
  });
  return (
    <div className={s.weekdays}>
      {days.map((d) => (
        <div key={d}>{d}</div>
      ))}
    </div>
  );
}
