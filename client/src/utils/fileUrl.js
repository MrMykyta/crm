const UUID_RE = /^[0-9a-fA-F-]{32,36}$/;

export const extractFileId = (value) => {
  if (!value) return null;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const base = trimmed.split("?")[0];
  if (UUID_RE.test(base)) return base;

  const match = trimmed.match(/\/api\/files\/([^/]+)\/download/i);
  if (match && match[1]) return match[1];

  return null;
};
