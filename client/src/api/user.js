// src/api/user.js
import httpClient from './index';
import { uploadFile } from './uploads';
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

export async function lookupUserByEmail(email) {
  const { data } = await httpClient.get('/users/lookup', { params: { email } });
  console.log('user', data);
  return data; // { exists: boolean, user? }
}

/** ===================== Preferences ===================== **/

export async function getMyPreferences() {
  const {data} = await httpClient.get('/system/me/preferences');
  console.log('preferences', data);
  return data || {};
}

export async function saveMyPreferences(payload) {
  const { data } = await httpClient.put('/system/me/preferences', payload);
  return data;
}

/** ===================== Uploads ===================== **/

export async function uploadBackground(file) {
  const userRaw = localStorage.getItem('user');
  const userId = userRaw ? (JSON.parse(userRaw)?.id) : null;
  const companyId = localStorage.getItem('companyId') || undefined;
  if (!userId) throw new Error('Нет текущего пользователя');

  return uploadFile('users', userId, file, {
    purpose: 'background',
    companyId,
  });
}

/** ===================== Helpers ===================== **/

export function toStaticUrl(p) {
  if (!p) return null;
  if (p.startsWith('http')) return p;
  return p.startsWith('/static/') ? p : `/static/${p.replace(/^\/+/, '')}`;
}