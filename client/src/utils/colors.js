export const hexToRgb = (hex) => {
  const m = hex.replace('#','').match(/.{1,2}/g);
  if (!m) return [0,0,0];
  return m.map(x => parseInt(x.length===1 ? x+x : x, 16));
};
export const rgbToHex = (r,g,b) => '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
export const luminance = (r,g,b) => {
  const a = [r,g,b].map(v => {
    v/=255;
    return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
  });
  return 0.2126*a[0] + 0.7152*a[1] + 0.0722*a[2];
};
export const contrastRatio = (hex1, hex2) => {
  const [r1,g1,b1] = hexToRgb(hex1), [r2,g2,b2] = hexToRgb(hex2);
  const L1 = luminance(r1,g1,b1) + 0.05, L2 = luminance(r2,g2,b2) + 0.05;
  return L1 > L2 ? L1/L2 : L2/L1;
};

// топ-5 «квантованных» цветов
export async function extractPaletteFromImage(fileOrUrl, k = 5) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = typeof fileOrUrl === 'string' ? fileOrUrl : URL.createObjectURL(fileOrUrl);
  await new Promise(res => { img.onload = res; img.onerror = res; });

  const canvas = document.createElement('canvas');
  const w = canvas.width = 200;
  const h = canvas.height = Math.round((img.height/img.width) * 200) || 200;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0,0,w,h);

  const bucket = new Map();
  for (let i = 0; i < data.length; i+=4) {
    const r = data[i]>>3, g = data[i+1]>>3, b = data[i+2]>>3;
    const key = (r<<10) + (g<<5) + b;
    bucket.set(key, (bucket.get(key)||0)+1);
  }
  const top = [...bucket.entries()].sort((a,b)=>b[1]-a[1]).slice(0,k).map(([key]) => {
    const r = ((key>>10)&31)<<3, g = ((key>>5)&31)<<3, b = (key&31)<<3;
    return rgbToHex(r,g,b);
  });
  return top;
}

export function makeThemeFromPalette(palette) {
  const base = palette[0] || '#0c0f16';
  const accent = palette[2] || palette[1] || '#7a5bff';
  const text = contrastRatio('#ffffff', base) >= 4.5 ? '#ffffff' : '#e9edff';
  const muted = contrastRatio('#aab2d6', base) >= 3 ? '#aab2d6' : '#c2c9e8';
  return {
    '--bg': base,
    '--text': text,
    '--muted': muted,
    '--card-bg': 'rgba(16,18,27,.6)',
    '--card-brd': 'rgba(255,255,255,.12)',
    '--input-bg': 'rgba(10,12,19,.65)',
    '--shadow': '0 20px 60px rgba(0,0,0,.45)',
    '--primary-start': accent,
    '--primary-end': palette[3] || accent,
    '--focus': accent,
    '--sidebar-bg': 'rgba(18,21,33,.52)',
    '--sidebar-brd': 'rgba(255,255,255,.12)',
    '--sidebar-text': text,
    '--sidebar-hover': 'color-mix(in srgb, var(--primary-start) 12%, transparent)',
    '--sidebar-active': 'color-mix(in srgb, var(--primary-start) 18%, transparent)',
    '--topbar-bg': 'rgba(16,18,27,.72)',
    '--topbar-brd': 'rgba(255,255,255,.12)',
    '--topbar-text': text,
    '--topbar-input-bg': 'rgba(10,12,19,.65)'
  };
}

export function applyCustomTheme(vars) {
  const root = document.documentElement;
  root.setAttribute('data-theme', 'custom');
  Object.entries(vars || {}).forEach(([k,v]) => root.style.setProperty(k, v));
}