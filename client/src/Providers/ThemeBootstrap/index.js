export function bootstrapThemeFromLocalStorage() {
  try {
    const mode = localStorage.getItem('theme') || 'auto';
    const apRaw = localStorage.getItem('ui.appearance');
    const ap = apRaw ? JSON.parse(apRaw) : null;
    const root = document.documentElement;

    if (mode === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', mode);

    if (ap) {
      if (ap.density) root.setAttribute('data-density', ap.density);
      if (ap.radius != null) {
        root.style.setProperty('--radius-md', `${ap.radius}px`);
        root.style.setProperty('--radius-lg', `${(ap.radius ?? 12)+4}px`);
      }
      if (ap.blur != null) root.style.setProperty('--glass-blur', `${ap.blur}px`);
      root.setAttribute('data-shadow', ap.shadow ? 'on' : 'off');
      if (ap.fontScale) root.style.fontSize = `${ap.fontScale}%`;
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