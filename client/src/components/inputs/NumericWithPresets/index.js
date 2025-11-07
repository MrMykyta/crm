import React from "react";
import styles from "./NumericWithPresets.module.css";

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
  const ref = React.useRef(null);

  const parse = (raw) => {
    if (raw === "" || raw == null) return allowEmpty ? "" : "";
    const n = Number(raw);
    return Number.isNaN(n) ? "" : n;
  };

  const handleChange = (e) => {
    const next = parse(e.target.value);
    onChange(next);
  };

  const handleBlur = () => {
    if (value === "" || value == null) return;
    let n = Number(value);
    if (Number.isNaN(n)) return;
    if (integer) n = Math.round(n);
    if (clampOnBlur) n = Math.max(min, Math.min(max, n));
    if (n !== value) onChange(n);
  };

  // клик вне меню
  React.useEffect(() => {
    const onDoc = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className={`${styles.wrap} ${styles[size]} ${className}`} ref={ref} style={style}>
      <div className={styles.inputRow}>
        <input
          type="text"
          inputMode={integer ? "numeric" : "decimal"}
          className={styles.input}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
        />
        <button
          type="button"
          className={styles.arrowBtn}
          onClick={() => setOpen(o => !o)}
          disabled={disabled}
        >
          ▾
        </button>
      </div>

      {open && (
        <div className={styles.menu}>
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
      )}
    </div>
  );
}