//hooks/useCompanyMembersOptions.js

import { useMemo } from 'react';
import { useSelector } from 'react-redux';

/** Возвращает options = [{ value:<uuid>, label:<name> }] из RTK store (bootstrap.companyUsers) */
export default function useCompanyMembersOptions() {
  const members = useSelector((s) => s.bootstrap?.companyUsers || []);

  const options = useMemo(() => {
    return (Array.isArray(members) ? members : []).map(m => {
      const id = m?.userId || m?.id;
      const name = [m?.firstName, m?.lastName].filter(Boolean).join(' ').trim();
      const label = name || m?.email || id || '—';
      return { value: String(id), label };
    }).filter(o => !!o.value);
  }, [members]);

  return { options };
}
