import axios from 'axios';
import { refreshSession, logoutUser } from './auth'; // 👈 это ключ

const httpClient = axios.create({
  baseURL: 'http://localhost:5000/api',
});

httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (err) => Promise.reject(err));

httpClient.interceptors.response.use((response) => {
  console.log(response);
    if (response.data?.tokens) {
      const { accessToken, refreshToken } = response.data.tokens;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
    }
    if (response.data.user?.avatarUrl){
      const {avatarUrl} = response.data.user;
      localStorage.setItem('avatarUrl', avatarUrl);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 403 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const newTokens = await refreshSession();
        if (newTokens?.data?.accessToken) {
          localStorage.setItem('accessToken', newTokens.data.accessToken);
          localStorage.setItem('refreshToken', newTokens.data.refreshToken);
          originalRequest.headers.Authorization = `Bearer ${newTokens.data.accessToken}`;
          return httpClient(originalRequest);
        }
      } catch (err) {
        logoutUser();
        window.location.href = '/';
      }
    } else if (error.response?.status === 401) {
      logoutUser();
      window.location.href = '/';
    }

    return Promise.reject(error);
  }
);

export default httpClient;
