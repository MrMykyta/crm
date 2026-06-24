// src/components/Calendar/WeekView.jsx
import React, { useMemo, useRef, useState } from "react";
import s from "../CalendarPage.module.css";
import { isSameDay, toKey } from "./dateUtils";
import CurrentTimeLineWeek from "./CurrentTimeLineWeek";

// Компонент WeekView: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function WeekView({
  baseDate,
  today,
  selectedDate,
  calendarItems = [],
  onItemOpen,
  onCreateFromDate,
  locale = "en",
  labels = {},
}) {
  // считаем понедельник
  const start = useMemo(() => {
    const weekStart = new Date(baseDate);
    const day = weekStart.getDay();
    const diff = (day + 6) % 7;
    weekStart.setDate(weekStart.getDate() - diff);
    return weekStart;
  }, [baseDate]);

  const scrollRef = useRef(null);
  const [allDayModal, setAllDayModal] = useState(null); // {day, events, rect}

  // 7 дней
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
      }),
    [start]
  );

  // открыть модалку all-day
  const openAllDayList = (dayDate, events, el) => {
    const rect = el?.getBoundingClientRect();
    setAllDayModal({
      day: dayDate,
      events,
      rect,
    });
  };

    // closeAllDay: закрывает связанный UI-элемент.
const closeAllDay = () => setAllDayModal(null);

  // высота полоски all-day у каждого дня — фикс
  const ALLDAY_H = 42;

  return (
    <div className={s.weekView}>
      {/* шапка */}
      <div className={s.weekHeader}>
        <div className={s.timeColHeaderSticky}></div>
        {days.map((d) => {
          const isToday = isSameDay(d, today);
          const isSelected = selectedDate && isSameDay(d, selectedDate);
          const dayName = d.toLocaleString(locale, { weekday: "long" });
          const dayNum = d.getDate();
          return (
            <div
              key={d.toISOString()}
              className={[
                s.weekDayHead,
                isToday ? s.weekDayHeadToday : "",
                isSelected ? s.weekDayHeadSelected : "",
              ].join(" ")}
            >
              <div className={s.weekDayName}>
                {dayName.charAt(0).toUpperCase() + dayName.slice(1)}
              </div>
              <div className={s.weekDayNumber}>{dayNum}</div>
            </div>
          );
        })}
      </div>

      {/* тело */}
      <div className={s.weekBody}>
        <div ref={scrollRef} className={s.weekScrollWrap}>
          {/* линия сейчас — сдвигаем на ALLDAY_H */}
          <CurrentTimeLineWeek offsetTop={ALLDAY_H} />

          {/* колонка времени */}
          <div className={s.timeCol}>
            <div className={s.timeColAllDay} style={{ height: ALLDAY_H }}>
              {labels.allDay || "All day"}
            </div>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className={s.timeSlot}>
                {h}:00
              </div>
            ))}
          </div>

          {/* 7 колонок */}
          <div className={s.weekScroll}>
            {days.map((d) => {
              const key = toKey(d);
              const raw = calendarItems.filter((item) => item.dateKey === key);
              const allDay = raw.filter((e) => e.allDay);
              const timed = raw.filter((e) => !e.allDay);
              const isToday = isSameDay(d, today);
              const isSelected = selectedDate && isSameDay(d, selectedDate);

              // что показать в ячейке
              const MAX_SHOW = 1;
              const shown = allDay.slice(0, MAX_SHOW);
              const restCount = allDay.length - shown.length;

              return (
                <div
                  key={key}
                  className={[
                    s.weekDayCol,
                    isToday ? s.weekTodayCol : "",
                    isSelected ? s.weekSelectedCol : "",
                  ].join(" ")}
                >
                  {/* полоска all-day у КОНКРЕТНОГО дня */}
                  <div className={s.dayAllDayStrip} style={{ height: ALLDAY_H }} onDoubleClick={() => onCreateFromDate?.(d)}>
                    {shown.map((ev) => (
                      <div
                        key={ev.id}
                        className={[
                          s.allDayChip,
                          s.taskPill,
                          ev.completed ? s.taskPillCompleted : "",
                          ev.overdue ? s.taskPillOverdue : "",
                        ].join(" ")}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (allDay.length > 1) openAllDayList(d, allDay, e.currentTarget);
                          else onItemOpen?.(ev);
                        }}
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {restCount > 0 && (
                      <button
                        type="button"
                        className={s.allDayMoreBtn}
                        onClick={(e) => openAllDayList(d, allDay, e.currentTarget)}
                      >
                        +{restCount}
                      </button>
                    )}
                  </div>

                  {/* фон по часам */}
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className={s.weekHourBg} onDoubleClick={() => onCreateFromDate?.(d)}></div>
                  ))}

                  {/* обычные события */}
                  {timed.map((ev) => {
                    const startMin = Number.isFinite(ev.startMinutes) ? ev.startMinutes : 0;
                    const endMin = Number.isFinite(ev.endMinutes) ? ev.endMinutes : startMin + 60;
                    const dur = Math.max(30, endMin - startMin);
                    const top = (startMin / 60) * 48 + ALLDAY_H; // ниже полоски мы не сдвигаем — потому что её высота фикс и она sticky
                    const height = (dur / 60) * 48;
                    return (
                      <div
                        key={ev.id}
                        className={[
                          s.weekEvent,
                          s.taskEvent,
                          ev.completed ? s.taskPillCompleted : "",
                          ev.overdue ? s.taskPillOverdue : "",
                        ].join(" ")}
                        style={{ top: `${top}px`, height: `${height}px` }}
                        onClick={() => onItemOpen?.(ev)}
                      >
                        <div className={s.weekEventTitle}>{ev.title}</div>
                        <div className={s.weekEventTime}>
                          {ev.start} – {ev.end}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* модалка с all-day */}
      {allDayModal && (
        <div className={s.allDayModalBackdrop} onClick={closeAllDay}>
          <div
            className={s.allDayModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={s.allDayModalHeader}>
              {labels.allDayTasksOn || "All-day tasks on"} {allDayModal.day.toLocaleDateString(locale)}
            </div>
            <div className={s.allDayModalList}>
              {allDayModal.events.map((ev) => (
                <button key={ev.id} type="button" className={s.allDayModalItem} onClick={() => onItemOpen?.(ev)}>
                  {ev.title}
                </button>
              ))}
            </div>
            <div className={s.allDayModalFooter}>
              <button onClick={closeAllDay}>{labels.close || "Close"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
