// src/components/Calendar/YearView.jsx
import React from "react";
import s from "../CalendarPage.module.css";
import MonthGrid from "./MonthGrid";

export default function YearView({ year, today, setCursor }) {
  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));

  return (
    <div className={s.yearGrid}>
      {months.map((m) => (
        <div key={m.getMonth()} className={s.yearMonth}>
          <div className={s.ymTitle}>
            {m.toLocaleString("ru-RU", { month: "long" })}
          </div>
          <MonthGrid
            baseDate={m}
            today={today}
            compact
            onClickDay={setCursor}
            yearMode
          />
        </div>
      ))}
    </div>
  );
}