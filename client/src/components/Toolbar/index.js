// src/components/Toolbar/Toolbar.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import s from './Toolbar.module.css';

const norm = (v) => (v ?? '').trim();           // '' и undefined приводим к строке
const toQueryValue = (v) => (v ? v : undefined); // '' -> undefined для query

export default function Toolbar({ query, onChange, extra }) {
  const { t } = useTranslation();

  // локальный ввод строки поиска (всегда строка)
  const [search, setSearch] = useState(norm(query.search));

  // если query.search изменился снаружи — аккуратно синхронизируем инпут
  useEffect(() => {
    const next = norm(query.search);
    if (next !== search) setSearch(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.search]);

  // дебаунс изменений поиска: вызываем onChange только при реальной смене значения
  const timerRef = useRef(null);
  useEffect(() => {
    const curr = norm(search);
    const currentInQuery = norm(query.search);

    // если фактически одинаково — ничего не делаем (включая первый рендер)
    if (curr === currentInQuery) return;

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange((q) => {
        const currQ = norm(q.search);
        if (currQ === curr) return q; // защитимся и внутри
        return { ...q, search: toQueryValue(curr), page: 1 };
      });
    }, 400);

    return () => clearTimeout(timerRef.current);
  }, [search, query.search, onChange]);

  const types = useMemo(() => ([
    { value:'', label: t('crm.filters.allTypes') },
    { value:'lead', label: t('crm.enums.type.lead') },
    { value:'client', label: t('crm.enums.type.client') },
    { value:'partner', label: t('crm.enums.type.partner') },
    { value:'supplier', label: t('crm.enums.type.supplier') },
    { value:'manufacturer', label: t('crm.enums.type.manufacturer') },
  ]), [t]);

  const statuses = useMemo(() => ([
    { value:'', label: t('crm.filters.allStatuses') },
    { value:'potential', label: t('crm.enums.status.potential') },
    { value:'active', label: t('crm.enums.status.active') },
    { value:'inactive', label: t('crm.enums.status.inactive') },
  ]), [t]);

  return (
    <div className={s.toolbar}>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('crm.filters.searchPlaceholder')}
        className={s.input}
      />

      <select
        value={query.type || ''}
        onChange={(e) =>
          onChange(q => {
            const v = e.target.value || '';
            const next = { ...q, type: v || undefined, page: 1 };
            // маленький гард от бессмысленных обновлений:
            if ((q.type || '') === v) return q;
            return next;
          })
        }
        className={s.select}
      >
        {types.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <select
        value={query.status || ''}
        onChange={(e) =>
          onChange(q => {
            const v = e.target.value || '';
            const next = { ...q, status: v || undefined, page: 1 };
            if ((q.status || '') === v) return q;
            return next;
          })
        }
        className={s.select}
      >
        {statuses.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <div className={s.spacer} />
      {extra && <div className={s.extra}>{extra}</div>}
    </div>
  );
}