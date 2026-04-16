// runtime-кеш на сессию вкладки (без localStorage)
let _cache = [];
let _ts = 0;
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

// normalizeMembers: нормализует входные и выходные данные.
function normalizeMembers(list = []) {
  return (list || []).map((m) => {
    const userId = m.userId ?? m.user?.id ?? m.id;
    return {
      id: userId,
      userId,
      email:     m.email ?? m.user?.email ?? '',
      firstName: m.firstName ?? m.user?.firstName ?? '',
      lastName:  m.lastName  ?? m.user?.lastName  ?? '',
      role:      m.role ?? m.membershipRole ?? null,
    };
  });
}

// setMembersCache: обновляет состояние.
export function setMembersCache(list = []) {
  try {
    _cache = normalizeMembers(list);
    _ts = Date.now();
  } catch {
    _cache = [];
    _ts = 0;
  }
}

// getMembersCache: возвращает вычисленные данные.
export function getMembersCache() {
  return Array.isArray(_cache) ? [..._cache] : [];
}

// isMembersCacheFresh: проверяет условие.
export function isMembersCacheFresh() {
  return _ts && (Date.now() - _ts) < TTL_MS;
}

// clearMembersCache: вспомогательная логика модуля.
export function clearMembersCache() {
  _cache = [];
  _ts = 0;
}

// getMemberLabel: возвращает вычисленные данные.
export function getMemberLabel(m) {
  const name = [m.firstName, m.lastName].filter(Boolean).join(' ').trim();
  return name || m.email || m.id;
}
