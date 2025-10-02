// src/api/company.js
import httpClient from './index';

export const getCompanyById = async (id) => {
  const { data } = await httpClient.get(`/companies/${id}`);
  return data; // { id, name, shortName, ... }
};