// src/components/Calendar/MonthView.jsx
import React from "react";
import s from "../CalendarPage.module.css";
import WeekdaysHeader from "./WeekdaysHeader";
import MonthGridMonth from "./MonthGridMonth";

export default function MonthView({ baseDate, today, setCursor, onEventOpen }) {
  return (
    <div className={s.monthShell}>
      <WeekdaysHeader />
      <MonthGridMonth
        baseDate={baseDate}
        today={today}
        onClickDay={setCursor}
        onEventOpen={onEventOpen}
      />
    </div>
  );
}