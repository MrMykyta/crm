import httpClient from './index';

export const loginUser = async (data) => {
  const response = await httpClient.post('/auth/login', data);
  
  const { tokens, user } = response.data;

  if (tokens) {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
  }

  if (user) {
    localStorage.setItem('avatarUrl', user.avatarUrl || '');
    localStorage.setItem('email', user.email || '');
  }

  return user;
}

export const registerUser = (data) => httpClient.post('/auth/register', data);

export const refreshSession = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  const response = await httpClient.post('/auth/refresh', { refreshToken });
  const { tokens } = response.data;

  if (tokens) {
    return true
  }
  else{
    return false
  }
};

export const logoutUser = async () => {
  localStorage.removeItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');
  const res = await httpClient.post('/auth/logout', { refreshToken });
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('avatarUrl');
  localStorage.removeItem('email');
};

