// SSE → инвалидируем RTK-теги
const API_ROOT =
  (process.env.REACT_APP_API_URL?.replace(/\/+$/, '') || 'http://localhost:5001') + '/api';

const mapTypeToTags = (evtType, ids = []) => {
  const low = String(evtType || '').toLowerCase();

  if (low.startsWith('counterparty.')) {
    return [{ type: 'Counterparty', id: 'LIST' }, ...ids.map(id => ({ type: 'Counterparty', id }))];
  }
  if (low.startsWith('task.')) {
    return [{ type: 'TaskList', id: 'LIST' }, ...ids.map(id => ({ type: 'Task', id }))];
  }
  if (low.startsWith('user.') || low.startsWith('companyuser.')) {
    return [{ type: 'CompanyUser', id: 'LIST' }, ...ids.map(id => ({ type: 'User', id }))];
  }
  if (low.startsWith('acl.')) {
    return [{ type: 'ACL', id: 'ROLES' }];
  }
  if (low.startsWith('company.')) {
    return [{ type: 'Company' }];
  }
  return [];
};

let currentES = null;

export function initRealtime(store, { url = `${API_ROOT}/sse` } = {}) {
  try { currentES?.close(); } catch {}

  const state = store.getState();
  const token = state.auth?.accessToken || null;
  const companyId = state.auth?.companyId || null;
  if (!token || !companyId) return () => {};

  const esc = encodeURIComponent;
  const sseUrl = `${url}?token=${esc(token)}&companyId=${esc(companyId)}`;

  const es = new EventSource(sseUrl);
  currentES = es;

  es.onmessage = (e) => {
    try {
      const payload = JSON.parse(e.data);
      const tags = mapTypeToTags(payload?.type, payload?.ids);
      if (tags.length) {
        store.dispatch({ type: 'crmApi/util/invalidateTags', payload: tags });
      }
    } catch {}
  };

  es.onerror = () => {
    // браузер попробует переподключиться
  };

  return () => {
    try { es.close(); } catch {}
    if (currentES === es) currentES = null;
  };
}