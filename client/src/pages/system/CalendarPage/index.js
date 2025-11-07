// src/components/Calendar/CalendarPage.jsx
import React, { useState, useRef, useLayoutEffect, useEffect } from "react";
import { createPortal } from "react-dom";
import s from "./CalendarPage.module.css";

import YearView from "./components/YearView";
import MonthView from "./components/MonthView";
import WeekView from "./components/WeekView";
import DayView from "./components/DayView";
import MiniMonth from "./components/MiniMonth";
import EventModal from "./components/EventModal";

const VIEW = {
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
  YEAR: "year",
};

const IconCalendar = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
    <rect x="4" y="5" width="16" height="15" rx="3" ry="3" stroke="currentColor" strokeWidth="1.4" fill="none" />
    <line x1="4" y1="9" x2="20" y2="9" stroke="currentColor" strokeWidth="1.2" />
    <circle cx="9" cy="13" r="0.9" fill="currentColor" />
    <circle cx="13" cy="13" r="0.9" fill="currentColor" />
    <circle cx="17" cy="13" r="0.9" fill="currentColor" />
  </svg>
);

const IconInbox = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
    <path
      d="M4.5 5.5h15l-1.2 10.5a2 2 0 0 1-2 1.8h-8.6a2 2 0 0 1-2-1.8L4.5 5.5Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
    <path
      d="M8 13.5h2.4a1.6 1.6 0 0 0 3.2 0H16"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconPlus = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.4" fill="none" />
    <line x1="12" y1="8.2" x2="12" y2="15.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <line x1="8.2" y1="12" x2="15.8" y2="12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const IconSearch = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
    <circle cx="11" cy="11" r="4.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
    <line x1="15" y1="15" x2="19" y2="19" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

export default function CalendarPage() {
  const [view, setView] = useState(VIEW.MONTH);
  const [cursor, setCursor] = useState(() => new Date());

  // выпадающий список годов
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [yearDropdownPos, setYearDropdownPos] = useState({ top: 0, left: 0, width: 180 });
  const yearBtnRef = useRef(null);

  // модалка события
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventPos, setEventPos] = useState({ top: 120, left: 420 });

  const today = new Date();
  const yearNumber = cursor.getFullYear();
  const monthLabel = cursor.toLocaleString("ru-RU", {
    month: "long",
    year: "numeric",
  });

  const goToday = () => {
    const d = new Date();
    setCursor(d);
    setView(VIEW.DAY);
  };

  const shift = (dir) => {
    const base = new Date(cursor);
    if (view === VIEW.YEAR) base.setFullYear(base.getFullYear() + dir);
    else if (view === VIEW.MONTH) base.setMonth(base.getMonth() + dir);
    else if (view === VIEW.WEEK) base.setDate(base.getDate() + dir * 7);
    else base.setDate(base.getDate() + dir);
    setCursor(base);
  };

  // список годов вокруг текущего
  const years = [];
  for (let y = yearNumber - 5; y <= yearNumber + 5; y++) years.push(y);

  // позиция дропа годов
  useLayoutEffect(() => {
    if (yearPickerOpen && yearBtnRef.current) {
      const rect = yearBtnRef.current.getBoundingClientRect();
      setYearDropdownPos({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width + 40,
      });
    }
  }, [yearPickerOpen]);

  // клик мимо — закрыть дроп годов
  useEffect(() => {
    if (!yearPickerOpen) return;
    const onClick = (e) => {
      if (yearBtnRef.current && yearBtnRef.current.contains(e.target)) return;
      setYearPickerOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [yearPickerOpen]);

  // открыть модалку события (месяц/неделя будут вызывать это)
  const handleEventOpen = (eventData, rect, scrollableRef) => {
    // 1) автоскролл (если неделя передала свой контейнер)
    if (scrollableRef && scrollableRef.current) {
      const wrap = scrollableRef.current;
      const targetTop = rect.top + wrap.scrollTop - 120; // чуть выше
      wrap.scrollTo({
        top: targetTop < 0 ? 0 : targetTop,
        behavior: "smooth",
      });
    }

    // 2) автоопределение стороны
    const margin = 16;
    const modalWidth = 340; // можно чуть шире
    const viewportW = window.innerWidth;
    const rightSpace = viewportW - rect.right;
    let left;

    if (rightSpace > modalWidth + margin) {
      // справа хватает
      left = rect.right + margin;
    } else if (rect.left - modalWidth - margin > 0) {
      // слева хватает
      left = rect.left - modalWidth - margin;
    } else {
      // ни слева, ни справа — прижмём к краю
      left = viewportW - modalWidth - margin;
    }

    setSelectedEvent(eventData);
    setEventPos({
      top: rect.top + window.scrollY,
      left: Math.max(12, left),
    });
  };

  const handleEventClose = () => setSelectedEvent(null);

  return (
    <div className={s.wrap}>
      {/* ===== TOPBAR ===== */}
      <div className={s.topbar}>
        {/* LEFT */}
        <div className={s.topbarLeft}>
          <div className={s.iconGroup}>
            <button type="button" className={s.iconBtn} aria-label="calendar view">
              <IconCalendar />
            </button>
            <button type="button" className={s.iconBtn} aria-label="inbox">
              <IconInbox />
            </button>
            <button type="button" className={s.iconBtn} aria-label="add event">
              <IconPlus />
            </button>
          </div>

          {view === VIEW.YEAR ? (
            <div className={s.yearPickerWrap}>
              <button
                type="button"
                ref={yearBtnRef}
                className={s.yearPickerBtn}
                onClick={() => setYearPickerOpen((v) => !v)}
              >
                {yearNumber}
                <span className={s.chevronSmall} aria-hidden />
              </button>
            </div>
          ) : (
            <div className={s.monthTitle}>
              {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
            </div>
          )}
        </div>

        {/* CENTER */}
        <div className={s.topbarCenter}>
          <div className={s.segmentSimple}>
            <div className={s.segmentSlider} data-view={view} />
            <div className={`${s.segmentItem} ${view === VIEW.DAY ? s.segmentItemActive : ""}`}>
              <button
                onClick={() => {
                  setView(VIEW.DAY);
                  setYearPickerOpen(false);
                }}
              >
                День
              </button>
            </div>
            <div className={`${s.segmentItem} ${view === VIEW.WEEK ? s.segmentItemActive : ""}`}>
              <button
                onClick={() => {
                  setView(VIEW.WEEK);
                  setYearPickerOpen(false);
                }}
              >
                Неделя
              </button>
            </div>
            <div className={`${s.segmentItem} ${view === VIEW.MONTH ? s.segmentItemActive : ""}`}>
              <button
                onClick={() => {
                  setView(VIEW.MONTH);
                  setYearPickerOpen(false);
                }}
              >
                Месяц
              </button>
            </div>
            <div className={`${s.segmentItem} ${view === VIEW.YEAR ? s.segmentItemActive : ""}`}>
              <button
                onClick={() => {
                  setView(VIEW.YEAR);
                  // не закрываем dropdown
                }}
              >
                Год
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className={s.topbarRight}>
          <div className={s.nav}>
            <button onClick={() => shift(-1)} aria-label="previous period" className={s.navBtn}>
              ‹
            </button>
            <button onClick={goToday} className={`${s.navBtn} ${s.todayBtn}`}>
              Сегодня
            </button>
            <button onClick={() => shift(1)} aria-label="next period" className={s.navBtn}>
              ›
            </button>
          </div>
          <button className={s.iconBtn} aria-label="search">
            <IconSearch />
          </button>
        </div>
      </div>

      {/* ===== PORTAL: YEAR DROPDOWN ===== */}
      {yearPickerOpen &&
        createPortal(
          <div
            className={s.yearDropdownPortal}
            style={{
              top: yearDropdownPos.top,
              left: yearDropdownPos.left,
              minWidth: yearDropdownPos.width,
            }}
          >
            {years.map((y) => (
              <button
                key={y}
                type="button"
                className={`${s.yearDropdownItem} ${y === yearNumber ? s.yearDropdownItemActive : ""}`}
                onClick={() => {
                  const d = new Date(cursor);
                  d.setFullYear(y);
                  setCursor(d);
                  setYearPickerOpen(false);
                }}
              >
                {y}
              </button>
            ))}
          </div>,
          document.body
        )}

      {/* ===== BODY ===== */}
      <div className={view === VIEW.DAY ? s.bodyWithSide : s.bodyFull}>
        <div className={view === VIEW.YEAR ? `${s.main} ${s.mainYear}` : s.main}>
          {view === VIEW.YEAR && (
            <YearView year={yearNumber} today={today} setCursor={setCursor} />
          )}
          {view === VIEW.MONTH && (
            <MonthView
              baseDate={cursor}
              today={today}
              setCursor={setCursor}
              onEventOpen={handleEventOpen}
            />
          )}
          {view === VIEW.WEEK && (
            <WeekView baseDate={cursor} today={today} onEventOpen={handleEventOpen} />
          )}
          {view === VIEW.DAY && <DayView baseDate={cursor} today={today} />}
        </div>

        {view === VIEW.DAY && (
          <aside className={s.side}>
            <MiniMonth date={cursor} today={today} onPick={setCursor} />
          </aside>
        )}
      </div>

      {/* ===== EVENT MODAL ===== */}
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          pos={eventPos}
          onClose={handleEventClose}
        />
      )}
    </div>
  );
}