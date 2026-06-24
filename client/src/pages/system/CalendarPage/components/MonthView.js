// src/components/Calendar/MonthView.jsx
import React from "react";
import s from "../CalendarPage.module.css";
import WeekdaysHeader from "./WeekdaysHeader";
import MonthGridMonth from "./MonthGridMonth";

// Компонент MonthView: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function MonthView({
  baseDate,
  today,
  selectedDate,
  setCursor,
  calendarItems = [],
  onItemOpen,
  onCreateFromDate,
  locale = "en",
}) {
  return (
    <div className={s.monthShell}>
      <WeekdaysHeader locale={locale} />
      <MonthGridMonth
        baseDate={baseDate}
        today={today}
        selectedDate={selectedDate}
        onClickDay={setCursor}
        calendarItems={calendarItems}
        onItemOpen={onItemOpen}
        onCreateFromDate={onCreateFromDate}
        locale={locale}
      />
    </div>
  );
}
