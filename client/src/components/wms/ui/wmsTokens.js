export const WMS_UI_FLAG = 'WMS_UI_TOKENS';

export const wmsTones = Object.freeze({
  neutral: 'neutral',
  progress: 'progress',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  muted: 'muted',
  info: 'info',
});

export const wmsSpacing = Object.freeze({
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
});

export const wmsRadii = Object.freeze({
  sm: '6px',
  md: '8px',
  lg: '10px',
  pill: '999px',
});

export const wmsDensity = Object.freeze({
  compactRowHeight: 32,
  comfortableRowHeight: 40,
  toolbarHeight: 48,
});

export const wmsTypography = Object.freeze({
  codeFont: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  labelSize: '12px',
  bodySize: '13px',
  titleSize: '16px',
});

export const wmsCssVars = Object.freeze({
  surface: 'var(--wms-surface)',
  surfaceSoft: 'var(--wms-surface-soft)',
  border: 'var(--wms-border)',
  borderStrong: 'var(--wms-border-strong)',
  text: 'var(--wms-text)',
  textMuted: 'var(--wms-text-muted)',
  focusRing: 'var(--wms-focus-ring)',
});

export const wmsStatusToneVars = Object.freeze({
  neutral: Object.freeze({
    bg: 'var(--wms-tone-neutral-bg)',
    border: 'var(--wms-tone-neutral-border)',
    text: 'var(--wms-tone-neutral-text)',
  }),
  progress: Object.freeze({
    bg: 'var(--wms-tone-progress-bg)',
    border: 'var(--wms-tone-progress-border)',
    text: 'var(--wms-tone-progress-text)',
  }),
  success: Object.freeze({
    bg: 'var(--wms-tone-success-bg)',
    border: 'var(--wms-tone-success-border)',
    text: 'var(--wms-tone-success-text)',
  }),
  warning: Object.freeze({
    bg: 'var(--wms-tone-warning-bg)',
    border: 'var(--wms-tone-warning-border)',
    text: 'var(--wms-tone-warning-text)',
  }),
  danger: Object.freeze({
    bg: 'var(--wms-tone-danger-bg)',
    border: 'var(--wms-tone-danger-border)',
    text: 'var(--wms-tone-danger-text)',
  }),
  muted: Object.freeze({
    bg: 'var(--wms-tone-muted-bg)',
    border: 'var(--wms-tone-muted-border)',
    text: 'var(--wms-tone-muted-text)',
  }),
  info: Object.freeze({
    bg: 'var(--wms-tone-info-bg)',
    border: 'var(--wms-tone-info-border)',
    text: 'var(--wms-tone-info-text)',
  }),
});

export const wmsTokens = Object.freeze({
  flag: WMS_UI_FLAG,
  tones: wmsTones,
  spacing: wmsSpacing,
  radii: wmsRadii,
  density: wmsDensity,
  typography: wmsTypography,
  cssVars: wmsCssVars,
  statusToneVars: wmsStatusToneVars,
});

export default wmsTokens;
