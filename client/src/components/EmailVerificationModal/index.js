import { useEffect, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './EmailVerificationModal.module.css';

function getMailboxUrl(email) {
  if (!email) return null;
  const domain = String(email.split('@')[1] || '').toLowerCase().trim();

  const direct = {
    // глобальные
    'gmail.com':      'https://mail.google.com/',
    'googlemail.com': 'https://mail.google.com/',
    'yahoo.com':      'https://mail.yahoo.com/',
    'proton.me':      'https://mail.proton.me/',
    'zoho.com':       'https://mail.zoho.com/',
    'yandex.ru':      'https://mail.yandex.com/',
    'yandex.com':     'https://mail.yandex.com/',
    // Apple
    'icloud.com':     'https://www.icloud.com/mail',
    'me.com':         'https://www.icloud.com/mail',
    'mac.com':        'https://www.icloud.com/mail',
    // Польша
    'wp.pl':          'https://poczta.wp.pl/',
    'o2.pl':          'https://poczta.o2.pl/',
    'op.pl':          'https://poczta.o2.pl/',
    'interia.pl':     'https://poczta.interia.pl/',
    'onet.pl':        'https://poczta.onet.pl/',
    'gazeta.pl':      'https://poczta.gazeta.pl/',
  };
  if (direct[domain]) return direct[domain];

  const endsWithAny = (arr) => arr.some(suf => domain.endsWith(suf));
  if (endsWithAny(['outlook.com', 'outlook.pl', 'outlook.de', 'outlook.co.uk'])) return 'https://outlook.live.com/';
  if (endsWithAny(['hotmail.com', 'hotmail.co.uk', 'hotmail.fr'])) return 'https://outlook.live.com/';
  if (domain.startsWith('live.') || domain.endsWith('.live.com')) return 'https://outlook.live.com/';

  return null;
}

export default function EmailVerificationModal({
  open,
  email,
  onClose,
  onResend, // (email:string) => Promise<void> | void
}) {
  const { t } = useTranslation();
  const closeRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const providerUrl = useMemo(() => getMailboxUrl(email), [email]);

  useEffect(() => {
    if (!open) return;
    setLoading(false);
    setTimeout(() => closeRef.current?.focus(), 0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const handleResend = async () => {
    if (!email || !onResend) return;
    try {
      setLoading(true);
      await onResend(email);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="evm-title">
      <div className={styles.modal}>
        <div className={styles.icon}>📬</div>
        <h3 id="evm-title" className={styles.title}>
          {t('auth.verifyTitle', 'Check your email')}
        </h3>
        {email && (
          <p className={styles.subtitle}>
            {t('auth.verifySentTo', 'We sent a verification link to')} <b>{email}</b>
          </p>
        )}

        <div className={styles.actions}>
          {providerUrl && (
            <a
              className={styles.primary}
              href={providerUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              {t('auth.openMailbox', 'Open mailbox')}
            </a>
          )}

          <button
            type="button"                 // 👈 важно, чтобы форма не сабмитилась
            className={styles.secondary}
            onClick={handleResend}
            disabled={!email || loading}
          >
            {loading
              ? t('common.sending', 'Sending…')
              : t('auth.resendEmail', 'Resend verification email')}
          </button>

          <button
            type="button"
            ref={closeRef}
            className={styles.link}
            onClick={onClose}
          >
            {t('common.close', 'Close')}
          </button>
        </div>

        <div className={styles.hint}>
          {t('auth.verifyHint', 'Click the link in the email to continue.')}
        </div>
      </div>
    </div>
  );
}