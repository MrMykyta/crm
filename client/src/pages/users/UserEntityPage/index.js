import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import EntityDetailPage from '../../_scaffold/EntityDetailPage';
import { userSchema, toFormUser, toApiUser } from '../../../schemas/user.schema';
import UserAvatarHeader from '../../../components/user/UserAvatarHeader';
import UserAccessPanel from '../../../components/user/UserAccessPanel';

// fetch shims
async function getUserById(userId) {
  const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, { credentials:'include' });
  if (!res.ok) throw new Error('load user failed');
  return res.json();
}
async function updateUserById(userId, payload) {
  const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
    method:'PATCH',
    credentials:'include',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('update user failed');
  return res.json();
}

export default function UserEntityPage() {
  const { userId } = useParams();
  const [base, setBase] = useState(null);
  const [err, setErr]   = useState('');

  useEffect(() => {
    if (!userId) { setErr('No userId in URL'); return; }
    let ignore = false;
    (async () => {
      try {
        setErr('');
        const data = await getUserById(userId);
        if (!ignore) setBase(data);
      } catch (e) { if (!ignore) setErr(e?.message || 'Failed to load user'); }
    })();
    return () => { ignore = true; };
  }, [userId]);

  if (!userId) return <div style={{padding:16,color:'var(--danger)'}}>userId отсутствует в URL</div>;
  if (err)      return <div style={{padding:16,color:'var(--danger)'}}>{err}</div>;
  if (!base)    return null;

  const load = async () => base;
  const save = async (_id, payload) => {
    const saved = await updateUserById(userId, payload);
    setBase(saved);
    return saved;
  };

  return (
    <EntityDetailPage
      id={userId}
      tabs={[
        { key: 'access', label: 'Права доступа' },
      ]}
      tabsNamespace="admin.user.detail"
      schemaBuilder={userSchema}
      toForm={toFormUser}
      toApi={toApiUser}
      load={load}
      save={save}
      storageKeyPrefix="user"
      autosave={{ debounceMs: 500 }}
      clearDraftOnUnmount
      leftTop={({ values, onChange }) => (
        <UserAvatarHeader values={values} onChange={onChange} />
      )}
      RightTabsComponent={({ tab }) =>
        tab === 'access' ? <UserAccessPanel userId={userId} /> : null
      }
    />
  );
}