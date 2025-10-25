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

// Универсальная подстановка в шаблон пути.
// Поддерживает {companyId}, :companyId, {id}, :id, {action}, :action
function fillPath(tpl, params = {}) {
  let url = tpl;

  // поддержка фигурных скобок {param}
  url = url.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] !== undefined ? encodeURIComponent(params[key]) : `{${key}}`
  );

  // поддержка двоеточий :param
  url = url.replace(/:(companyId|id|action)\b/g, (_, key) =>
    params[key] !== undefined ? encodeURIComponent(params[key]) : `:${key}`
  );

  return url;
}

// Если плейсхолдеров нет — поведение как раньше (добавляем /:companyId /:id /:action в конец).
function buildUrl(endpoint, { companyId, id, action, query } = {}) {
  if (!companyId) throw new Error('No companyId in localStorage');

  const hasCompanyPh = /(\{companyId\}|:companyId)/.test(endpoint);
  const hasIdPh      = /(\{id\}|:id)/.test(endpoint);
  const hasActionPh  = /(\{action\}|:action)/.test(endpoint);

  let path = endpoint;

  if (hasCompanyPh || hasIdPh || hasActionPh) {
    path = fillPath(endpoint, { companyId, id, action });
  } else {
    // старый режим: просто склеиваем
    path = endpoint;
    if (companyId) path += `/${encodeURIComponent(companyId)}`;
    if (id !== undefined && id !== null) path += `/${encodeURIComponent(id)}`;
    if (action) path += `/${encodeURIComponent(action)}`;
  }

  return path + toQuery(query);
}

/** ===== LIST =====
 * Примеры:
 *   listResource('/counterparties', q)                  -> /counterparties/:companyId?...
 *   listResource('/members/{companyId}/users', q)      -> /members/XYZ/users?...
 *   listResource('/invitations/companies/:companyId/invitations', q)
 */
export async function listResource(endpoint, query = {}) {
  const companyId = getCompanyId();
  const url = buildUrl(endpoint, { companyId, query });
  const { data } = await httpClient.get(url);
  return data; // { items, total, page, limit } или массив — как вернёт бэк
}

export async function getOneResource(endpoint, id) {
  const companyId = getCompanyId();
  const url = buildUrl(endpoint, { companyId, id });
  const { data } = await httpClient.get(url);
  return data;
}

export async function createResource(endpoint, payload) {
  const companyId = getCompanyId();
  const url = buildUrl(endpoint, { companyId });
  const { data } = await httpClient.post(url, payload);
  return data;
}

export async function updateResource(endpoint, id, payload) {
  const companyId = getCompanyId();
  const url = buildUrl(endpoint, { companyId, id });
  const { data } = await httpClient.put(url, payload);
  return data;
}

export async function removeResource(endpoint, id) {
  const companyId = getCompanyId();
  const url = buildUrl(endpoint, { companyId, id });
  const resp = await httpClient.delete(url);
  return resp.status === 204 || resp?.data?.ok === true;
}

export async function callAction(endpoint, id, action, method = 'post', payload = {}) {
  const companyId = getCompanyId();
  const url = buildUrl(endpoint, { companyId, id, action });
  const { data } = await httpClient[method](url, payload);
  return data;
}