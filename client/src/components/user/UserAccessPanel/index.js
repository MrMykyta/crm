// src/components/user/UserAccessPanel/index.jsx
import { useEffect, useMemo, useState } from 'react';
import Switch from '../../inputs/Switch';
import { SearchField } from '../../ui/fields';
import s from './UserAccessPanel.module.css';

import {
  useListRolesQuery,
  useUserPermSummaryQuery,
  useAssignRoleToUserMutation,
  useRemoveRoleFromUserMutation,
  useAllowPermForUserMutation,
  useDenyPermForUserMutation,
} from '../../../store/rtk/aclApi';

// Компонент Accordion: отвечает за отображение UI и обработку взаимодействий пользователя.
function Accordion({ title, count, children, defaultOpen=false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={s.acc}>
      <button type="button" className={s.accHead} onClick={()=>setOpen(o=>!o)}>
        <span className={s.caret} aria-hidden>{open ? '▾' : '▸'}</span>
        <span className={s.accTitle}>{title}</span>
        <span className={s.accCount}>{count}</span>
      </button>
      {open && <div className={s.accBody}>{children}</div>}
    </div>
  );
}

// Компонент UserAccessPanel: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function UserAccessPanel({ userId }) {
  // поисковые строки
  const [qRole, setQRole] = useState('');
  const [qPerm, setQPerm] = useState('');

  // --- data (RTK Query)
  const { data: rolesRaw = [], isFetching: rolesLoading, refetch: refetchRoles } = useListRolesQuery();
  const { data: summary, isFetching: summaryLoading, refetch: refetchSummary } = useUserPermSummaryQuery(userId, { skip: !userId });

  // --- mutations
  const [assignRoleToUser] = useAssignRoleToUserMutation();
  const [removeRoleFromUser] = useRemoveRoleFromUserMutation();
  const [allowPermForUser]  = useAllowPermForUserMutation();
  const [denyPermForUser]   = useDenyPermForUserMutation();

  const loading = rolesLoading || summaryLoading;

  // client-side фильтр ролей (т.к. listRoles без params)
  const allRoles = useMemo(() => {
    const term = qRole.trim().toLowerCase();
    const arr  = Array.isArray(rolesRaw) ? rolesRaw : [];
    if (!term) return arr;
    return arr.filter(r =>
      `${r.name ?? ''} ${r.description ?? ''}`.toLowerCase().includes(term)
    );
  }, [rolesRaw, qRole]);

  // рефетч при смене userId
  useEffect(() => {
    if (userId) refetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

    // hasRole: проверяет наличие нужных данных в компоненте.
const hasRole = (roleId) => Array.isArray(summary?.roles) && summary.roles.some(r => String(r.id) === String(roleId));

    // toggleRole: переключает состояние компонента.
const toggleRole = async (role) => {
    const active = hasRole(role.id);

    try {
      if (active) await removeRoleFromUser({ userId, roleId: role.id }).unwrap();
      else        await assignRoleToUser({ userId, roleId: role.id }).unwrap();
    } catch (e) {
      console.error('toggleRole failed', e);
    } finally {
      // точный серверный снимок
      await Promise.all([refetchSummary(), refetchRoles()]);
    }
  };

  const groups = useMemo(() => {
    if (!summary?.permissions) return [];
    const term = qPerm.trim().toLowerCase();
    const map = new Map();
    for (const p of summary.permissions) {
      if (term && !(`${p.name} ${p.description||''}`.toLowerCase().includes(term))) continue;
      const cat = String(p.name).split(':')[0] || 'general';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(p);
    }
    return [...map.entries()]
      .map(([cat, items]) => ({ cat, items: items.sort((a,b)=>a.name.localeCompare(b.name)) }))
      .sort((a,b)=>a.cat.localeCompare(b.cat));
  }, [summary, qPerm]);

    // togglePerm: переключает состояние компонента.
const togglePerm = async (p, nextChecked) => {
    try {
      if (nextChecked) await allowPermForUser({ userId, permId: p.id }).unwrap();
      else             await denyPermForUser({ userId, permId: p.id }).unwrap();
    } catch (e) {
      console.error('togglePerm failed', e);
    } finally {
      await refetchSummary();
    }
  };

  if (loading) return <div className={s.panel}>Загрузка…</div>;
  if (!summary) return <div className={s.panel}>Нет данных</div>;

  return (
    <div className={s.panel}>
      <h3 className={s.h3}>Права доступа</h3>

      <div className={s.block}>
        <div className={s.blockHead}>
          <div className={s.blockTitle}>Роли пользователя</div>
          <SearchField
            inputClassName={s.input}
            placeholder="Поиск по ролям…"
            value={qRole}
            onValueChange={setQRole}
          />
        </div>
        <div className={s.roles}>
          {allRoles.map(r => {
            const active = hasRole(r.id);
            return (
              <button
                key={r.id}
                type="button"
                className={`${s.roleChip} ${active ? s.roleActive : ''}`}
                title={r.description || r.name}
                onClick={()=>toggleRole(r)}
              >
                {r.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className={s.block}>
        <div className={s.blockHead}>
          <div className={s.blockTitle}>Пермишены (эффективные)</div>
          <SearchField
            inputClassName={s.input}
            placeholder="Фильтр по пермишенам…"
            value={qPerm}
            onValueChange={setQPerm}
          />
        </div>

        {groups.map(g => (
          <Accordion key={g.cat} title={g.cat} count={g.items.length} defaultOpen={false}>
            <ul className={s.permList}>
              {g.items.map(p => {
                const checked = !!p.effective;
                return (
                  <li key={p.id} className={s.permRow}>
                    <span className={s.permName} title={p.description || p.name}>{p.name}</span>

                    <div className={s.badges}>
                      {p.viaRole      && <span className={`${s.badge} ${s.badgeRole}`}>role</span>}
                      {p.viaUserAllow && <span className={`${s.badge} ${s.badgeUser}`}>user:allow</span>}
                      {p.viaUserDeny  && <span className={`${s.badge} ${s.badgeDeny}`}>user:deny</span>}
                    </div>

                    <Switch
                      checked={checked}
                      onChange={(v)=>togglePerm(p, v)}
                      ariaLabel={`Toggle ${p.name}`}
                      color={checked ? 'success' : 'danger'}
                    />
                  </li>
                );
              })}
            </ul>
          </Accordion>
        ))}
      </div>
    </div>
  );
}
