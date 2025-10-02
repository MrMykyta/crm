// src/api/counterparty.js
import httpClient, { getCompanyId } from './index';

export const getCounterparty = async (id) => {
  const companyId = getCompanyId();
  if (!companyId) throw new Error('No companyId in localStorage');
  const { data } = await httpClient.get(`/counterparties/${companyId}/${id}`);
  return data;
};

export const updateCounterparty = async (id, payload) => {
  const companyId = getCompanyId();
  if (!companyId) throw new Error('No companyId in localStorage');
  const { data } = await httpClient.put(`/counterparties/${companyId}/${id}`, payload);
  return data;
};