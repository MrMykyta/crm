const trimTrailingSlashes = (value = '') => String(value).trim().replace(/\/+$/, '');

const normalizeBrowserApiOrigin = (value = '') => {
  if (!value) return '';
  try {
    const parsed = new URL(value);
    // Имя docker-сервиса `backend` не резолвится в браузере на хосте.
    if (parsed.hostname === 'backend') return '';
  } catch {}
  return value;
};

const rawApiOrigin = trimTrailingSlashes(process.env.REACT_APP_API_URL || '');
export const apiOrigin = normalizeBrowserApiOrigin(rawApiOrigin);
export const apiBase = apiOrigin ? `${apiOrigin}/api` : '/api';
export const socketBaseUrl = apiOrigin || undefined;

export const withApiOrigin = (url = '') => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${apiOrigin}${url}`;
  return apiOrigin ? `${apiOrigin}/${url}` : `/${url}`;
};
