function asNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asColor(value, fallback) {
  if (typeof value !== "string") return fallback;
  const text = value.trim();
  return text || fallback;
}

export function resolveStyleTokens(styleTokens = {}) {
  const fontSizeBase = asNumber(styleTokens.fontSizeBase, 12);
  const textColor = asColor(
    styleTokens.textColor ?? styleTokens.colorText,
    "#e8ecf8"
  );
  const mutedColor = asColor(
    styleTokens.mutedColor ?? styleTokens.colorMuted,
    "#98a4bf"
  );
  const accentColor = asColor(
    styleTokens.accentColor ?? styleTokens.colorAccent ?? styleTokens.colorPrimary,
    "#8aa4ff"
  );
  const borderColor = asColor(
    styleTokens.borderColor ?? styleTokens.colorBorder,
    "rgba(138, 164, 255, 0.25)"
  );

  return {
    "--dtr-font-size-base": `${fontSizeBase}px`,
    "--dtr-text-color": textColor,
    "--dtr-muted-color": mutedColor,
    "--dtr-accent-color": accentColor,
    "--dtr-border-color": borderColor,
  };
}

export default resolveStyleTokens;
