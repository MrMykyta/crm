// bootstrapThemeFromLocalStorage: вспомогательная логика модуля.
export function bootstrapThemeFromLocalStorage() {
  try {
    const TEXT_SIZE_MULTIPLIERS = {
      small: 0.94,
      medium: 1,
      large: 1.1,
    };
    const mode = localStorage.getItem('theme') || 'auto';
    const apRaw = localStorage.getItem('ui.appearance');
    const ap = apRaw ? JSON.parse(apRaw) : null;
    const root = document.documentElement;

    if (mode === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', mode);

    if (ap) {
      if (ap.density) root.setAttribute('data-density', ap.density);
      if (ap.textSize) root.setAttribute('data-text-size', ap.textSize);
      if (ap.radius != null) {
        root.style.setProperty('--radius-md', `${ap.radius}px`);
        root.style.setProperty('--radius-lg', `${(ap.radius ?? 12)+4}px`);
      }
      if (ap.blur != null) root.style.setProperty('--glass-blur', `${ap.blur}px`);
      root.setAttribute('data-shadow', ap.shadow ? 'on' : 'off');
      const scale = Number(ap.fontScale ?? 100);
      const textSize = String(ap.textSize || 'medium');
      const textSizeMult = TEXT_SIZE_MULTIPLIERS[textSize] ?? TEXT_SIZE_MULTIPLIERS.medium;
      const mult = (Math.min(200, Math.max(70, scale)) / 100) * textSizeMult;
      root.style.setProperty('--font-multiplier', mult);
      root.setAttribute('data-motion', ap.motion || 'normal');
      root.setAttribute('data-sticky-topbar', ap.stickyTopbar ? 'on' : 'off');
    }

    const bg = localStorage.getItem('ui.background');
    if (bg) {
      const { url } = JSON.parse(bg);
      if (url) document.documentElement.style.setProperty('--custom-bg-layer', `url("${url}")`);
    }
  } catch {}
}

