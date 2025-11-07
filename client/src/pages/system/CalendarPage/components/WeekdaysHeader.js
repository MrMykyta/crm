// src/components/Calendar/WeekdaysHeader.jsx
import React from "react";
import s from "../CalendarPage.module.css";

export default function WeekdaysHeader() {
  const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  return (
    <div className={s.weekdays}>
      {days.map((d) => (
        <div key={d}>{d}</div>
      ))}
    </div>
  );
}