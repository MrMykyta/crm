import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CustomerDocumentRenderer from '../../components/oms/CustomerDocumentRenderer';
import { apiBase, withApiOrigin } from '../../config/api';
import s from './PublicDocumentPage.module.css';

function formatDate(value, locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(+date)) return '—';
  return date.toLocaleString(locale || undefined);
}

export default function PublicDocumentPage() {
  const { token } = useParams();
  const { t, i18n } = useTranslation();
  const [state, setState] = useState({ loading: true, error: '', data: null });

  useEffect(() => {
    let alive = true;
    setState({ loading: true, error: '', data: null });
    fetch(`${apiBase}/public-documents/${encodeURIComponent(token || '')}`, {
      method: 'GET',
      credentials: 'omit',
    })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          const code = json?.code || json?.error?.code || response.status;
          throw new Error(String(code));
        }
        return json?.data || json;
      })
      .then((data) => {
        if (alive) setState({ loading: false, error: '', data });
      })
      .catch((error) => {
        if (alive) setState({ loading: false, error: error.message || 'LOAD_FAILED', data: null });
      });
    return () => {
      alive = false;
    };
  }, [token]);

  const downloadUrl = useMemo(() => {
    const url = state.data?.meta?.downloadUrl;
    return url ? withApiOrigin(url) : '';
  }, [state.data?.meta?.downloadUrl]);

  if (state.loading) {
    return <div className={s.state}>{t('oms.publicDocument.loading', 'Loading document...')}</div>;
  }

  if (state.error || !state.data?.document) {
    const expired = state.error === 'SHARE_EXPIRED' || state.error === '410';
    return (
      <div className={s.state}>
        <strong>{expired ? t('oms.publicDocument.expired', 'This link is no longer active.') : t('oms.publicDocument.unavailable', 'Document unavailable.')}</strong>
        <span>{t('oms.publicDocument.unavailableHint', 'Ask the sender for a new secure link.')}</span>
      </div>
    );
  }

  return (
    <main className={s.page}>
      <header className={s.header}>
        <div>
          <span>{t('oms.publicDocument.eyebrow', 'Shared document')}</span>
          <strong>{state.data.document?.entity?.number || state.data.document?.type || t('oms.publicDocument.document', 'Document')}</strong>
        </div>
        <div className={s.headerMeta}>
          <span>{t('oms.publicDocument.expiresAt', 'Expires')}: {formatDate(state.data.meta?.expiresAt, i18n.language)}</span>
          {downloadUrl ? (
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
              {t('oms.publicDocument.downloadPdf', 'Download PDF')}
            </a>
          ) : null}
        </div>
      </header>
      <section className={s.paper}>
        <CustomerDocumentRenderer dto={state.data.document} />
      </section>
    </main>
  );
}
