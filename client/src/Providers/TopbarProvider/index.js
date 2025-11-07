// TopbarProvider


import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

const Ctx = createContext(null);

export function TopbarProvider({ defaultTitle, children }) {
  const [title, setTitleState] = useState(defaultTitle || "");
  const [subtitle, setSubtitleState] = useState("");
  const [onTitleClick, setOnTitleClickState] = useState(null);

  // флаг: заголовок переопределён вручную страницей
  const overriddenRef = useRef(false);

  // обёртки, которые помечают «ручной оверрайд»
  const setTitle = (v) => { overriddenRef.current = true; setTitleState(v ?? ""); };
  const setSubtitle = (v) => { overriddenRef.current = true; setSubtitleState(v ?? ""); };
  const setOnTitleClick = (fn) => { overriddenRef.current = true; setOnTitleClickState(fn ?? null); };

  // сброс к дефолту — явный
  const reset = () => {
    overriddenRef.current = false;
    setTitleState(defaultTitle || "");
    setSubtitleState("");
    setOnTitleClickState(null);
  };

  // если дефолт поменялся (другой роут/перевод) — применяем его,
  // НО только если нет ручного оверрайда
  useEffect(() => {
    if (!overriddenRef.current) {
      setTitleState(defaultTitle || "");
      setSubtitleState("");
      setOnTitleClickState(null);
    }
  }, [defaultTitle]);

  const value = useMemo(() => ({
    title, setTitle,
    subtitle, setSubtitle,
    onTitleClick, setOnTitleClick,
    reset
  }), [title, subtitle, onTitleClick]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTopbar() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTopbar must be used within <TopbarProvider>");
  return v;
}

export function useTopbarOptional() {
  return useContext(Ctx);
}