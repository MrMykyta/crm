// src/components/Calendar/components/EventModal.jsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import s from "../CalendarPage.module.css";

const COLORS = [
  { key: "orange", label: "Оранжевый" },
  { key: "violet", label: "Фиолетовый" },
  { key: "red", label: "Красный" },
];

export default function EventModal({ event, pos, onClose, onSave }) {
  const modalRef = useRef(null);

  // локальные стейты
  const [title, setTitle] = useState(event.title || "");
  const [location, setLocation] = useState(event.location || "");
  const [allDay, setAllDay] = useState(!!event.allDay);
  const [start, setStart] = useState(event.start || "11:00");
  const [end, setEnd] = useState(event.end || "12:00");
  const [color, setColor] = useState(event.color || "orange");

  // Esc
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // клик вне
  useEffect(() => {
    const handleClick = (e) => {
      if (modalRef.current && modalRef.current.contains(e.target)) return;
      onClose();
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // формат даты (просто текст)
  const dateStr = event.date
    ? new Date(event.date).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const handleSave = () => {
    const payload = {
      ...event,
      title,
      location,
      allDay,
      start,
      end,
      color,
    };
    onSave && onSave(payload);
    onClose();
  };

  if (!event) return null;

  return createPortal(
    <div
      ref={modalRef}
      className={s.eventModal}
      style={{
        top: pos.top,
        left: pos.left,
      }}
    >
      <div className={s.eventModalHeader}>
        <div className={s.eventModalTitle}>{event.title}</div>
        <button className={s.eventModalCloseBtn} onClick={onClose} aria-label="close">
          ×
        </button>
      </div>

      {/* поле: название */}
      <div className={s.eventModalSection}>
        <label className={s.eventLabel}>Название</label>
        <input
          className={s.eventInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* поле: место */}
      <div className={s.eventModalSection}>
        <label className={s.eventLabel}>Место / адрес</label>
        <input
          className={s.eventInput}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Добавить место или видеовызов"
        />
      </div>

      {/* дата и время */}
      <div className={s.eventModalSection}>
        <label className={s.eventLabel}>Дата и время</label>
        <div className={s.eventDateRow}>
          <div className={s.eventDateText}>{dateStr}</div>
          <label className={s.eventCheckbox}>
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
            />
            Весь день
          </label>
        </div>
        {!allDay && (
          <div className={s.timeRow}>
            <input
              type="time"
              className={s.eventInput}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
            <span className={s.timeSep}>—</span>
            <input
              type="time"
              className={s.eventInput}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* цвет */}
      <div className={s.eventModalSection}>
        <label className={s.eventLabel}>Цвет</label>
        <div className={s.colorRow}>
          {COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setColor(c.key)}
              className={`${s.colorDot} ${color === c.key ? s.colorDotActive : ""} ${
                s["colorDot-" + c.key] || ""
              }`}
            />
          ))}
        </div>
      </div>

      {/* футер */}
      <div className={s.eventModalFooter}>
        <button className={s.eventModalBtnDelete} onClick={() => alert("TODO: удалить")}>
          Удалить
        </button>
        <button className={s.eventModalBtnOpen} onClick={handleSave}>
          Сохранить
        </button>
      </div>
    </div>,
    document.body
  );
}