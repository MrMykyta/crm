import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import s from './Dashboard.module.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

const ROW_HEIGHT = 13;          // px на ряд
const MARGIN = [12, 12];        // [marginX, marginY]
const CONTAINER_PADDING = [0, 0];
const ROW_CEIL_BIAS = 0.2;
const STORAGE_KEY = 'dashboard.layouts.v5';

/* ================= helpers ================= */

const rowsFromPx = (px) => {
  // Высота элемента в RGL: H = rows*ROW_HEIGHT + (rows-1)*marginY
  const perRow = ROW_HEIGHT + MARGIN[1];
  const raw = (px + MARGIN[1]) / perRow;
  // Небольшой запас вверх, чтобы не занижать
  return Math.max(1, Math.ceil(raw - ROW_CEIL_BIAS));
};

const clampLayouts = (ls) => {
  const lg = (ls?.lg ?? []).map(it => {
    const minW = Math.max(it.minW ?? 1, 1);
    const minH = Math.max(it.minH ?? 1, 1);
    const w = Math.max(it.w ?? minW, minW);
    const h = Math.max(it.h ?? minH, minH);
    // фиксируем набор хэндлов
    const resizeHandles = it.resizeHandles ?? ['e','s','se'];
    return { ...it, minW, minH, w, h, resizeHandles };
  });
  return { ...ls, lg };
};

const jsonEqual = (a, b) => {
  try { return JSON.stringify(a) === JSON.stringify(b); }
  catch { return false; }
};

function useElemHeight() {
  const ref = useRef(null);
  const [h, setH] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setH(entry.contentRect.height));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, h];
}

/* ================= demo widget ================= */

function KpiWidget() {
  return (
    <>
      <div className={`${s.header} drag-handle`}>
        <span>Показатели</span>
        <button className={s.more} onClick={(e)=>e.stopPropagation()}>⋮</button>
      </div>
      <div className={s.kpiRow}>
        <div className={s.kpi}><div className={s.kpiVal}>42</div><div className={s.kpiLabel}>Лиды</div></div>
        <div className={s.kpi}><div className={s.kpiVal}>18</div><div className={s.kpiLabel}>Сделки</div></div>
        <div className={s.kpi}><div className={s.kpiVal}>7</div><div className={s.kpiLabel}>Заказы</div></div>
      </div>
    </>
  );
}

/* ================= Card ================= */

function Card({ id, currentH, onAutoMinH, paused, children }) {
  // ВАЖНО: меряем ВЕСЬ блок карточки (включая хедер и паддинги),
  // чтобы minH точно соответствовал реальной визуальной высоте
  const [cardRef, cardHeight] = useElemHeight();

  useEffect(() => {
    if (paused) return;
    if (!cardHeight) return;

    const rows = rowsFromPx(cardHeight);

    // поднимаем только если реально не влазит
    if (rows > currentH) {
      onAutoMinH(id, rows);
    }
  }, [cardHeight, currentH, id, onAutoMinH, paused]);

  return (
    <div ref={cardRef} className={s.card}>
      <div className={s.content}>{children}</div>

      {/* хэндлы: справа / снизу / правый-нижний угол */}
      <span className="react-resizable-handle react-resizable-handle-e" />
      <span className="react-resizable-handle react-resizable-handle-s" />
      <span className="react-resizable-handle react-resizable-handle-se" />
    </div>
  );
}

/* ================= Dashboard ================= */

export default function Dashboard() {
  const [layouts, setLayouts] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return clampLayouts(JSON.parse(saved));
    } catch {}
    // стартовые размеры; minW/minH скромные, дальше карточка поднимет minH сама
    return clampLayouts({
      lg: [
        { i:'kpi', x:0, y:0, w:3, h:6, minW:3, minH:6, resizeHandles:['e','s','se'] },
      ],
    });
  });

  const [paused, setPaused] = useState(false);

  const hMap = useMemo(() => {
    const map = new Map();
    (layouts.lg || []).forEach(it => map.set(it.i, it.h));
    return map;
  }, [layouts]);

  const saveLayouts = useCallback((ls) => {
    const next = clampLayouts(ls);
    if (jsonEqual(next, layouts)) return;      // НЕ трогаем state, если по факту без изменений
    setLayouts(next);
    try { 
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); 
    } catch {}
  }, [layouts]);

  // Мин-высота поднимается, но не опускается; мемо через useCallback
  const handleAutoMinH = useCallback((id, rows) => {
    saveLayouts({
      ...layouts,
      lg: (layouts.lg || []).map(it =>
        it.i === id
          ? {
              ...it,
              minH: Math.max(it.minH ?? 1, rows),
              h:    Math.max(it.h    ?? rows, rows),
            }
          : it
      )
    });
  }, [layouts, saveLayouts]);

  return (
    <div className={s.wrap}>
      <ResponsiveGridLayout
        className={s.grid}
        layouts={layouts}
        cols={{ lg:12, md:12, sm:6, xs:4, xxs:2 }}
        rowHeight={ROW_HEIGHT}
        margin={MARGIN}
        containerPadding={CONTAINER_PADDING}
        autoSize
        isDraggable
        isResizable
        draggableHandle=".drag-handle"
        preventCollision={false}
        compactType={null}
        isBounded={false}
        resizeHandles={['e','s','se']}

        onLayoutChange={(_, all) => saveLayouts(all)}

        onDragStart={() => setPaused(true)}
        onDragStop={() => setPaused(false)}

        onResizeStart={() => setPaused(true)}
        onResizeStop={(layout) => {
          setPaused(false);
          saveLayouts({ ...layouts, lg: layout });
        }}
      >
        <div key="kpi">
          <Card
            id="kpi"
            currentH={hMap.get('kpi') || 1}
            onAutoMinH={handleAutoMinH}
            paused={paused}
          >
            <KpiWidget/>
          </Card>
        </div>
      </ResponsiveGridLayout>
    </div>
  );
}