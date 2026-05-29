import { useTranslation } from 'react-i18next';

export default function OmsStubPage({ titleKey, fallbackTitle }) {
  const { t } = useTranslation();

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ margin: 0, fontSize: 20 }}>{t(titleKey, fallbackTitle)}</h2>
      <p style={{ marginTop: 12, color: 'var(--textSecondary, #6b7280)' }}>
        {t('oms.stub', 'This page is planned for the next stage.')}
      </p>
    </div>
  );
}
