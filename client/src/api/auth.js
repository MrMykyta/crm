import httpClient from './index';
import { setTokens } from './session';

// 1) регистрация пользователя — письмо с подтверждением
export const registerUser = async ({ email, password, firstName, lastName }) => {
  const { data } = await httpClient.post('/auth/register', { email, password, firstName, lastName });
  return data; // ожидаем { userId, email }
};

// 2) верификация email по токену из письма
export const verifyEmail = async (token) => {
  const response = await httpClient.get('/auth/verify', { params: { token } });
  if (response.data?.tokens) setTokens(response.data.tokens);
  return response; // { verified:true, tokens? }
};

// 3) повторная отправка письма
export const resendVerification = async (email) => {
  const { data } = await httpClient.post('/auth/resend-verification', { email });
  return data;
};

// 4) логин
export const login = async (email, password, companyId) => {
  const response = await httpClient.post('/auth/login', { email, password, companyId});
  if (response.data?.tokens) {
    const { accessToken, refreshToken } = response.data.tokens;
    const { activeCompanyId } = response.data;
    await setTokens({accessToken, refreshToken, activeCompanyId}); 
  }
  return response;
};

export const loginFromCompany = async(companyId) => {
  const response = await httpClient.post('/auth/login-from-company', { companyId });
  console.log('loginFromCompany', response.data);
  if (response?.data) {
    const { accessToken, refreshToken } = response.data;
    const { activeCompanyId } = response.data;
    await setTokens({accessToken, refreshToken, activeCompanyId}); 
  }
  return response.data;
}

// 5) создание компании (после верификации)
export const createCompany = async (payload) => {
  const { data } = await httpClient.post('/companies', payload);
  return data; // { company: {...} }
};

export const requestPasswordReset = async (email) => {
  const { data } = await httpClient.post('/auth/password/forgot', { email });
  return data; // {ok:true}
};

// 2) сменить пароль по токену из ссылки
export const resetPassword = async (token, password) => {
  const { data } = await httpClient.post('/auth/password/reset', { token, password });
  return data; // {ok:true}
};