// src/api/user.js
import httpClient from './index';

/** ===================== Users ===================== **/

// Профиль текущего пользователя
export async function getMe() {
  const { data } = await httpClient.get('/users/me');
  return data; // { id, firstName, lastName, email, ... }
}

// Обновить контактные точки
export async function updateMe(contacts) {
  const { data } = await httpClient.patch('/users/me', { contacts });
  return data;
}

/** ===================== Preferences ===================== **/

export async function getMyPreferences() {
  const { data } = await httpClient.get('/system/me/preferences');
  return data || {};
}

export async function saveMyPreferences(payload) {
  const { data } = await httpClient.put('/system/me/preferences', payload);
  return data;
}

/** ===================== Uploads ===================== **/

export async function uploadBackground(file) {
  const fd = new FormData();
  fd.append('file', file);

  const { data } = await httpClient.post('/upload/background', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data; // { url: "/static/backgrounds/uuid.png" }
}

/** ===================== Helpers ===================== **/

export function toStaticUrl(p) {
  if (!p) return null;
  if (p.startsWith('http')) return p;
  return p.startsWith('/static/') ? p : `/static/${p.replace(/^\/+/, '')}`;
}