import { useLayoutEffect, useRef, useState } from "react";
import styles from "./TabBar.module.css";

export default function TabBar({ items, activeKey, onChange }){
  const contRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [wrapNeeded, setWrapNeeded] = useState(false);

  useLayoutEffect(() => {
    const el = contRef.current;
    if(!el) return;
    const check = () => setWrapNeeded(el.scrollWidth > el.clientWidth + 8);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items]);

  return (
    <div className={styles.shell}>
      <div
        ref={contRef}
        className={`${styles.tabs} ${expanded ? styles.expanded : ""}`}
        role="tablist"
        aria-label="Закладки объекта"
      >
        {items.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={t.key===activeKey}
            className={`${styles.tab} ${t.key===activeKey ? styles.active : ""}`}
            onClick={() => onChange(t.key)}
            title={t.label}
          >
            {t.label}
            <span className={styles.pin} aria-hidden>✶</span>
            <span className={styles.close} aria-hidden>✕</span>
          </button>
        ))}
      </div>

      {wrapNeeded && (
        <button
          className={styles.chevron}
          onClick={() => setExpanded(v=>!v)}
          aria-label={expanded ? "Свернуть закладки" : "Развернуть закладки"}
        >
          {expanded ? "▴" : "▾"}
        </button>
      )}
    </div>
  );
}