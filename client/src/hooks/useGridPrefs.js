// hooks/useGridPrefs.js

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../Providers/ThemeProvider";

/**
 * Источник правды: ThemeProvider.appearance.grids[namespace][mode?]
 * - чтение из ui.appearance (ThemeProvider уже гидратит сервер)
 * - запись через setAppearance (ThemeProvider сам дебаунс-сохранит на бэк)
 */
export default function useGridPrefs(
  namespace,
  { mode = null } = {}
) {
  const { appearance, setAppearance } = useTheme();

  const branch = appearance?.grids?.[namespace] || {};
  const leaf   = mode ? (branch?.[mode] || {}) : branch;

  const [colWidths, setColWidths] = useState(leaf?.columnWidths || {});
  const [colOrder,  setColOrder]  = useState(Array.isArray(leaf?.columnOrder) ? leaf.columnOrder : []);

  // подтягиваем, когда приехало из ThemeProvider или сменился режим
  useEffect(() => {
    const b = appearance?.grids?.[namespace] || {};
    const l = mode ? (b?.[mode] || {}) : b;
    setColWidths(l?.columnWidths || {});
    setColOrder(Array.isArray(l?.columnOrder) ? l.columnOrder : []);
  }, [appearance?.grids, namespace, mode]);

  const savePatch = (patch) => {
    const grids = appearance?.grids || {};
    const node  = grids[namespace] || {};
    const nextLeaf = { ...(mode ? node?.[mode] : node), ...patch };

    setAppearance({
      grids: {
        ...grids,
        [namespace]: mode
          ? { ...node, [mode]: nextLeaf }
          : nextLeaf,
      },
    });
  };

  const onColumnResize = (next) => {
    setColWidths(next);
    savePatch({ columnWidths: next });
  };

  const onColumnOrderChange = (nextOrder) => {
    if (!Array.isArray(nextOrder)) return;
    setColOrder(nextOrder);
    savePatch({ columnOrder: nextOrder });
  };

  return { colWidths, colOrder, onColumnResize, onColumnOrderChange };
}