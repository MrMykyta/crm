import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import s from "./TabBar.module.css";

const sameOrder = (a, b) =>
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length === b.length &&
  a.every((x, i) => x?.key === b[i]?.key);

export default function TabBar({
  items = [],
  activeKey,
  onChange,
  onReorder,
  collapsedHeight = 40,
  reserveButtonWidth = 44,
  animationMs = 260,
  expanded: expandedProp,
  onExpandedChange,
}) {
  // ----- expanded -----
  const [expandedLocal, setExpandedLocal] = useState(false);
  const expanded =
    typeof expandedProp === "boolean" ? expandedProp : expandedLocal;
  const setExpanded = (v) => {
    onExpandedChange?.(!!v);
    if (typeof expandedProp !== "boolean") setExpandedLocal(!!v);
  };

  // ----- layout -----
  const [needsToggle, setNeedsToggle] = useState(false);

  // ----- order + DnD -----
  const [order, setOrder] = useState(items);
  const dragIndexRef = useRef(-1);
  const [draggingIndex, setDraggingIndex] = useState(-1);

  // тут будем хранить ПОСЛЕДНИЙ свап именно по КЛЮЧАМ,
  // чтобы сразу же второй такой же не делать
  const lastPairRef = useRef({ a: null, b: null });

  // dom-узлы для FLIP
  const nodeMap = useRef(new Map());
  const setNodeRef = useCallback((key) => (el) => {
    if (el) nodeMap.current.set(key, el);
    else nodeMap.current.delete(key);
  }, []);

  // синхронизация с items
  useEffect(() => {
    if (dragIndexRef.current !== -1) return;
    if (sameOrder(order, items)) return;
    setOrder(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const scrollerRef = useRef(null);
  const frameRef = useRef(null);
  const measureRef = useRef(null);

  const ordered = useMemo(() => order, [order]);

  // показать кнопку при переполнении
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const calc = () => {
      if (expanded) return;
      setNeedsToggle(el.scrollWidth > el.clientWidth);
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [expanded, ordered.length]);

  // считать высоту для раскрытого состояния
  useEffect(() => {
    const frame = frameRef.current;
    const meas = measureRef.current;
    if (!frame || !meas) return;
    meas.classList.add(s.__measuring);
    const full = Math.max(meas.scrollHeight, collapsedHeight);
    meas.classList.remove(s.__measuring);
    frame.style.setProperty("--content-h", `${full}px`);
  }, [expanded, ordered.length, collapsedHeight]);

  /* ---------- FLIP ---------- */
  const readRects = () => {
    const rects = new Map();
    ordered.forEach((it) => {
      const el = nodeMap.current.get(it.key);
      if (el) rects.set(it.key, el.getBoundingClientRect());
    });
    return rects;
  };

  const durByDist = (dx, dy) => {
    const dist = Math.hypot(dx, dy);
    return Math.min(520, Math.max(140, 120 + dist * 0.45));
  };

  const flipAnimate = (prevRects, nextOrder) => {
    setOrder(nextOrder);

    requestAnimationFrame(() => {
      const prefersNoMotion =
        window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

      (ordered || []).forEach((it) => {
        const el = nodeMap.current.get(it.key);
        if (!el) return;

        const prev = prevRects.get(it.key);
        const next = el.getBoundingClientRect();
        if (!prev) return;

        const dx = prev.left - next.left;
        const dy = prev.top - next.top;
        if (Math.abs(dx) < 0.65 && Math.abs(dy) < 0.5) return;

        el.classList.add(s.animating);
        el.style.transition = "none";
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        el.style.willChange = "transform";

        requestAnimationFrame(() => {
          const ms = prefersNoMotion ? 0 : durByDist(dx, dy);
          el.style.transition = `transform ${ms}ms cubic-bezier(.2,.7,.2,1)`;
          el.style.transform = `translate(0, 0)`;

          const onEnd = () => {
            el.classList.remove(s.animating);
            el.style.transition = "";
            el.style.transform = "";
            el.style.willChange = "";
            el.removeEventListener("transitionend", onEnd);
          };
          el.addEventListener("transitionend", onEnd, { once: true });
        });
      });
    });
  };

  /* ---------- DnD ---------- */
  const setEmptyDragImage = (e) => {
    const img = new Image();
    img.src =
      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz4=";
    e.dataTransfer.setDragImage(img, 0, 0);
  };

  const onDragStart = (e, index) => {
    dragIndexRef.current = index;
    setDraggingIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
    setEmptyDragImage(e);
    // при старте чистим
    lastPairRef.current = { a: null, b: null };
  };

  const isNeighbour = (i1, i2) => Math.abs(i1 - i2) === 1;

  const onDragEnter = (e, overIndex) => {
    const from = dragIndexRef.current;
    if (from < 0) return;
    if (from === overIndex) return;

    const fromKey = order[from]?.key;
    const overKey = order[overIndex]?.key;
    if (!fromKey || !overKey) return;

    const last = lastPairRef.current;

    // если сейчас мы НЕ над соседом (перетащили дальше чем на 1),
    // то считаем, что "застревание" прошло — можно снова свапать
    if (!isNeighbour(from, overIndex)) {
      lastPairRef.current = { a: null, b: null };
    }

    // проверка на повтор именно этой пары
    const isSamePair =
      last.a &&
      last.b &&
      ((last.a === fromKey && last.b === overKey) ||
        (last.a === overKey && last.b === fromKey));

    if (isSamePair) {
      // застряли ровно между двумя — не даём второй такой же swap
      // console.log("[DnD] skip repeat pair", fromKey, overKey);
      return;
    }

    // обычный твой код
    const prevRects = readRects();
    const next = order.slice();
    const [moved] = next.splice(from, 1);
    next.splice(overIndex, 0, moved);

    // запоминаем пару ТОЛЬКО если это реальные соседи
    if (isNeighbour(from, overIndex)) {
      lastPairRef.current = { a: fromKey, b: overKey };
    } else {
      // если прыгнули дальше чем на 1 — не фиксируем, это не "карусель"
      lastPairRef.current = { a: null, b: null };
    }

    dragIndexRef.current = overIndex;
    flipAnimate(prevRects, next);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const finishDragAndSave = () => {
    setDraggingIndex(-1);
    dragIndexRef.current = -1;
    lastPairRef.current = { a: null, b: null };
    onReorder?.(order.slice());
    console.log("[DnD] finish", order.map((x) => x.key));
  };

  const onDrop = (e) => {
    e.preventDefault();
    finishDragAndSave();
  };

  const onDragEnd = () => {
    finishDragAndSave();
  };

  const isDraggingAny = draggingIndex !== -1;

  return (
    <div
      className={`${s.wrap} ${expanded ? s.expanded : s.collapsed}`}
      ref={frameRef}
      style={{
        "--collapsed-h": `${collapsedHeight}px`,
        "--reserve-w": `${reserveButtonWidth}px`,
        "--anim-ms": `${animationMs}ms`,
      }}
    >
      <div className={s.frame}>
        <div
          ref={measureRef}
          className={s.track}
          style={{ gridTemplateColumns: needsToggle || expanded ? "1fr auto" : "1fr" }}
        >
          <div
            className={s.scroller}
            ref={scrollerRef}
            style={{ paddingRight: !expanded && needsToggle ? reserveButtonWidth : 0 }}
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            {order.map((tab, i) => {
              const isActive = tab.key === activeKey;
              const isDragging = i === draggingIndex;
              return (
                <button
                  key={tab.key}
                  ref={setNodeRef(tab.key)}
                  type="button"
                  className={`${s.tab} ${isActive ? s.active : ""} ${isDragging ? s.dragging : ""}`}
                  title={String(tab.label)}
                  onClick={() => onChange?.(tab.key)}
                  draggable={isDragging || !isDraggingAny}
                  onMouseDown={(ev) => {
                    if (isDraggingAny && !isDragging) ev.preventDefault();
                  }}
                  onDragStart={(e) => onDragStart(e, i)}
                  onDragEnter={(e) => onDragEnter(e, i)}
                  onDragEnd={onDragEnd}
                >
                  <span className={s.label}>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {(needsToggle || expanded) && (
            <button
              type="button"
              className={s.toggle}
              aria-expanded={expanded}
              aria-label={expanded ? "Свернуть" : "Развернуть"}
              onClick={() => setExpanded(!expanded)}
            >
              <svg viewBox="0 0 24 24" className={s.chev} aria-hidden>
                <polyline points="6,9 12,15 18,9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}