// src/api/session.js
import axios from 'axios';

/** ===== Helpers for baseURL ===== */
function makeBaseURL() {
  const raw = process.env.REACT_APP_API_URL || 'http://localhost:5001';
  const trimmed = raw.replace(/\/+$/, '');
  return `${trimmed}/api`;
}

/** ===== LocalStorage session helpers ===== */
export const getAccessToken  = () => localStorage.getItem('accessToken');
export const getRefreshToken = () => localStorage.getItem('refreshToken');
export const getCompanyId    = () => localStorage.getItem('companyId');

export const setCompanyId = (companyId) => {
  if (companyId) localStorage.setItem('companyId', companyId);
};

export const setTokens = async ({ accessToken, refreshToken, activeCompanyId }) => {
  if (accessToken)  localStorage.setItem('accessToken', accessToken);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
  if (activeCompanyId) setCompanyId(activeCompanyId);
};

export const clearSession = () => {
  ['accessToken','refreshToken','companyId','user','ui.appearance','theme','avatarUrl']
    .forEach(k => { try { localStorage.removeItem(k); } catch(_) {} });
};

export const logoutUser = async () => {
  clearSession();
};

/** ===== Bare axios для refresh (без перехватчиков) ===== */
const bare = axios.create({
  baseURL: makeBaseURL(),
  withCredentials: true,
  timeout: 30000,
});

/** 
 * Обновление токенов. 
 * Если refresh хранится в localStorage — шлём в теле запроса (как у тебя).
 * Если сервер работает на HttpOnly cookie — тело можно не слать.
 */
export const refreshSession = async () => {
  const refreshToken = getRefreshToken();
  const companyId = getCompanyId();
  if (!refreshToken) throw new Error('No refresh token');

  const { data } = await bare.post('/auth/refresh', { refreshToken, companyId });
  // ожидаем либо {accessToken, refreshToken?}, либо {tokens:{accessToken,refreshToken?}}
  const {accessToken, refreshToken: refresh} = data;
  console.log('access', accessToken, 'refersh', refresh);

  await setTokens({
    accessToken: accessToken,
    refreshToken: refresh,
  });
  return data;
};