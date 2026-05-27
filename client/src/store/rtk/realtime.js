// src/store/rtk/realtime.js
import { crmApi } from './crmApi';
import { apiBase } from '../../config/api';

const API_ROOT = apiBase;

let currentES = null;

// normIds: вспомогательная логика для слоя RTK Query.
function normIds(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map(String);
  return [String(raw)];
}

// mapEventToTags: преобразует данные в нужный формат для слоя RTK Query.
function mapEventToTags(msg) {
  const ids = normIds(msg.ids ?? msg.id);

  if (msg?.entity) {
    const e = String(msg.entity).toLowerCase();
    if (e === 'counterparty') {
      return [
        { type: 'Counterparty', id: 'LIST' },
        ...ids.map(id => ({ type: 'Counterparty', id })),
      ];
    }
    if (e === 'task') {
      return [
        { type: 'TaskList', id: 'LIST' },
        ...ids.map(id => ({ type: 'Task', id })),
      ];
    }
    if (e === 'user' || e === 'companyuser') {
      return [
        { type: 'CompanyUser', id: 'LIST' },
        ...ids.map(id => ({ type: 'User', id })),
      ];
    }
    if (e === 'acl') {
      return [{ type: 'ACL', id: 'ROLES' }];
    }
    if (e === 'company') {
      return [{ type: 'Company' }];
    }
    return [];
  }

  const t = String(msg?.type || '').toLowerCase();
  if (t.startsWith('counterparty.')) {
    return [
      { type: 'Counterparty', id: 'LIST' },
      ...ids.map(id => ({ type: 'Counterparty', id })),
    ];
  }
  if (t.startsWith('task.')) {
    return [
      { type: 'TaskList', id: 'LIST' },
      ...ids.map(id => ({ type: 'Task', id })),
    ];
  }
  if (t.startsWith('user.') || t.startsWith('companyuser.')) {
    return [
      { type: 'CompanyUser', id: 'LIST' },
      ...ids.map(id => ({ type: 'User', id })),
    ];
  }
  if (t.startsWith('acl.')) {
    return [{ type: 'ACL', id: 'ROLES' }];
  }
  if (t.startsWith('company.')) {
    return [{ type: 'Company' }];
  }
  return [];
}

// initRealtime: вспомогательная логика для слоя RTK Query.
export function initRealtime(store, { url = `${API_ROOT}/sse` } = {}) {
  try { currentES?.close(); } catch {}
  currentES = null;

  const state = store.getState();
  const token = state.auth?.accessToken || null;
  const companyId = state.auth?.companyId || null;
  if (!token || !companyId) return () => {};

  const esc = encodeURIComponent;
  const sseUrl = `${url}?token=${esc(token)}&companyId=${esc(companyId)}`;

  const es = new EventSource(sseUrl);
  currentES = es;

  // 👇 публикуем глобально и шлём событие "готово"
  if (typeof window !== 'undefined') {
    window.__SUNSET_SSE__ = es;
    window.dispatchEvent(new CustomEvent('realtime:ready', { detail: { es } }));
  }

    // handle: обрабатывает пользовательское действие для слоя RTK Query.
const handle = (raw) => {
    let msg = null;
    try { msg = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return; }
    if (!msg || typeof msg !== 'object') return;

    if (msg.companyId && String(msg.companyId) !== String(companyId)) return;

    const tags = mapEventToTags(msg);
    if (tags.length) {
      store.dispatch(crmApi.util.invalidateTags(tags));
    }
  };

    // onmessage: вспомогательная логика для слоя RTK Query.
es.onmessage = (e) => handle(e.data);
  es.addEventListener('entity', (e) => handle(e.data));
  es.addEventListener('ready', () => {});
  es.addEventListener('ping', () => {});

    // onerror: вспомогательная логика для слоя RTK Query.
es.onerror = () => {
    // тут можно залогировать если надо
  };

  return () => {
    try { es.close(); } catch {}
    if (currentES === es) currentES = null;
    if (typeof window !== 'undefined' && window.__SUNSET_SSE__ === es) {
      window.__SUNSET_SSE__ = null;
    }
  };
}
