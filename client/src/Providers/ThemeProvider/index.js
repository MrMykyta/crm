// src/Providers/ThemeProvider.jsx
import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import useBackgroundImage from "../../hooks/useBackgroundImage";
import { getMyPreferences, saveMyPreferences } from "../../api/user";

const KEY_THEME  = "theme";           // 'dark' | 'light' | 'system'
const KEY_APPEAR = "ui.appearance";   // { fontScale:number, backgroundPath?:string }

const ThemeCtx = createContext(null);
export const useTheme = () => useContext(ThemeCtx);

export default function ThemeProvider({ children }) {
  // ---- init from LS ----
  const [mode, setModeState] = useState(() => localStorage.getItem(KEY_THEME) || "system");
  const [appearance, setAppearanceState] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY_APPEAR) || "{}"); }
    catch { return {}; }
  });

  // ---- refs с актуальным снимком (чтобы не брать старое из замыканий) ----
  const modeRef = useRef(mode);
  const appRef  = useRef(appearance);
  useEffect(()=>{ modeRef.current = mode; }, [mode]);
  useEffect(()=>{ appRef.current  = appearance; }, [appearance]);

  // системная тема
  const [system, setSystem] = useState(() =>
    matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  );
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = e => setSystem(e.matches ? "dark" : "light");
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  const resolved = mode === "system" ? system : mode;

  // применяем тему
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolved);
    const cssBg = getComputedStyle(root).getPropertyValue("--bg").trim();
    if (cssBg) root.style.background = cssBg;
  }, [resolved]);

  // масштаб шрифта
  useEffect(() => {
    const scale = Number(appearance?.fontScale ?? 100);
    const mult  = Math.min(200, Math.max(70, scale)) / 100; // 0.7..2.0
    document.documentElement.style.setProperty("--font-multiplier", mult);
  }, [appearance?.fontScale]);

  // фон (строка)
  useBackgroundImage(appearance?.backgroundPath || null);

  // persist в LS
  useEffect(() => { try { localStorage.setItem(KEY_THEME, mode); } catch {} }, [mode]);
  useEffect(() => { try { localStorage.setItem(KEY_APPEAR, JSON.stringify(appearance)); } catch {} }, [appearance]);

  // ---- анти-гонки: гидратация и дебаунс ----
  const isHydratingRef = useRef(false);
  const didHydrateRef  = useRef(false);
  const saveTimerRef   = useRef(null);

  // сохраняем ВСЕГДА из ref (актуальные значения), + можно передать патч appearance
  const saveToBackend = useCallback((appearancePatch) => {
    if (isHydratingRef.current) return; // во время гидратации НЕ шлём
    clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      const latestMode = modeRef.current;
      const latestApp  = appRef.current;
      const mergedApp  = { ...(latestApp || {}), ...(appearancePatch || {}) };

      saveMyPreferences({
        themeMode: latestMode,
        appearance: mergedApp,
      }).catch(()=>{});
    }, 300);
  }, []);

  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  // ---- гидратация один раз (StrictMode-safe) ----
  const hydrateFromServer = useCallback(async () => {
    if (didHydrateRef.current) return;
    didHydrateRef.current = true;

    isHydratingRef.current = true;
    try {
      if (localStorage.getItem('accessToken')) {
        const { pref } = await getMyPreferences().catch(()=>({}));
        if (!pref) return;

        if (pref.themeMode) setModeState(pref.themeMode);

        // маппинг background.url → appearance.backgroundPath (если локально не задан)
        const nextAppearance = { ...(pref.appearance || {}) };
        if (!nextAppearance.backgroundPath && pref.background?.url) {
          nextAppearance.backgroundPath = String(pref.background.url);
        }
        if (Object.keys(nextAppearance).length) {
          setAppearanceState(prev => ({ ...prev, ...nextAppearance }));
        }
      }
    } finally {
      isHydratingRef.current = false;
    }
  }, []);

  useEffect(() => { hydrateFromServer(); }, [hydrateFromServer]);

  // ---- публичные сеттеры (без старого theme) ----
  const setMode = (m) => {
    setModeState(m);
    // modeRef обновится эффектом; чтобы не тащить старый theme — сохранение читает modeRef.current
    saveToBackend();
  };

  const setAppearance = (partial) => {
    setAppearanceState(prev => {
      const next = { ...prev, ...(partial || {}) };
      // сразу шлём патч; сохранение соберёт СВЕЖИЙ снимок из ref
      saveToBackend(partial);
      return next;
    });
  };

  // строка или falsy → кладём в appearance.backgroundPath
  const setBackground = (urlOrNull) => {
    setAppearanceState(prev => {
      const patch = { backgroundPath: urlOrNull || "" };
      const next  = { ...prev, ...patch };
      saveToBackend(patch);
      return next;
    });
  };

  const value = useMemo(() => ({
    mode, setMode, resolved,
    appearance, setAppearance,
    setBackground,
    hydrateFromServer,
  }), [mode, resolved, appearance, hydrateFromServer]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}