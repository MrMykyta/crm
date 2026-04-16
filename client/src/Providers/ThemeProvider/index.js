import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useSelector } from "react-redux";
import useBrandAndBackground from "../../hooks/useBrandAndBackground";
import {
  useGetMyPreferencesQuery,
  useSaveMyPreferencesMutation,
} from "../../store/rtk/userApi";

const ThemeCtx = createContext(null);
export // useTheme : use theme.
// useTheme: инкапсулирует переиспользуемую логику.
const useTheme = () => useContext(ThemeCtx);

const TEXT_SIZE_MULTIPLIERS = {
  small: 0.94,
  medium: 1,
  large: 1.1,
};

const DENSITY_VALUES = new Set(["compact", "comfortable", "spacious"]);

// ThemeProvider: вспомогательная логика модуля.
export default function ThemeProvider({ children }) {
  // ждём авторизацию из redux
  const accessToken = useSelector((s) => s.auth?.accessToken);
  const companyIdRedux = useSelector((s) => s.auth?.companyId);
  const currentUserId = useSelector((s) => s.auth?.currentUser?.id || null);

  const [mode, setModeState] = useState("system");
  const [appearance, setAppearanceState] = useState({});
  const prevUserIdRef = useRef(currentUserId);

  const [savePrefs] = useSaveMyPreferencesMutation();

  // Важно: не запрашиваем preferences до появления токена/компании
  const { data: serverPrefs } = useGetMyPreferencesQuery(undefined, {
    skip: !accessToken || !companyIdRedux,
    refetchOnMountOrArgChange: true,
  });

  const modeRef = useRef(mode);
  const appRef = useRef(appearance);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    appRef.current = appearance;
  }, [appearance]);

  const [system, setSystem] = useState(() =>
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
  );
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
        // onChange: вспомогательная логика модуля.
const onChange = (e) => setSystem(e.matches ? "dark" : "light");
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  const resolved = mode === "system" ? system : mode;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolved);
    const cssBg = getComputedStyle(root).getPropertyValue("--bg").trim();
    if (cssBg) root.style.background = cssBg;
  }, [resolved]);

  useEffect(() => {
    const scale = Number(appearance?.fontScale ?? 100);
    const textSize = String(appearance?.textSize || "medium");
    const textSizeMult = TEXT_SIZE_MULTIPLIERS[textSize] ?? TEXT_SIZE_MULTIPLIERS.medium;
    const mult = (Math.min(200, Math.max(70, scale)) / 100) * textSizeMult;
    document.documentElement.style.setProperty("--font-multiplier", mult);
    document.documentElement.setAttribute("data-text-size", textSize);
  }, [appearance?.fontScale, appearance?.textSize]);

  useEffect(() => {
    const density = String(appearance?.density || "comfortable");
    const normalized = DENSITY_VALUES.has(density) ? density : "comfortable";
    document.documentElement.setAttribute("data-density", normalized);
  }, [appearance?.density]);

  const companyId = companyIdRedux;

  useBrandAndBackground(appearance?.backgroundPath || null, {
    initialAvatarUrl: undefined,
    initialUserAvatarUrl: undefined,
  });

  // при смене пользователя очищаем appearance, чтобы не тянуть фон/настройки другого аккаунта
  useEffect(() => {
    const prev = prevUserIdRef.current;
    if ((prev && !currentUserId) || (prev && currentUserId && String(prev) !== String(currentUserId))) {
      setAppearanceState({});
    }
    prevUserIdRef.current = currentUserId;
  }, [currentUserId]);

  const isHydratingRef = useRef(false);
  const saveTimerRef = useRef(null);

  const saveToBackend = useCallback(
    (appearancePatch) => {
      // не отправляем на бэк, пока нет токена/компании
      if (!accessToken || !companyId) return;
      if (isHydratingRef.current) return;
      clearTimeout(saveTimerRef.current);

      saveTimerRef.current = setTimeout(() => {
        const latestMode = modeRef.current;
        const latestApp = appRef.current;
        const mergedApp = { ...(latestApp || {}), ...(appearancePatch || {}) };
        savePrefs({ themeMode: latestMode, appearance: mergedApp }).catch(() => {});
      }, 300);
    },
    [savePrefs, accessToken, companyId]
  );

  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

    // parsePrefs: парсит входные данные.
const parsePrefs = (raw) => {
    const pref = raw?.pref ?? raw ?? {};
    const themeMode = pref.themeMode ?? pref.theme ?? undefined;
    const nextAppearance = { ...(pref.appearance || {}) };
    if (!nextAppearance.backgroundPath && pref?.background?.url) {
      nextAppearance.backgroundPath = String(pref.background.url);
    }
    return { themeMode, appearance: nextAppearance };
  };

  useEffect(() => {
    if (!serverPrefs) return;
    isHydratingRef.current = true;
    try {
      const { themeMode, appearance: serverApp } = parsePrefs(serverPrefs);
      if (themeMode) setModeState(themeMode);
      if (serverApp && Object.keys(serverApp).length) {
        setAppearanceState((prev) => ({ ...prev, ...serverApp }));
      }
    } finally {
      isHydratingRef.current = false;
    }
  }, [serverPrefs]);

  const setMode = useCallback((m) => {
    setModeState(m);
    saveToBackend();
  }, [saveToBackend]);

  const setAppearance = useCallback((partialOrUpdater) => {
    setAppearanceState((prev) => {
      const patch = typeof partialOrUpdater === 'function'
        ? (partialOrUpdater(prev) || {})
        : (partialOrUpdater || {});
      const next = { ...prev, ...patch };
      saveToBackend(patch);
      return next;
    });
  }, [saveToBackend]);

  const setBackground = useCallback((urlOrNull) => {
    setAppearanceState((prev) => {
      const patch = { backgroundPath: urlOrNull || "" };
      const next = { ...prev, ...patch };
      saveToBackend(patch);
      return next;
    });
  }, [saveToBackend]);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      resolved,
      appearance,
      setAppearance,
      setBackground,
    }),
    [appearance, mode, resolved, setAppearance, setBackground, setMode]
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

