// src/components/Calendar/YearView.jsx
import React from "react";
import s from "../CalendarPage.module.css";
import MonthGrid from "./MonthGrid";

// Компонент YearView: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function YearView({ year, today, selectedDate, setCursor, locale = "en" }) {
  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));

  return (
    <div className={s.yearGrid}>
      {months.map((m) => (
        <div key={m.getMonth()} className={s.yearMonth}>
          <div className={s.ymTitle}>
            {m.toLocaleString(locale, { month: "long" })}
          </div>
          <MonthGrid
            baseDate={m}
            today={today}
            selectedDate={selectedDate}
            compact
            onClickDay={setCursor}
            yearMode
          />
        </div>
      ))}
    </div>
  );
}
