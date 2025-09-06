import { useEffect } from "react";

/**
 * Применяет фон в CSS переменную --bg-image с предзагрузкой и очисткой.
 * Передавай абсолютный или относительный URL. null/"" — фон убирается.
 */
export default function useBackgroundImage(url) {
  useEffect(() => {
    const root = document.documentElement;

    if (!url) {
      root.style.removeProperty("--custom-bg-image");
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous"; // не критично, но полезно для внешних доменов
    img.onload = () => {
      root.style.setProperty("--custom-bg-layer", `url("${url}")`);
    };
    img.onerror = () => {
      // при ошибке не держим старый битый фон
      root.style.removeProperty("--custom-bg-layer");
    };
    img.src = url;

    return () => {
      // при размонтировании/смене URL очищаем
      root.style.removeProperty("--custom-bg-layer");
    };
  }, [url]);
}