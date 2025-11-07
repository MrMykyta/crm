// src/components/Calendar/DayView.jsx
import React from "react";
import s from "../CalendarPage.module.css";
import { isSameDay } from "./dateUtils";
import CurrentTimeLineWeek from "./CurrentTimeLineWeek";

export default function DayView({ baseDate, today }) {
  const isToday = isSameDay(baseDate, today);

  const events = [
    { id: "d1", title: "W – Prawo międzynarodowe cz. 1", start: "11:45", end: "13:15", color: "orange" },
    { id: "d2", title: "CK – Sojusze strategiczne",     start: "13:30", end: "15:00", color: "violet" },
    { id: "d3", title: "W – Seks i tabu",                start: "15:15", end: "16:45", color: "orange" },
    { id: "d4", title: "W – Metodologia badań...",       start: "17:00", end: "18:30", color: "orange" },
  ];

  const toMinutes = (hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };

  return (
    <div className={s.dayView}>
      <div className={s.dayHeader}>
        <div className={s.dayTitle}>
          {baseDate.toLocaleString("ru-RU", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>
      </div>

      <div className={s.dayBody}>
        <div className={s.dayScroll}>
          {isToday && <CurrentTimeLineWeek offsetTop={0} />}

          <div className={s.timeCol}>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className={s.timeSlot}>
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          <div className={s.dayCol}>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className={s.weekHourBg}></div>
            ))}

            {events.map((ev) => {
              const startMin = toMinutes(ev.start);
              const endMin = toMinutes(ev.end);
              const dur = endMin - startMin;
              const top = (startMin / 60) * 48;
              const height = (dur / 60) * 48;

              return (
                <div
                  key={ev.id}
                  className={[
                    s.weekEvent,
                    ev.color === "violet" ? s.weekEventViolet : s.weekEventOrange,
                  ].join(" ")}
                  style={{ top: `${top}px`, height: `${height}px`, left: "8px", right: "8px" }}
                >
                  <div className={s.weekEventTitle}>{ev.title}</div>
                  <div className={s.weekEventTime}>
                    {ev.start} – {ev.end}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}