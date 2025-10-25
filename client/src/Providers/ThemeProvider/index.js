import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import useBrandAndBackground from "../../hooks/useBrandAndBackground";
import { getMyPreferences, saveMyPreferences } from "../../api/user";

const KEY_THEME = "theme"; // 'dark' | 'light' | 'system'
const KEY_APPEAR = "ui.appearance"; // { fontScale:number, backgroundPath?:string }

const ThemeCtx = createContext(null);
export const useTheme = () => useContext(ThemeCtx);

export default function ThemeProvider({ children }) {
  /* ------------------- локальное состояние ------------------- */
  const [mode, setModeState] = useState(() => localStorage.getItem(KEY_THEME) || "system");
  const [appearance, setAppearanceState] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY_APPEAR) || "{}");
    } catch {
      return {};
    }
  });

  // refs для debounce-сейва
  const modeRef = useRef(mode);
  const appRef = useRef(appearance);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    appRef.current = appearance;
  }, [appearance]);

  /* ------------------- системная тема ------------------- */
  const [system, setSystem] = useState(() =>
    matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  );
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setSystem(e.matches ? "dark" : "light");
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  const resolved = mode === "system" ? system : mode;

  /* ------------------- применение темы ------------------- */
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolved);
    const cssBg = getComputedStyle(root).getPropertyValue("--bg").trim();
    if (cssBg) root.style.background = cssBg;
  }, [resolved]);

  /* ------------------- типографика ------------------- */
  useEffect(() => {
    const scale = Number(appearance?.fontScale ?? 100);
    const mult = Math.min(200, Math.max(70, scale)) / 100; // 0.7..2.0
    document.documentElement.style.setProperty("--font-multiplier", mult);
  }, [appearance?.fontScale]);

  /* ------------------- фон + аватары ------------------- */
  const companyId = localStorage.getItem("companyId") || undefined;

  // читаем user.avatarUrl из localStorage, если есть
  let userAvatarUrl = "";
  try {
    const raw = localStorage.getItem("user");
    if (raw) userAvatarUrl = JSON.parse(raw)?.avatarUrl || "";
  } catch {
    userAvatarUrl = "";
  }

  useBrandAndBackground(appearance?.backgroundPath || null, {
    companyId,
    initialAvatarUrl: undefined,
    userAvatarUrl,
  });

  /* ------------------- persist в LS ------------------- */
  useEffect(() => {
    try {
      localStorage.setItem(KEY_THEME, mode);
    } catch {}
  }, [mode]);
  useEffect(() => {
    try {
      localStorage.setItem(KEY_APPEAR, JSON.stringify(appearance));
    } catch {}
  }, [appearance]);

  /* ------------------- debounce save to backend ------------------- */
  const isHydratingRef = useRef(false);
  const saveTimerRef = useRef(null);

  const saveToBackend = useCallback((appearancePatch) => {
    if (isHydratingRef.current) return;
    clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      const latestMode = modeRef.current;
      const latestApp = appRef.current;
      const mergedApp = { ...(latestApp || {}), ...(appearancePatch || {}) };

      saveMyPreferences({
        themeMode: latestMode,
        appearance: mergedApp,
      }).catch(() => {});
    }, 300);
  }, []);
  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  /* ------------------- парсинг префов ------------------- */
  const parsePrefs = (raw) => {
    const pref = raw?.pref ?? raw ?? {};
    const themeMode = pref.themeMode ?? pref.theme ?? undefined;
    const nextAppearance = { ...(pref.appearance || {}) };
    if (!nextAppearance.backgroundPath && pref.background?.url) {
      nextAppearance.backgroundPath = String(pref.background.url);
    }
    return { themeMode, appearance: nextAppearance };
  };

  /* ------------------- гидратация ------------------- */
  const hydrateFromServer = useCallback(async () => {
    if (!localStorage.getItem("accessToken")) return;
    if (isHydratingRef.current) return;

    isHydratingRef.current = true;
    try {
      const raw = await getMyPreferences().catch(() => null);
      if (!raw) return;

      const { themeMode, appearance: serverApp } = parsePrefs(raw);
      if (themeMode) setModeState(themeMode);
      if (serverApp && Object.keys(serverApp).length) {
        setAppearanceState((prev) => ({ ...serverApp, ...prev }));
      }
    } finally {
      isHydratingRef.current = false;
    }
  }, []);

  useEffect(() => {
    hydrateFromServer();
  }, [hydrateFromServer]);

  /* ------------------- события ------------------- */
  useEffect(() => {
    const onLoggedIn = () => hydrateFromServer();
    const onHydrateAppearance = (e) => {
      const patch = e?.detail && typeof e.detail === "object" ? e.detail : null;
      if (patch) {
        setAppearanceState((prev) => {
          const next = { ...prev, ...patch };
          saveToBackend(patch);
          return next;
        });
      } else {
        hydrateFromServer();
      }
    };
    window.addEventListener("auth:logged-in", onLoggedIn);
    window.addEventListener("appearance:hydrate", onHydrateAppearance);
    return () => {
      window.removeEventListener("auth:logged-in", onLoggedIn);
      window.removeEventListener("appearance:hydrate", onHydrateAppearance);
    };
  }, [hydrateFromServer, saveToBackend]);

  /* ------------------- публичные сеттеры ------------------- */
  const setMode = (m) => {
    setModeState(m);
    saveToBackend();
  };

  const setAppearance = (partial) => {
    setAppearanceState((prev) => {
      const next = { ...prev, ...(partial || {}) };
      saveToBackend(partial);
      return next;
    });
  };

  const setBackground = (urlOrNull) => {
    setAppearanceState((prev) => {
      const patch = { backgroundPath: urlOrNull || "" };
      const next = { ...prev, ...patch };
      saveToBackend(patch);
      return next;
    });
  };

  /* ------------------- value ------------------- */
  const value = useMemo(
    () => ({
      mode,
      setMode,
      resolved,
      appearance,
      setAppearance,
      setBackground,
      hydrateFromServer,
    }),
    [mode, resolved, appearance, hydrateFromServer]
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}