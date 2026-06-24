import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import s from './DateTimePicker.module.css';

const DEFAULT_WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// pad: вспомогательная логика компонента.
function pad(n) {
  return String(n).padStart(2, '0');
}

// formatISODate: форматирует данные для отображения.
function formatISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// parseISODate: парсит входные данные для UI.
function parseISODate(raw) {
  const text = String(raw || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [y, m, d] = text.split('-').map((part) => Number(part));
  const parsed = new Date(y, m - 1, d);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) return null;
  return parsed;
}

function normalizeDateBound(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  return parseISODate(text.slice(0, 10));
}

// parseTime: парсит входные данные для UI.
function parseTime(raw) {
  const text = String(raw || '').trim();
  if (!/^\d{2}:\d{2}$/.test(text)) return null;
  const [hh, mm] = text.split(':').map((part) => Number(part));
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { hh, mm };
}

// parseValue: парсит входные данные для UI.
function parseValue(raw, withTime) {
  const text = String(raw || '').trim();
  if (!text) return { date: null, time: '00:00' };

  const datePart = text.slice(0, 10);
  const date = parseISODate(datePart);
  if (!date) return { date: null, time: '00:00' };

  if (!withTime) return { date, time: '00:00' };

  const timePart = text.includes('T') ? text.slice(11, 16) : '00:00';
  const parsedTime = parseTime(timePart);
  return { date, time: parsedTime ? `${pad(parsedTime.hh)}:${pad(parsedTime.mm)}` : '00:00' };
}

// formatOutValue: форматирует данные для отображения.
function formatOutValue(date, time, withTime) {
  if (!date) return '';
  const isoDate = formatISODate(date);
  if (!withTime) return isoDate;
  const parsedTime = parseTime(time);
  const hh = parsedTime ? pad(parsedTime.hh) : '00';
  const mm = parsedTime ? pad(parsedTime.mm) : '00';
  return `${isoDate}T${hh}:${mm}`;
}

// formatDisplay: форматирует данные для отображения.
function formatDisplay(date, time, withTime) {
  if (!date) return '';
  const dd = pad(date.getDate());
  const mm = pad(date.getMonth() + 1);
  const yyyy = date.getFullYear();
  if (!withTime) return `${dd}.${mm}.${yyyy}`;
  return `${dd}.${mm}.${yyyy} ${time || '00:00'}`;
}

function normalizeLocale(language = 'en-US') {
  const normalized = String(language || 'en-US').toLowerCase();
  if (normalized.startsWith('ua') || normalized.startsWith('uk')) return 'uk-UA';
  if (normalized.startsWith('ru')) return 'ru-RU';
  if (normalized.startsWith('pl')) return 'pl-PL';
  return language || 'en-US';
}

function buildWeekdayLabels(locale, fallback = DEFAULT_WEEKDAY_LABELS) {
  const monday = new Date(2026, 5, 22);
  try {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return new Intl.DateTimeFormat(normalizeLocale(locale), { weekday: 'short' }).format(date);
    });
  } catch {
    return fallback;
  }
}

// isSameDay: проверяет условие для UI-логики.
function isSameDay(a, b) {
  return Boolean(a && b)
    && a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

// monthLabel: вспомогательная логика компонента.
function monthLabel(date, locale) {
  const raw = date.toLocaleString(normalizeLocale(locale) || undefined, { month: 'long', year: 'numeric' });
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : '';
}

const PANEL_WIDTH = 332;
const BASE_PANEL_HEIGHT = 348;
const TIME_PANEL_HEIGHT = 84;
const TOGGLE_ROW_HEIGHT = 42;

// estimatePanelHeight: вспомогательная логика компонента.
function estimatePanelHeight({ withTime, allowTimeToggle }) {
  return BASE_PANEL_HEIGHT
    + (withTime ? TIME_PANEL_HEIGHT : 0)
    + (allowTimeToggle ? TOGGLE_ROW_HEIGHT : 0);
}

// buildCells: собирает структуру данных для рендера или запроса.
function buildCells(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const firstWeekday = (first.getDay() + 6) % 7;

  const nextMonth = new Date(year, month + 1, 1);
  const daysInMonth = Math.round((nextMonth - first) / 86400000);

  const cells = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    const d = new Date(first);
    d.setDate(d.getDate() - (firstWeekday - i));
    cells.push({ date: d, outside: true });
  }

  for (let i = 1; i <= daysInMonth; i += 1) {
    cells.push({ date: new Date(year, month, i), outside: false });
  }

  while (cells.length < 42) {
    const last = cells[cells.length - 1]?.date || new Date(year, month, daysInMonth);
    const d = new Date(last);
    d.setDate(d.getDate() + 1);
    cells.push({ date: d, outside: true });
  }

  return cells;
}

// Компонент CalendarIcon: отвечает за отображение UI и обработку взаимодействий пользователя.
function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 3V5M17 3V5M4 9H20M5 5H19C19.5523 5 20 5.44772 20 6V20C20 20.5523 19.5523 21 19 21H5C4.44772 21 4 20.5523 4 20V6C4 5.44772 4.44772 5 5 5Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  );
}

// Компонент DateTimePicker: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function DateTimePicker({
  id,
  value = '',
  onChange,
  withTime = false,
  allowTimeToggle = false,
  onWithTimeChange,
  timeToggleLabel = 'With time',
  timeLabel = 'Time',
  todayLabel = 'Today',
  clearLabel = 'Clear',
  previousMonthLabel = 'Previous month',
  nextMonthLabel = 'Next month',
  openCalendarLabel = 'Open calendar',
  weekdayLabels,
  className = '',
  disabled = false,
  locale = 'en-US',
  placeholder,
  min,
  max,
  isDateDisabled,
  presets = [],
}) {
  const wrapRef = useRef(null);
  const portalId = useRef(`dt-menu-${Math.random().toString(36).slice(2)}`);

  const parsed = useMemo(() => parseValue(value, withTime), [value, withTime]);
  const selectedDate = parsed.date;
  const selectedTime = parsed.time;

  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(selectedDate || new Date());
  const [timeDraft, setTimeDraft] = useState(selectedTime || '00:00');
  const [pos, setPos] = useState(null);
  const [placementLocked, setPlacementLocked] = useState(null);
  const scrollRafRef = useRef(0);

  useEffect(() => {
    setTimeDraft(selectedTime || '00:00');
  }, [selectedTime]);

  useEffect(() => {
    if (!open) return;
    if (selectedDate) setViewDate(selectedDate);
  }, [open, selectedDate]);

  useEffect(() => {
    if (!open) {
      setPlacementLocked(null);
      setPos(null);
    }
  }, [open]);

  const computePosition = useCallback((forcedPlacement = null) => {
    const el = wrapRef.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const vw = window.innerWidth || document.documentElement.clientWidth;

    const panelHeight = estimatePanelHeight({ withTime, allowTimeToggle });
    const spaceBelow = vh - r.bottom;
    const autoPlaceAbove = spaceBelow < panelHeight + 14;
    const placeAbove = forcedPlacement != null
      ? forcedPlacement
      : (placementLocked === null ? autoPlaceAbove : placementLocked);

    const left = Math.min(Math.max(8, r.left), Math.max(8, vw - PANEL_WIDTH - 8));

    setPos({
      top: placeAbove ? r.top : r.bottom,
      left,
      width: PANEL_WIDTH,
      placeAbove,
    });

    if (placementLocked === null) {
      setPlacementLocked(placeAbove);
    }
  }, [allowTimeToggle, withTime, placementLocked]);

  const openMenu = useCallback(() => {
    if (disabled) return;
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const panelHeight = estimatePanelHeight({ withTime, allowTimeToggle });
    const placeAbove = (vh - r.bottom) < panelHeight + 14;

    setPlacementLocked(placeAbove);
    setOpen(true);
    computePosition(placeAbove);
  }, [allowTimeToggle, computePosition, disabled, withTime]);

  useLayoutEffect(() => {
    if (!open) return undefined;

    computePosition(placementLocked);

        // onDoc: вспомогательная логика компонента.
const onDoc = (e) => {
      const menu = document.getElementById(portalId.current);
      const insideWrap = wrapRef.current && wrapRef.current.contains(e.target);
      const insideMenu = menu && menu.contains(e.target);
      if (!insideWrap && !insideMenu) setOpen(false);
    };

        // onScroll: вспомогательная логика компонента.
const onScroll = () => {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = requestAnimationFrame(() => computePosition(placementLocked));
    };

        // onResize: вспомогательная логика компонента.
const onResize = () => computePosition(placementLocked);
        // onKeyDown: вспомогательная логика компонента.
const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);

    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(scrollRafRef.current);
    };
  }, [open, placementLocked, computePosition]);

  const cells = useMemo(() => buildCells(viewDate), [viewDate]);
  const minDate = useMemo(() => normalizeDateBound(min), [min]);
  const maxDate = useMemo(() => normalizeDateBound(max), [max]);
  const daysOfWeek = useMemo(
    () => (Array.isArray(weekdayLabels) && weekdayLabels.length === 7
      ? weekdayLabels
      : buildWeekdayLabels(locale)),
    [locale, weekdayLabels]
  );
  const displayValue = useMemo(
    () => formatDisplay(selectedDate, selectedTime, withTime),
    [selectedDate, selectedTime, withTime]
  );

  const isDisabledDate = useCallback((date) => {
    if (!date) return true;
    const dateOnly = parseISODate(formatISODate(date));
    if (!dateOnly) return true;
    if (minDate && dateOnly < minDate) return true;
    if (maxDate && dateOnly > maxDate) return true;
    return typeof isDateDisabled === 'function' ? Boolean(isDateDisabled(dateOnly)) : false;
  }, [isDateDisabled, maxDate, minDate]);

    // applyDate: вспомогательная логика компонента.
const applyDate = (date) => {
    if (isDisabledDate(date)) return;
    const next = formatOutValue(date, timeDraft, withTime);
    onChange?.(next);
    if (!withTime) setOpen(false);
  };

    // applyTime: вспомогательная логика компонента.
const applyTime = (nextTime) => {
    setTimeDraft(nextTime);
    if (!withTime) return;
    if (!selectedDate) return;
    onChange?.(formatOutValue(selectedDate, nextTime, true));
  };

    // onToday: вспомогательная логика компонента.
const onToday = () => {
    const now = new Date();
    if (isDisabledDate(now)) return;
    setViewDate(now);
    const defaultTime = withTime ? `${pad(now.getHours())}:${pad(now.getMinutes())}` : timeDraft;
    if (withTime) setTimeDraft(defaultTime);
    onChange?.(formatOutValue(now, defaultTime, withTime));
  };

    // onClear: вспомогательная логика компонента.
  const onClear = () => {
    onChange?.('');
    setOpen(false);
  };

  const setTimeFromText = (nextTime) => {
    const parsedTime = parseTime(nextTime);
    if (!parsedTime) {
      setTimeDraft(nextTime);
      return;
    }
    applyTime(`${pad(parsedTime.hh)}:${pad(parsedTime.mm)}`);
  };

  const menuNode = open ? (
    <div
      id={portalId.current}
      className={s.menu}
      role="dialog"
      aria-modal="false"
      style={{
        top: pos?.top || 0,
        left: pos?.left || 0,
        width: pos?.width || PANEL_WIDTH,
        transform: pos?.placeAbove ? 'translateY(calc(-100% - 10px))' : 'translateY(10px)',
        visibility: pos ? 'visible' : 'hidden',
        opacity: pos ? 1 : 0,
      }}
    >
      <div className={s.menuGlow} />

      {allowTimeToggle ? (
        <div className={s.toggleRow}>
          <span className={s.toggleLabel}>{timeToggleLabel}</span>
          <button
            type="button"
            className={clsx(s.timeModeSwitch, withTime && s.timeModeSwitchOn)}
            onClick={() => onWithTimeChange?.(!withTime)}
            aria-pressed={withTime}
          >
            <span className={clsx(s.timeModeKnob, withTime && s.timeModeKnobOn)} />
          </button>
        </div>
      ) : null}

      <div className={s.header}>
        <button
          type="button"
          className={s.navBtn}
          onClick={() => setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
          aria-label={previousMonthLabel}
        >
          ‹
        </button>
        <div className={s.monthLabel}>{monthLabel(viewDate, locale)}</div>
        <button
          type="button"
          className={s.navBtn}
          onClick={() => setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
          aria-label={nextMonthLabel}
        >
          ›
        </button>
      </div>

      <div className={s.weekdays}>
        {daysOfWeek.map((day) => (
          <span key={day} className={s.weekday}>{day}</span>
        ))}
      </div>

      <div className={s.grid}>
        {cells.map(({ date, outside }) => {
          const isTodayDate = isSameDay(date, new Date());
          const isSelected = isSameDay(date, selectedDate);
          const isDateBlocked = isDisabledDate(date);
          return (
            <button
              key={date.toISOString()}
              type="button"
              className={clsx(
                s.day,
                outside && s.dayOutside,
                isTodayDate && s.dayToday,
                isSelected && s.daySelected,
                isDateBlocked && s.dayDisabled
              )}
              onClick={() => applyDate(date)}
              disabled={isDateBlocked}
            >
              <span className={s.dayInner}>{date.getDate()}</span>
            </button>
          );
        })}
      </div>

      {withTime ? (
        <div className={s.timeCard}>
          <div className={s.timeCardHead}>{timeLabel}</div>
          <input
            id={`${portalId.current}-time`}
            type="text"
            inputMode="numeric"
            placeholder="HH:mm"
            value={timeDraft}
            className={s.timeInput}
            onChange={(e) => setTimeFromText(e.target.value)}
            onBlur={() => {
              const parsedTime = parseTime(timeDraft);
              setTimeDraft(parsedTime ? `${pad(parsedTime.hh)}:${pad(parsedTime.mm)}` : selectedTime || '00:00');
            }}
          />
        </div>
      ) : null}

      {Array.isArray(presets) && presets.length ? (
        <div className={s.presets}>
          {presets.map((preset) => (
            <button
              key={preset.value || preset.label}
              type="button"
              className={s.secondaryBtn}
              onClick={() => {
                const date = parseISODate(String(preset.value || '').slice(0, 10));
                if (date) applyDate(date);
              }}
              disabled={!preset.value || isDisabledDate(parseISODate(String(preset.value).slice(0, 10)))}
            >
              {preset.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className={s.footer}>
        <button type="button" className={s.secondaryBtn} onClick={onToday}>{todayLabel}</button>
        <button type="button" className={s.secondaryBtn} onClick={onClear}>{clearLabel}</button>
      </div>
    </div>
  ) : null;

  return (
    <div className={s.wrap} ref={wrapRef}>
      <input
        id={id}
        className={clsx(s.input, className)}
        value={displayValue}
        onFocus={openMenu}
        onClick={openMenu}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (open) {
              setOpen(false);
            } else {
              openMenu();
            }
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            openMenu();
          }
        }}
        readOnly
        placeholder={placeholder || (withTime ? 'yyyy-mm-dd hh:mm' : 'yyyy-mm-dd')}
        disabled={disabled}
      />
      <button
        type="button"
        className={s.toggleBtn}
        onClick={() => {
          if (disabled) return;
          if (open) {
            setOpen(false);
            return;
          }
          openMenu();
        }}
        tabIndex={-1}
        aria-label={openCalendarLabel}
      >
        <CalendarIcon />
      </button>
      {open && menuNode ? createPortal(menuNode, document.body) : null}
    </div>
  );
}
