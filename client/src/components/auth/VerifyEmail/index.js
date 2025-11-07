import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import s from './Verify.module.css';

const useQuery = () => new URLSearchParams(useLocation().search);

// fetch shim
async function verifyEmailFetch(token) {
  const res = await fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`, {
    credentials:'include'
  });
  if (!res.ok) return { verified: false };
  return res.json().catch(()=>({ verified:true }));
}

export default function VerifyEmail() {
  const q = useQuery();
  const token = q.get('token');
  const email = q.get('email');
  const navigate = useNavigate();
  const [state, setState] = useState({ status: token ? 'verifying' : 'idle', msg: '' });

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await verifyEmailFetch(token);
        if (res?.verified) {
          setState({ status: 'success', msg: 'Verified' });
          setTimeout(() => navigate('/auth/company-setup'), 100);
        } else {
          setState({ status: 'error', msg: 'Verification failed' });
        }
      } catch (e) {
        setState({ status: 'error', msg: e?.message || 'Error' });
      }
    })();
  }, [token, navigate]);

  if (!token) {
    return (
      <div className={s.box}>
        <h2>Check your email</h2>
        <p>We sent a link to <b>{email || 'your inbox'}</b>. Click it to continue.</p>
      </div>
    );
  }

  return (
    <div className={s.box}>
      {state.status === 'verifying' && <h2>Verifying…</h2>}
      {state.status === 'success' && <h2>Verified ✅ Redirecting…</h2>}
      {state.status === 'error' && (<><h2>Verification error</h2><p>{state.msg}</p></>)}
    </div>
  );
}