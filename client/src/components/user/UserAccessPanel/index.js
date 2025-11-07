import { useEffect, useMemo, useState } from 'react';
import Switch from '../../../components/inputs/Switch';
import s from './UserAccessPanel.module.css';

// ===== fetch shims (скорректируй пути под свой API, если отличаются)
async function fetchUserPermSummary(userId) {
  const res = await fetch(`/api/acl/users/${encodeURIComponent(userId)}/summary`, { credentials:'include' });
  if (!res.ok) throw new Error('summary failed');
  return res.json();
}
async function listRoles(params) {
  const q = params?.q ? `?q=${encodeURIComponent(params.q)}` : '';
  const res = await fetch(`/api/acl/roles${q}`, { credentials:'include' });
  if (!res.ok) throw new Error('roles failed');
  return res.json();
}
async function assignRoleToUser(userId, roleId) {
  const res = await fetch(`/api/acl/users/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`, {
    method:'POST', credentials:'include'
  });
  if (!res.ok) throw new Error('assign failed');
  return res.json().catch(()=>({ok:true}));
}
async function removeRoleFromUser(userId, roleId) {
  const res = await fetch(`/api/acl/users/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`, {
    method:'DELETE', credentials:'include'
  });
  if (!res.ok) throw new Error('remove failed');
  return res.json().catch(()=>({ok:true}));
}
async function allowPermForUser(userId, permId) {
  const res = await fetch(`/api/acl/users/${encodeURIComponent(userId)}/permissions/${encodeURIComponent(permId)}`, {
    method:'POST', credentials:'include',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ action:'allow' }),
  });
  if (!res.ok) throw new Error('allow failed');
  return res.json().catch(()=>({ok:true}));
}
async function denyPermForUser(userId, permId) {
  const res = await fetch(`/api/acl/users/${encodeURIComponent(userId)}/permissions/${encodeURIComponent(permId)}`, {
    method:'POST', credentials:'include',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ action:'deny' }),
  });
  if (!res.ok) throw new Error('deny failed');
  return res.json().catch(()=>({ok:true}));
}

/** Простой аккордеон */
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

export default function UserAccessPanel({ userId }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [allRoles, setAllRoles] = useState([]);
  const [qRole, setQRole] = useState('');
  const [qPerm, setQPerm] = useState('');

  const refetch = async () => {
    setLoading(true);
    try {
      const [s, roles] = await Promise.all([
        fetchUserPermSummary(userId),
        listRoles(qRole ? { q: qRole } : undefined),
      ]);
      setSummary(s);
      setAllRoles(roles);
    } finally { setLoading(false); }
  };

  useEffect(() => { refetch(); /* eslint-disable-line */ }, [userId, qRole]);

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

  if (loading) return <div className={s.panel}>Загрузка…</div>;
  if (!summary) return <div className={s.panel}>Нет данных</div>;

  const hasRole = (roleId) => summary.roles?.some(r => r.id === roleId);

  const toggleRole = async (role) => {
    const active = hasRole(role.id);
    setSummary(prev => prev ? { ...prev,
      roles: active ? prev.roles.filter(r => r.id !== role.id) : [...prev.roles, role]
    } : prev);
    try {
      if (active) await removeRoleFromUser(userId, role.id);
      else        await assignRoleToUser(userId, role.id);
      await refetch();
    } catch (e) {
      await refetch();
      console.error('toggleRole failed', e);
    }
  };

  const patchPermLocal = (permId, patch) => {
    setSummary(prev => {
      if (!prev) return prev;
      const next = prev.permissions.map(p => p.id === permId ? { ...p, ...patch } : p);
      return { ...prev, permissions: next };
    });
  };

  const togglePerm = async (p, nextChecked) => {
    const prevState = {
      viaUserAllow: !!p.viaUserAllow,
      viaUserDeny : !!p.viaUserDeny,
      effective   : !!p.effective,
    };

    if (nextChecked) {
      patchPermLocal(p.id, { viaUserAllow: true, viaUserDeny: false, effective: true });
    } else {
      patchPermLocal(p.id, { viaUserAllow: false, viaUserDeny: true, effective: false });
    }

    try {
      if (nextChecked) await allowPermForUser(userId, p.id);
      else             await denyPermForUser(userId, p.id);
    } catch (e) {
      patchPermLocal(p.id, prevState);
      console.error('togglePerm failed', e);
    }
  };

  return (
    <div className={s.panel}>
      <h3 className={s.h3}>Права доступа</h3>

      <div className={s.block}>
        <div className={s.blockHead}>
          <div className={s.blockTitle}>Роли пользователя</div>
          <input
            className={s.input}
            placeholder="Поиск по ролям…"
            value={qRole}
            onChange={(e)=>setQRole(e.target.value)}
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
          <input
            className={s.input}
            placeholder="Фильтр по пермишенам…"
            value={qPerm}
            onChange={(e)=>setQPerm(e.target.value)}
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