// hooks/useGridPrefs.js

import { useCallback, useEffect, useState } from "react";
import { useTheme } from "../Providers/ThemeProvider";

export const DEFAULT_GRID_VIEW_ID = "__default";

// normalizeSavedViews: нормализует входные и выходные данные.
function normalizeSavedViews(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  return input
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const id = String(item.id || "").trim();
      if (!id || seen.has(id) || id === DEFAULT_GRID_VIEW_ID) return null;
      seen.add(id);
      return {
        id,
        name: String(item.name || "").trim() || "Без имени",
        state: item.state && typeof item.state === "object" ? { ...item.state } : {},
        createdAt: item.createdAt || null,
        updatedAt: item.updatedAt || null,
      };
    })
    .filter(Boolean);
}

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
  const [colVisibility, setColVisibility] = useState(
    leaf?.columnVisibility && typeof leaf.columnVisibility === "object"
      ? leaf.columnVisibility
      : {}
  );
  const [savedViews, setSavedViews] = useState(normalizeSavedViews(leaf?.savedViews));
  const [activeViewId, setActiveViewId] = useState(
    typeof leaf?.activeViewId === "string" && leaf.activeViewId
      ? leaf.activeViewId
      : DEFAULT_GRID_VIEW_ID
  );

  // подтягиваем, когда приехало из ThemeProvider или сменился режим
  useEffect(() => {
    const b = appearance?.grids?.[namespace] || {};
    const l = mode ? (b?.[mode] || {}) : b;
    setColWidths(l?.columnWidths || {});
    setColOrder(Array.isArray(l?.columnOrder) ? l.columnOrder : []);
    setColVisibility(
      l?.columnVisibility && typeof l.columnVisibility === "object"
        ? l.columnVisibility
        : {}
    );
    setSavedViews(normalizeSavedViews(l?.savedViews));
    setActiveViewId(
      typeof l?.activeViewId === "string" && l.activeViewId
        ? l.activeViewId
        : DEFAULT_GRID_VIEW_ID
    );
  }, [appearance?.grids, namespace, mode]);

  const savePatch = useCallback((patch) => {
    setAppearance((prevAppearance) => {
      const grids = prevAppearance?.grids || {};
      const node = grids[namespace] || {};
      const currentLeaf = mode ? (node?.[mode] || {}) : node;
      const nextLeaf = { ...currentLeaf, ...patch };

      return {
        grids: {
          ...grids,
          [namespace]: mode
            ? { ...node, [mode]: nextLeaf }
            : nextLeaf,
        },
      };
    });
  }, [mode, namespace, setAppearance]);

  const onColumnResize = useCallback((next) => {
    setColWidths(next);
    savePatch({ columnWidths: next });
  }, [savePatch]);

  const onColumnOrderChange = useCallback((nextOrder) => {
    if (!Array.isArray(nextOrder)) return;
    setColOrder(nextOrder);
    savePatch({ columnOrder: nextOrder });
  }, [savePatch]);

  const onColumnVisibilityChange = useCallback((nextVisibility) => {
    if (!nextVisibility || typeof nextVisibility !== "object") return;
    setColVisibility(nextVisibility);
    savePatch({ columnVisibility: nextVisibility });
  }, [savePatch]);

  const resetGridPrefs = useCallback(() => {
    const reset = {
      columnWidths: {},
      columnOrder: [],
      columnVisibility: {},
    };
    setColWidths(reset.columnWidths);
    setColOrder(reset.columnOrder);
    setColVisibility(reset.columnVisibility);
    savePatch(reset);
  }, [savePatch]);

  const onSavedViewsChange = useCallback((nextViews) => {
    if (!Array.isArray(nextViews)) return;
    const normalized = normalizeSavedViews(nextViews);
    setSavedViews(normalized);
    savePatch({ savedViews: normalized });
  }, [savePatch]);

  const onActiveViewChange = useCallback((nextViewId) => {
    const normalized = String(nextViewId || "").trim() || DEFAULT_GRID_VIEW_ID;
    setActiveViewId(normalized);
    savePatch({ activeViewId: normalized });
  }, [savePatch]);

  const resetSavedViews = useCallback(() => {
    setSavedViews([]);
    setActiveViewId(DEFAULT_GRID_VIEW_ID);
    savePatch({ savedViews: [], activeViewId: DEFAULT_GRID_VIEW_ID });
  }, [savePatch]);

  return {
    colWidths,
    colOrder,
    colVisibility,
    savedViews,
    activeViewId,
    onColumnResize,
    onColumnOrderChange,
    onColumnVisibilityChange,
    onSavedViewsChange,
    onActiveViewChange,
    resetGridPrefs,
    resetSavedViews,
  };
}

