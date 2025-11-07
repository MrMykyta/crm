//hooks/useCompanyMembersOptions.js

import { useEffect, useMemo, useState } from 'react';

function parseMembers() {
  try {
    const raw = localStorage.getItem('companyMembers');
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Возвращает options = [{ value:<uuid>, label:<name> }] из localStorage.companyMembers */
export default function useCompanyMembersOptions() {
  const [members, setMembers] = useState(parseMembers());

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'companyMembers') {
        setMembers(parseMembers());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Можно принудительно рефрешнуть, если где-то локально обновили localStorage
  const refresh = () => setMembers(parseMembers());

  const options = useMemo(() => {
    return members.map(m => {
      // UUID пользователя: предпочитаем m.userId, если нет — m.id
      const id = m?.userId || m?.id;
      // ФИО / email
      const name = [m?.firstName, m?.lastName].filter(Boolean).join(' ').trim();
      const label = name || m?.email || id || '—';
      return { value: String(id), label };
    }).filter(o => !!o.value);
  }, [members]);

  return { options, refresh };
}