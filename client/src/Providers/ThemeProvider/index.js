// src/Providers/ThemeProvider.jsx
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
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
    const mult = Math.min(200, Math.max(70, scale)) / 100; // 0.7..2.0
    document.documentElement.style.setProperty("--font-multiplier", mult);
  }, [appearance?.fontScale]);

  // ФОН: применяем через хук (под капотом предзагрузка и пр.)
  const bgUrl = appearance?.backgroundPath || null;
  useBackgroundImage(bgUrl);

  // ---- persist to LS ----
  useEffect(() => { try { localStorage.setItem(KEY_THEME, mode); } catch {} }, [mode]);
  useEffect(() => { try { localStorage.setItem(KEY_APPEAR, JSON.stringify(appearance)); } catch {} }, [appearance]);

  // ---- soft load from backend ----
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const prefs = await getMyPreferences?.(); // { themeMode, appearance:{ fontScale, backgroundPath } }
        if (dead || !prefs) return;
        if (prefs.themeMode) setModeState(prefs.themeMode);
        if (prefs.appearance && typeof prefs.appearance === "object") {
          setAppearanceState(prev => ({ ...prev, ...prefs.appearance }));
        }
      } catch {}
    })();
    return () => { dead = true; };
  }, []);

  // ---- debounced save to backend ----
  const tRef = useRef();
  const saveToBackend = (nextAppearance) => {
    clearTimeout(tRef.current);
    tRef.current = setTimeout(() => {
      saveMyPreferences?.({
        themeMode: mode,
        appearance: { ...(appearance || {}), ...(nextAppearance || {}) },
      }).catch(() => {});
    }, 350);
  };

  // ---- setters ----
  const setMode = (m) => {
    setModeState(m);
    saveToBackend();
  };

  const setAppearance = (partial) => {
    setAppearanceState(prev => {
      const next = { ...prev, ...(partial || {}) };
      saveToBackend(next);
      return next;
    });
  };

  // 🔹 Публичный сеттер фона (принимает string | null)
  const setBackground = (urlOrNull) => {
    setAppearanceState(prev => {
      const next = { ...prev, backgroundPath: urlOrNull || "" };
      saveToBackend(next);
      return next;
    });
  };

  const value = useMemo(
    () => ({
      mode, setMode, resolved,
      appearance, setAppearance,
      // экспортируем для форм «Вид»
      setBackground,
    }),
    [mode, resolved, appearance]
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}