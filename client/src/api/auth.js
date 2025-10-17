// src/api/auth.js
import httpClient from './index';
import { setTokens } from './session';

// 1) регистрация пользователя — письмо с подтверждением
export const registerUser = async ({ email, password, firstName, lastName }) => {
  const { data } = await httpClient.post('/auth/register', { email, password, firstName, lastName });
  return data; // { userId, email }
};

// 2) верификация email по токену из письма
export const verifyEmail = async (token) => {
  const { data } = await httpClient.get('/auth/verify', { params: { token } });
  if (data?.tokens) {
    const { accessToken, refreshToken } = data.tokens;
    console.log('tokens', accessToken, refreshToken);
    await setTokens({ accessToken, refreshToken, activeCompanyId: null });
  }
  console.log(data)
  return data; // { verified:true, tokens? }
};

// 3) повторная отправка письма
export const resendVerification = async (email) => {
  const { data } = await httpClient.post('/auth/resend-verification', { email });
  return data;
};

// 4) логин
export const login = async (email, password, companyId) => {
  const { data } = await httpClient.post('/auth/login', { email, password, companyId });
  if (data?.tokens) {
    const { accessToken, refreshToken } = data.tokens;
    const { activeCompanyId } = data;
    await setTokens({ accessToken, refreshToken, activeCompanyId });
  }
  return data;
};

export const loginFromCompany = async (companyId) => {
  const { data } = await httpClient.post('/auth/login-from-company', { companyId });
  if (data) {
    const { accessToken, refreshToken, activeCompanyId } = data;
    await setTokens({ accessToken, refreshToken, activeCompanyId });
  }
  return data;
};

// 5) создание компании (после верификации)
export const createCompany = async (payload) => {
  const { data } = await httpClient.post('/companies', payload);
  if (data?.tokens) {
    const { accessToken, refreshToken } = data.tokens;
    const { activeCompanyId } = data;
    await setTokens({ accessToken, refreshToken, activeCompanyId });
  }
  return data; // { company: {...} }
};

// 6) пароль — запрос на сброс
export const requestPasswordReset = async (email) => {
  const { data } = await httpClient.post('/auth/password/forgot', { email });
  return data; // { ok:true }
};

// 7) пароль — установить по токену
export const resetPassword = async (token, password) => {
  const { data } = await httpClient.post('/auth/password/reset', { token, password });
  return data; // { ok:true }
};