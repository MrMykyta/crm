// src/pages/Auth/VerifyEmail.jsx
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useVerifyEmailMutation } from '../../../store/rtk/authApi';
import s from './Verify.module.css';

export default function VerifyEmail() {
  const [sp] = useSearchParams();
  const token = sp.get('token');
  const email = sp.get('email');
  const navigate = useNavigate();

  const [verifyEmail, { isLoading }] = useVerifyEmailMutation();
  const [state, setState] = useState({ status: token ? 'verifying' : 'idle', msg: '' });

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        // ВАЖНО: вызываем RTK-мутацию — onQueryStarted положит токены в Redux
        const data = await verifyEmail(token).unwrap();

        // На всякий случай проверим флаг
        if (data?.verified !== false) {
          setState({ status: 'success', msg: 'Verified' });
          // Навигацию делаем уже после того, как токены попали в стор
          navigate('/auth/company-setup', { replace: true });
        } else {
          setState({ status: 'error', msg: 'Verification failed' });
        }
      } catch (e) {
        const msg = e?.data?.error || e?.data?.message || e?.message || 'Error';
        setState({ status: 'error', msg });
      }
    })();
  }, [token, verifyEmail, navigate]);

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
      {(state.status === 'verifying' || isLoading) && <h2>Verifying…</h2>}
      {state.status === 'success' && <h2>Verified ✅ Redirecting…</h2>}
      {state.status === 'error' && (<><h2>Verification error</h2><p>{state.msg}</p></>)}
    </div>
  );
}