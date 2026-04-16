// src/components/Calendar/WeekView.jsx
import React, { useMemo, useRef, useState } from "react";
import s from "../CalendarPage.module.css";
import { isSameDay, toKey } from "./dateUtils";
import CurrentTimeLineWeek from "./CurrentTimeLineWeek";

// Компонент WeekView: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function WeekView({ baseDate, today, onEventOpen }) {
  // считаем понедельник
  const start = new Date(baseDate);
  const day = start.getDay();
  const diff = (day + 6) % 7;
  start.setDate(start.getDate() - diff);

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

  // фейк-данные: делаем чтобы были дни с 3+ all-day
  const fakeEvents = useMemo(() => {
    const m = {};
    // пн
    m[toKey(days[0])] = [
      { id: "a1", title: "💜 Весь день ПН", allDay: true, color: "violet" },
      { id: "a2", title: "💜 ПН второй", allDay: true, color: "violet" },
      { id: "a3", title: "💜 ПН третий", allDay: true, color: "violet" },
      { id: "p1", title: "Пара 11:45", start: "11:45", end: "13:15", color: "orange" },
    ];
    // вт
    m[toKey(days[1])] = [
      { id: "b1", title: "💜 Вторник", allDay: true, color: "violet" },
      { id: "b2", title: "CK – Sojusze", start: "13:30", end: "15:00", color: "violet" },
    ];
    // ср
    m[toKey(days[2])] = [
      { id: "c1", title: "Статистика", start: "13:30", end: "15:00", color: "violet" },
    ];
    // чт
    m[toKey(days[3])] = [
      { id: "d1", title: "💜 Чт all-day", allDay: true, color: "violet" },
      { id: "d2", title: "Методология", start: "17:00", end: "18:30", color: "orange" },
    ];
    // пт
    m[toKey(days[4])] = [
      { id: "f1", title: "💜 Пт 1", allDay: true, color: "violet" },
      { id: "f2", title: "💜 Пт 2", allDay: true, color: "violet" },
      { id: "f3", title: "💜 Пт 3", allDay: true, color: "violet" },
      { id: "f4", title: "💜 Пт 4", allDay: true, color: "violet" },
      { id: "f5", title: "W – Prawo", start: "11:45", end: "13:15", color: "orange" },
    ];
    // сб вс
    m[toKey(days[5])] = [];
    m[toKey(days[6])] = [];
    return m;
  }, [days]);

    // toMinutes: вспомогательная логика компонента.
const toMinutes = (hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };

  // открыть событие обычное
  const openTimed = (ev, dayDate, el) => {
    if (!onEventOpen) return;
    const rect = el?.getBoundingClientRect();
    onEventOpen({ ...ev, date: dayDate.toISOString() }, rect);
  };

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
          const dayName = d.toLocaleString("ru-RU", { weekday: "long" });
          const dayNum = d.getDate();
          return (
            <div key={d.toISOString()} className={`${s.weekDayHead} ${isToday ? s.weekDayHeadToday : ""}`}>
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
              весь день
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
              const raw = fakeEvents[key] || [];
              const allDay = raw.filter((e) => e.allDay);
              const timed = raw.filter((e) => !e.allDay);
              const isToday = isSameDay(d, today);

              // что показать в ячейке
              const MAX_SHOW = 1;
              const shown = allDay.slice(0, MAX_SHOW);
              const restCount = allDay.length - shown.length;

              return (
                <div key={key} className={`${s.weekDayCol} ${isToday ? s.weekTodayCol : ""}`}>
                  {/* полоска all-day у КОНКРЕТНОГО дня */}
                  <div className={s.dayAllDayStrip} style={{ height: ALLDAY_H }}>
                    {shown.map((ev) => (
                      <div
                        key={ev.id}
                        className={s.allDayChip}
                        onClick={(e) => openAllDayList(d, allDay, e.currentTarget)}
                        onDoubleClick={(e) => openAllDayList(d, allDay, e.currentTarget)}
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
                    <div key={h} className={s.weekHourBg}></div>
                  ))}

                  {/* обычные события */}
                  {timed.map((ev) => {
                    const startMin = toMinutes(ev.start);
                    const endMin = toMinutes(ev.end);
                    const dur = endMin - startMin;
                    const top = (startMin / 60) * 48 + ALLDAY_H; // ниже полоски мы не сдвигаем — потому что её высота фикс и она sticky
                    const height = (dur / 60) * 48;
                    return (
                      <div
                        key={ev.id}
                        className={[
                          s.weekEvent,
                          ev.color === "violet" ? s.weekEventViolet : s.weekEventOrange,
                        ].join(" ")}
                        style={{ top: `${top}px`, height: `${height}px` }}
                        onDoubleClick={(e) => openTimed(ev, d, e.currentTarget)}
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
              Все события на {allDayModal.day.toLocaleDateString("ru-RU")}
            </div>
            <div className={s.allDayModalList}>
              {allDayModal.events.map((ev) => (
                <div key={ev.id} className={s.allDayModalItem}>
                  {ev.title}
                </div>
              ))}
            </div>
            <div className={s.allDayModalFooter}>
              <button onClick={closeAllDay}>Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
