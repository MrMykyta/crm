import httpClient from './index';

export const getTokens = () => ({
  access: localStorage.getItem('accessToken'),
  refresh: localStorage.getItem('refreshToken'),
});

export const setTokens = async ({ accessToken, refreshToken, activeCompanyId }) => {
  if (accessToken) localStorage.setItem('accessToken', accessToken);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
  if (activeCompanyId) localStorage.setItem('companyId', activeCompanyId);
};

export const getCompanyId = () => localStorage.getItem('companyId');
export const setCompanyId = async (companyId) => localStorage.setItem('companyId', companyId);

export const clearSession = () => {
  try {
    localStorage.removeItem('accessToken');
    console.log('accessToken removed');
  } catch (_) {}
  try {
    localStorage.removeItem('refreshToken');
    console.log('refreshToken removed');
  } catch (_) {}
  try {
    localStorage.removeItem('companyId');
    console.log('companyId removed');
  } catch (_) {}
  try {
    localStorage.removeItem('user');
    console.log('user removed');
  } catch (_) {}
  try {
    localStorage.removeItem('avatarUrl');
    console.log('avatarUrl removed');
  } catch (_) {}
};

export const logoutUser = () => {
  clearSession();
};

export const refreshSession = async () => {
  const { refresh } = getTokens();
  if (!refresh) return null;
  // важно: используем "чистый" axios, чтобы не задеть перехватчики httpClient
  const { data } = await httpClient.post(`/auth/refresh`, { refreshToken: refresh }, { withCredentials: true });
  console.log('Refreshing tokens:', data);
  return { data };
};