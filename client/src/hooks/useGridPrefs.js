import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getMyPreferences, saveMyPreferences } from '../api/user';

/**
 * Единый менеджер prefs таблиц с поддержкой режимов.
 * 
 * @param {string} namespace - например: "crm.counterparties" или "companyUsers"
 * @param {object} options
 *   - mode: string | null    (например 'members'/'invites'; если null — без режимов)
 *   - lsPrefix: string       (по умолчанию "grid")
 *   - serverPath: (prefs) => object  — как достать ветку из prefs (по умолчанию: prefs.appearance.grids[namespace])
 *   - serverMerge: (prevAppearance, next) => mergedAppearance
 */
export default function useGridPrefs(namespace, { mode = null, lsPrefix = 'grid', serverPath, serverMerge } = {}) {
  const [colWidths, setColWidths] = useState({});
  const [colOrder, setColOrder] = useState([]);
  const saveTimer = useRef(null);

  // Ключи LS стандартизированы: grid.<namespace>[.<mode>].colWidths / colOrder
  const lsKeys = useMemo(() => {
    const base = `${lsPrefix}.${namespace}`;
    const suffix = mode ? `.${mode}` : '';
    return {
      widths: `${base}${suffix}.colWidths`,
      order:  `${base}${suffix}.colOrder`,
    };
  }, [lsPrefix, namespace, mode]);

  // как вытащить ветку с сервера
  const pickServerBranch = useCallback((prefs) => {
    const ap = prefs?.appearance || {};
    const grids = ap?.grids || {};
    const node = grids?.[namespace] || {};
    // если режимов нет — node — это объект с columnWidths/columnOrder;
    // если режимы есть — node[mode] содержит columnWidths/columnOrder
    return mode ? (node?.[mode] || {}) : node;
  }, [namespace, mode]);

  // как смерджить обратно (без потерь других настроек)
  const defaultServerMerge = useCallback((prevAppearance, nextBranch) => {
    const prevGrids = prevAppearance?.grids || {};
    const prevNode  = prevGrids?.[namespace] || {};
    const nextNode  = mode
      ? { 
          ...prevNode,
          [mode]: {
            ...(prevNode?.[mode] || {}),
            ...nextBranch,
          }
        }
      : { 
          ...prevNode,
          ...nextBranch 
        };

    return {
      ...prevAppearance,
      grids: {
        ...prevGrids,
        [namespace]: nextNode,
      },
    };
  }, [namespace, mode]);

  // 1) быстрый старт из localStorage
  useEffect(() => {
    try {
      const w = localStorage.getItem(lsKeys.widths);
      if (w) setColWidths(JSON.parse(w));
      const o = localStorage.getItem(lsKeys.order);
      if (o) setColOrder(JSON.parse(o));
    } catch {}
  }, [lsKeys]);

  // 2) подтянуть с сервера и смерджить (локалке приоритет)
  useEffect(() => {
    (async () => {
      try {
        const prefs = await getMyPreferences();
        const branch = (serverPath ? serverPath(prefs) : pickServerBranch(prefs)) || {};
        const fromW = branch?.columnWidths || {};
        const fromO = branch?.columnOrder  || [];
        setColWidths(prev => ({ ...fromW, ...prev }));
        setColOrder(prev => (Array.isArray(prev) && prev.length ? prev : fromO));
      } catch {}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace, mode]);

  // 3) дебаунс-сохранение
  const saveToServer = useCallback((nextW, nextO) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const prefs = await getMyPreferences();
        const prevAppearance = prefs?.appearance || {};
        const mergedAppearance = (serverMerge || defaultServerMerge)(prevAppearance, {
          columnWidths: { ...((mode ? prevAppearance?.grids?.[namespace]?.[mode]?.columnWidths : prevAppearance?.grids?.[namespace]?.columnWidths) || {}), ...(nextW ?? colWidths) },
          columnOrder: Array.isArray(nextO) ? nextO : (colOrder || []),
        });
        await saveMyPreferences({ appearance: mergedAppearance });
      } catch {}
    }, 400);
  }, [colWidths, colOrder, namespace, mode, serverMerge, defaultServerMerge]);

  // 4) публичные хендлеры
  const onColumnResize = useCallback((nextMap) => {
    setColWidths(nextMap);
    try { localStorage.setItem(lsKeys.widths, JSON.stringify(nextMap)); } catch {}
    saveToServer(nextMap, undefined);
  }, [lsKeys, saveToServer]);

  const onColumnOrderChange = useCallback((nextOrder) => {
    if (!Array.isArray(nextOrder)) return;
    setColOrder(nextOrder);
    try { localStorage.setItem(lsKeys.order, JSON.stringify(nextOrder)); } catch {}
    saveToServer(undefined, nextOrder);
  }, [lsKeys, saveToServer]);

  return { colWidths, colOrder, onColumnResize, onColumnOrderChange };
}