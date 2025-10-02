import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from'react-i18next';
import s from './Toolbar.module.css';

export default function Toolbar({ query, onChange, extra }) {
    const { t } = useTranslation();
    const [search, setSearch] = useState(query.search || '');

    useEffect(() => {
        const t = setTimeout(() => {
        onChange(q => ({ ...q, search, page: 1 }));
        }, 400);
        return () => clearTimeout(t);
    }, [search, onChange]);

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
            onChange={e => setSearch(e.target.value)}
            placeholder={t('crm.filters.searchPlaceholder')}
            className={s.input}
        />

        <select
            value={query.type || ''}
            onChange={e => onChange(q => ({ ...q, type: e.target.value || undefined, page:1 }))}
            className={s.select}
        >
            {types.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select
            value={query.status || ''}
            onChange={e => onChange(q => ({ ...q, status: e.target.value || undefined, page:1 }))}
            className={s.select}
        >
            {statuses.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <div className={s.spacer} />
        {extra && <div className={s.extra}>{extra}</div>}
        </div>
    );
}