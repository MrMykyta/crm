// hooks/useTabsPrefs.js

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../Providers/ThemeProvider";

// неглубокое сравнение массивов строк
const eqArr = (a, b) =>
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length === b.length &&
  a.every((v, i) => v === b[i]);

/**
 * Источник правды: ThemeProvider.appearance.tabs[namespace]
 * - чтение: из ui.appearance (ThemeProvider уже гидратит бэк)
 * - запись: setAppearance({ tabs: { ... } }) — ThemeProvider сам сохранит на бэк
 */
export default function useTabsPrefs(
  namespace,
  { items = [], defaultExpanded = false } = {}
) {
  const { appearance, setAppearance } = useTheme();

  // ----- READ -----
  const srvBranch = appearance?.tabs?.[namespace] || {};
  const srvOrder = Array.isArray(srvBranch.order) ? srvBranch.order : [];

  // стабильный список всех ключей
  const allKeys = useMemo(() => items.map((i) => i.key), [items]);

  // нормализуем: берём то, что есть на сервере, + добавляем новые хвостом
  const normalizedOrder = useMemo(() => {
    const set = new Set(allKeys);
    const kept = srvOrder.filter((k) => set.has(k));
    const seen = new Set(kept);
    for (const k of allKeys) if (!seen.has(k)) kept.push(k);
    return kept; // новый массив — ОК, ниже проверим eqArr
  }, [srvOrder, allKeys]);

  const [orderKeys, setOrderKeysState] = useState(normalizedOrder);
  const [expanded, setExpandedState] = useState(
    typeof srvBranch.expanded === "boolean"
      ? srvBranch.expanded
      : defaultExpanded
  );

  // подтягиваем сервер/LS только при реальном отличии
  useEffect(() => {
    setOrderKeysState((prev) => (eqArr(prev, normalizedOrder) ? prev : normalizedOrder));
  }, [normalizedOrder]);

  useEffect(() => {
    const next =
      typeof srvBranch.expanded === "boolean"
        ? srvBranch.expanded
        : defaultExpanded;
    setExpandedState((prev) => (prev === next ? prev : next));
  }, [srvBranch.expanded, defaultExpanded]);

  // ----- WRITE -----
  const setOrderKeys = (keys) => {
    if (!Array.isArray(keys) || !keys.length) return;
    setOrderKeysState((prev) => (eqArr(prev, keys) ? prev : keys));
    const tabs = appearance?.tabs || {};
    const prev = tabs[namespace] || {};
    setAppearance({
      tabs: {
        ...tabs,
        [namespace]: { ...prev, order: keys },
      },
    });
  };

  const setExpanded = (val) => {
    const next = !!val;
    setExpandedState((prev) => (prev === next ? prev : next));
    const tabs = appearance?.tabs || {};
    const prev = tabs[namespace] || {};
    setAppearance({
      tabs: {
        ...tabs,
        [namespace]: { ...prev, expanded: next },
      },
    });
  };

  // итоговый список элементов в правильном порядке
  const orderedItems = useMemo(() => {
    const byKey = new Map(items.map((i) => [i.key, i]));
    const out = [];
    const seen = new Set();
    for (const k of orderKeys) if (byKey.has(k)) { out.push(byKey.get(k)); seen.add(k); }
    for (const it of items) if (!seen.has(it.key)) out.push(it);
    return out;
  }, [items, orderKeys]);

  return { orderedItems, orderKeys, setOrderKeys, expanded, setExpanded };
}