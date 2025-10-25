// src/api/index.js
import axios from 'axios';
import { refreshSession, logoutUser, getAccessToken as _getAccessToken, getCompanyId as _getCompanyId } from './session';

/** ===== Base URL ===== */
function makeBaseURL() {
  const raw = process.env.REACT_APP_API_URL || 'http://localhost:5001';
  const trimmed = raw.replace(/\/+$/, '');
  return `${trimmed}/api`;
}

export const httpClient = axios.create({
  baseURL: makeBaseURL(),
  withCredentials: true, // оставь true, если аутентификация через cookie тоже используется
  timeout: 30000,
});

/** Удобные ре-экспорты для остальных модулей */
export const getAccessToken = _getAccessToken;
export const getCompanyId   = _getCompanyId;

/** ===== Request: подставляем Bearer ===== */
httpClient.interceptors.request.use((config) => {
  const token = _getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** ===== Refresh очередь ===== */
let isRefreshing = false;
let queue = [];

function enqueue(originalRequest) {
  return new Promise((resolve, reject) => {
    queue.push({
      resolve: (newToken) => {
        if (newToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        resolve(httpClient(originalRequest));
      },
      reject,
    });
  });
}

function flushQueue(error, token = null) {
  queue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  queue = [];
}

/** ===== Response: авто-refresh + защита от рекурсии ===== */
httpClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config } = error || {};
    const original = config || {};
    if (!response) throw error;

    const status = response.status;
    const url = String(original?.url || '');
    const isAuthRoute = [
      '/auth/login',
      '/auth/register',
      '/auth/verify',
      '/auth/refresh',
      '/auth/logout',
    ].some(p => url.includes(p));

    const alreadyRetried   = Boolean(original._retry);
    const hadAuthHeader    = Boolean(original?.headers?.Authorization);
    const tokenErr         = response.data?.error === 'TokenError' || response.data?.code === 'TOKEN_EXPIRED';
    const shouldTryRefresh = !alreadyRetried && !isAuthRoute && hadAuthHeader && ([401,403,408].includes(status) || tokenErr);

    if (shouldTryRefresh) {
      original._retry = true;

      if (isRefreshing) return enqueue(original);

      isRefreshing = true;
      try {
        const tokens = await refreshSession(); // кладёт новые токены в localStorage
        const newToken = tokens?.accessToken || _getAccessToken();
        isRefreshing = false;
        flushQueue(null, newToken);

        original.headers = original.headers || {};
        if (newToken) original.headers.Authorization = `Bearer ${newToken}`;
        return httpClient(original);
      } catch (e) {
        isRefreshing = false;
        flushQueue(e, null);
        await logoutUser();
        window.location.replace('/');
        throw e;
      }
    }

    if (status === 401 && !isAuthRoute) {
      await logoutUser();
      try { window.dispatchEvent(new Event('auth:logged-out')); } catch {}
      window.location.replace('/');
    }

    throw error;
  }
);

export default httpClient;