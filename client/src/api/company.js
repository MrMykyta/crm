// src/api/company.js
import httpClient from './index';

export const getCompanyById = async (id) => {
  const { data } = await httpClient.get(`/companies/${id}`);
  console.log('Company:', data);
  return data;
};

export const updateCompanyById = async (id, payload) => {
  // сервер может ожидать плоский объект; address можно передать как есть
  const { data } = await httpClient.put(`/companies/${id}`, payload);
  return data;
};

export const uploadCompanyLogo = async (id, file) => {
  const fd = new FormData();
  fd.append('file', file);
  const { data } = await httpClient.post(`/uploads/companies/${id}/logo`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  // ожидаем { url: 'https://...' }
  return data;
};