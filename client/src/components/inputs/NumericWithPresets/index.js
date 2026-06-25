import React from "react";
import { createPortal } from "react-dom";
import styles from "./NumericWithPresets.module.css";

const VIEWPORT_MARGIN = 8;
const ITEM_HEIGHT = 40;

// Компонент NumericWithPresets: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function NumericWithPresets({
  value = "",
  onChange = () => {},
  min = 0,
  max = 100,
  step = 1,
  integer = true,
  clampOnBlur = true,
  allowEmpty = false,
  presets = [10, 25, 50, 75, 100],
  placeholder,
  disabled = false,
  size = "md",
  className = "",
  style,
}) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState({ top: 0, left: 0, width: 0, placeAbove: false });
  const ref = React.useRef(null);
  const portalId = React.useRef(`numeric-presets-${Math.random().toString(36).slice(2)}`);

  const computePosition = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const menuHeight = Math.min(Math.max((presets.length || 1) * ITEM_HEIGHT + 12, 52), 260);
    const spaceBelow = vh - r.bottom;
    const spaceAbove = r.top;
    const fieldBelowMiddle = (r.top + (r.height / 2)) > (vh / 2);
    const hasRoomAbove = spaceAbove >= menuHeight + 8;
    const hasRoomBelow = spaceBelow >= menuHeight + 8;
    const placeAbove = (fieldBelowMiddle && hasRoomAbove) || (!hasRoomBelow && hasRoomAbove);
    const width = Math.min(
      Math.max(r.width, 120),
      Math.max(120, vw - (VIEWPORT_MARGIN * 2))
    );
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, r.left),
      Math.max(VIEWPORT_MARGIN, vw - width - VIEWPORT_MARGIN)
    );
    setPos({
      top: placeAbove ? r.top : r.bottom,
      left,
      width,
      placeAbove,
    });
  }, [presets.length]);

  const openMenu = React.useCallback(() => {
    if (disabled) return;
    computePosition();
    setOpen(true);
  }, [computePosition, disabled]);

    // parse: парсит входные данные для UI.
const parse = (raw) => {
    if (raw === "" || raw == null) return allowEmpty ? "" : "";
    const n = Number(raw);
    return Number.isNaN(n) ? "" : n;
  };

    // handleChange: обработчик пользовательского действия.
const handleChange = (e) => {
    const next = parse(e.target.value);
    openMenu();
    onChange(next);
  };

    // handleBlur: обработчик пользовательского действия.
const handleBlur = () => {
    if (value === "" || value == null) return;
    let n = Number(value);
    if (Number.isNaN(n)) return;
    if (integer) n = Math.round(n);
    if (clampOnBlur) n = Math.max(min, Math.min(max, n));
    if (n !== value) onChange(n);
  };

  React.useEffect(() => {
    const onDoc = (e) => {
      if (!ref.current) return;
      const menu = document.getElementById(portalId.current);
      const insideControl = ref.current.contains(e.target);
      const insideMenu = menu && menu.contains(e.target);
      if (!insideControl && !insideMenu) setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc, true);
    return () => document.removeEventListener("pointerdown", onDoc, true);
  }, []);

  React.useEffect(() => {
    if (!open) return undefined;
    computePosition();
    const onRecalc = () => computePosition();
    window.addEventListener("resize", onRecalc);
    window.addEventListener("scroll", onRecalc, true);
    return () => {
      window.removeEventListener("resize", onRecalc);
      window.removeEventListener("scroll", onRecalc, true);
    };
  }, [computePosition, open]);

  const menuNode = open ? (
    <div
      id={portalId.current}
      className={styles.menu}
      style={{
        top: pos.top,
        left: pos.left,
        width: pos.width,
        transform: pos.placeAbove ? "translateY(calc(-100% - 6px))" : "translateY(6px)",
        visibility: pos.width ? "visible" : "hidden",
      }}
    >
      {presets.map((p) => (
        <button
          key={p}
          type="button"
          className={`${styles.item} ${Number(value) === p ? styles.active : ""}`}
          onClick={() => { onChange(p); setOpen(false); }}
        >
          {p}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div className={`${styles.wrap} ${styles[size]} ${className}`} ref={ref} style={style}>
      <div className={styles.inputRow}>
        <input
          type="text"
          inputMode={integer ? "numeric" : "decimal"}
          className={styles.input}
          value={value}
          onChange={handleChange}
          onFocus={openMenu}
          onClick={openMenu}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
        />
        <span
          className={`${styles.arrowBtn} ${open ? styles.arrowBtnOpen : ""}`}
          aria-hidden="true"
        />
      </div>

      {open && menuNode ? createPortal(menuNode, document.body) : null}
    </div>
  );
}
