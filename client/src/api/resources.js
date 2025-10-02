// src/api/resources.js
import httpClient, { getCompanyId } from './index';

function toQuery(params = {}) {
  const esc = encodeURIComponent;
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return '';
  return '?' + entries.map(([k, v]) => {
    if (Array.isArray(v)) return v.map(x => `${esc(k)}=${esc(x)}`).join('&');
    return `${esc(k)}=${esc(v)}`;
  }).join('&');
}

// endpoint без companyId, напр. '/crm/counterparties'
export async function listResource(endpoint, query = {}) {
  const companyId = getCompanyId();
  if (!companyId) throw new Error('No companyId in localStorage');
  const url = `${endpoint}/${companyId}${toQuery(query)}`;
  const { data } = await httpClient.get(url);
  return data; // { items, total, page, limit }
}

export async function getOneResource(endpoint, id) {
  const companyId = getCompanyId();
  if (!companyId) throw new Error('No companyId in localStorage');
  const url = `${endpoint}/${companyId}/${id}`;
  const { data } = await httpClient.get(url);
  return data;
}

export async function createResource(endpoint, payload) {
  const companyId = getCompanyId();
  if (!companyId) throw new Error('No companyId in localStorage');
  const url = `${endpoint}/${companyId}`;
  const { data } = await httpClient.post(url, payload);
  return data;
}

export async function updateResource(endpoint, id, payload) {
  const companyId = getCompanyId();
  if (!companyId) throw new Error('No companyId in localStorage');
  const url = `${endpoint}/${companyId}/${id}`;
  const { data } = await httpClient.put(url, payload);
  return data;
}

export async function removeResource(endpoint, id) {
  const companyId = getCompanyId();
  if (!companyId) throw new Error('No companyId in localStorage');
  const url = `${endpoint}/${companyId}/${id}`;
  const resp = await httpClient.delete(url);
  return resp.status === 204 || resp?.data?.ok === true;
}

export async function callAction(endpoint, id, action, method = 'post', payload = {}) {
  const companyId = getCompanyId();
  if (!companyId) throw new Error('No companyId in localStorage');
  const url = `${endpoint}/${companyId}/${id}/${action}`;
  const { data } = await httpClient[method](url, payload);
  return data;
}