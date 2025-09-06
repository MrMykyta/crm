// src/api/user.ts (или user.js)
import httpClient from './index';

/** ===================== Users ===================== **/

// Профиль текущего пользователя
export async function getMe() {
  const { data } = await httpClient.get('/users/me');
  return data; // { id, firstName, lastName, email*, ... , contacts?: [] }
}

// Обновить контактные точки (email/phone/telegram и т.п.)
export async function updateMe(contacts) {
  // contacts: [{ type:'email', valueRaw:'a@b.c', isPublic:true }, ...]
  const { data } = await httpClient.patch('/users/me', { contacts });
  return data; // вернём свежего пользователя/ok, зависит от бэка
}

/** ===================== Preferences ===================== **/

// Прочитать пользовательские предпочтения UI
export async function getMyPreferences() {
  const { data } = await httpClient.get('system/me/preferences');
  // ожидается: { themeMode, lang, appearance: { fontScale, backgroundPath } }
  return data || {};
}

// Сохранить пользовательские предпочтения UI
export async function saveMyPreferences(payload) {
  // payload: { themeMode?, lang?, appearance?: { fontScale?, backgroundPath? } }
  const { data } = await httpClient.put('system/me/preferences', payload);
  return data; // свежие prefs
}

/** ===================== Uploads ===================== **/

// Загрузка фонового изображения; сервер возвращает публичный URL
export async function uploadBackground(file) {
  const fd = new FormData();
  fd.append('file', file);

  const { data } = await httpClient.post('/upload/background', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  // ожидается: { url: "/static/backgrounds/uuid.png" }
  return data;
}

/** ===================== Helpers ===================== **/

// Нормализация пути (если сервер иногда отдаёт без /static)
export function toStaticUrl(p) {
  if (!p) return null;
  if (p.startsWith('http')) return p;
  return p.startsWith('/static/') ? p : `/static/${p.replace(/^\/+/, '')}`;
}