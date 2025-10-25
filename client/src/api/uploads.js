// src/api/uploads.js
import httpClient from './index';

function getCurrentUserId() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw)?.id || null : null;
  } catch { return null; }
}

function normOwnerType(t) {
  const n = String(t || '').toLowerCase();
  if (n === 'user' || n === 'users') return 'users';
  if (n === 'company' || n === 'companies') return 'companies';
  if (n === 'counterparty' || n === 'counterparties') return 'counterparties';
  throw new Error('Bad ownerType');
}

/** Загрузка локального файла (в т.ч. картинок) */
export async function uploadFile(ownerType, ownerId, file, {
  purpose = 'file',
  companyId,
  uploadedBy = getCurrentUserId(),
} = {}) {
  if (!uploadedBy) throw new Error('No current user id to set uploadedBy');
  const urlType = normOwnerType(ownerType);

  const fd = new FormData();
  if (companyId) fd.append('companyId', companyId);
  fd.append('uploadedBy', uploadedBy);
  fd.append('file', file);

  const { data } = await httpClient.post(
    `/uploads/${urlType}/${ownerId}?purpose=${encodeURIComponent(purpose)}`,
    fd,
    { headers: { 'Content-Type': 'multipart/form-data' }, validateStatus: s => s < 500 }
  );
  if (data?.error) throw Object.assign(new Error(data.message || data.error), { code: data.error });
  return data; // { id, url, filename, mime, size, purpose }
}

/** Загрузка по URL (скачиваем на сервере и прикрепляем) */
export async function attachFromUrl(ownerType, ownerId, remoteUrl, {
  purpose = 'file',
  companyId,
  filename,
  mime,
  uploadedBy = getCurrentUserId(),
} = {}) {
  if (!uploadedBy) throw new Error('No current user id to set uploadedBy');
  const urlType = normOwnerType(ownerType);

  const body = { url: remoteUrl, companyId, filename, mime, uploadedBy };
  const { data } = await httpClient.post(
    `/uploads/by-url/${urlType}/${ownerId}?purpose=${encodeURIComponent(purpose)}`,
    body,
    { validateStatus: s => s < 500 }
  );
  if (data?.error) throw Object.assign(new Error(data.message || data.error), { code: data.error });
  return data;
}