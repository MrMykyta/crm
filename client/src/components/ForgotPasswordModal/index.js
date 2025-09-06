import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { requestPasswordReset } from '../../api/auth';
import styles from './ForgotPasswordModal.module.css';

export default function ForgotPasswordModal({ open, onClose, initialEmail = '' }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState(null); // 'ok' | 'error' | null
  const [loading, setLoading] = useState(false);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setEmail(initialEmail);
    setStatus(null);
    setLoading(false);
    setTimeout(() => closeRef.current?.focus(), 0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open, initialEmail]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setStatus(null);
    try {
      await requestPasswordReset(email);
      setStatus('ok');
    } catch (err) {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="fp-title">
      <div className={styles.modal}>
        <div className={styles.icon}>🔒</div>
        <h3 id="fp-title" className={styles.title}>{t('auth.forgotTitle', 'Forgot password?')}</h3>
        <p className={styles.subtitle}>{t('auth.forgotSubtitle', 'Enter your email and we will send a reset link.')}</p>

        <form onSubmit={submit} className={styles.form}>
          <div className={styles.field}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder=" "
              required
            />
            <label>{t('common.email')}</label>
          </div>

          {status === 'ok' && <div className={styles.ok}>{t('auth.resetSent', 'Reset link sent. Please check your inbox.')}</div>}
          {status === 'error' && <div className={styles.err}>{t('auth.resetFailed', 'Failed to send reset email')}</div>}

          <div className={styles.actions}>
            <button className={styles.primary} type="submit" disabled={loading}>
              {loading ? t('common.sending', 'Sending…') : t('auth.sendReset', 'Send reset link')}
            </button>
            <button ref={closeRef} type="button" className={styles.link} onClick={onClose}>
              {t('common.close')}
            </button>
          </div>
        </form>

        <div className={styles.hint}>{t('auth.resetHint', 'You will receive an email with a link to set a new password.')}</div>
      </div>
    </div>
  );
}