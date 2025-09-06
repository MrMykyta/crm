import axios from 'axios';
import { refreshSession, logoutUser, setTokens } from './session';

const httpClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5001/api',
  withCredentials: true,
});

httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (err) => Promise.reject(err));

httpClient.interceptors.response.use(
  (response) => {
    // если бэкенд иногда возвращает tokens вместе с ответом — подхватываем
    if (response?.tokens) setTokens(response.tokens);
    if (response?.user?.avatarUrl) {
      localStorage.setItem('avatarUrl', response.data.user.avatarUrl);
    }
    return response;
  },
  async (error) => {
    const res = error.response;
    const originalRequest = error.config || {};
    const url = (originalRequest.url || '').toString();

    // роуты, где 401/403 — нормальная бизнес-ошибка (не надо разлогинивать/редиректить)
    const isPublicAuthRoute =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/verify') ||
      url.includes('/auth/refresh');

    const hadAuthHeader = !!originalRequest.headers?.Authorization;

    // ---- 403: пробуем refresh только если запрос был с Authorization и это не публичный роут
    if (res?.status === 403 && !originalRequest._retry && hadAuthHeader && !isPublicAuthRoute) {
      originalRequest._retry = true;
      try {
        const newTokens = await refreshSession();
        if (newTokens?.data?.accessToken) {
          originalRequest.headers.Authorization = `Bearer ${newTokens.data.accessToken}`;
          return httpClient(originalRequest);
        }
      } catch (_) {
        // упадём в общий блок ниже
      }
    }
    // ---- 401: 
    // 1) если публичный auth-роут или неавторизованный запрос — отдать ошибку форме (Formik её покажет)
    if (res?.status === 401 && (isPublicAuthRoute || !hadAuthHeader)) {
      return Promise.reject(error);
    }

    // 2) для приватных запросов: разлогин и редирект на /auth
    if (res?.status === 401 || res?.status === 403) {
      logoutUser();
      window.location.href = '/auth';
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default httpClient;