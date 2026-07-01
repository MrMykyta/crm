import { useMemo, useState } from 'react';
import Modal from '../../Modal';
import s from './DocumentShareDialog.module.css';

function formatDate(value, locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(+date)) return '—';
  return date.toLocaleString(locale || undefined);
}

function isActiveShare(share) {
  if (!share || share.revokedAt) return false;
  if (share.expiresAt && new Date(share.expiresAt) <= new Date()) return false;
  return true;
}

export default function DocumentShareDialog({
  open,
  entityType,
  entityId,
  documentLabel,
  documentNumber,
  locale,
  shares = [],
  loading = false,
  creating = false,
  revoking = false,
  error,
  onClose,
  onCreate,
  onRevoke,
  t,
}) {
  const [copiedId, setCopiedId] = useState('');
  const activeShares = useMemo(() => shares.filter(isActiveShare), [shares]);
  const latest = activeShares[0] || null;

  const copyLink = async (share) => {
    if (!share?.url) return;
    await navigator.clipboard?.writeText(share.url);
    setCopiedId(share.id);
  };

  const title = documentNumber
    ? `${documentLabel || t('oms.documentShare.document', 'Document')} ${documentNumber}`
    : documentLabel || t('oms.documentShare.document', 'Document');

  return (
    <Modal
      open={open}
      onClose={creating || revoking ? undefined : onClose}
      title={t('oms.documentShare.title', 'Public share')}
      size="sm"
      footer={(
        <>
          <Modal.Button type="button" onClick={onClose} disabled={creating || revoking}>
            {t('common.close', 'Close')}
          </Modal.Button>
          <Modal.Button
            type="button"
            variant="primary"
            onClick={() => onCreate?.({ entityType, entityId, locale })}
            disabled={!entityId || creating || loading}
          >
            {creating ? t('oms.documentShare.generating', 'Generating...') : t('oms.documentShare.generate', 'Generate link')}
          </Modal.Button>
        </>
      )}
    >
      <div className={s.wrap}>
        <div className={s.summary}>
          <span>{t('oms.documentShare.eyebrow', 'Read-only customer access')}</span>
          <strong>{title}</strong>
          <small>{t('oms.documentShare.hint', 'The public link opens a read-only customer document. Internal notes, owners, margins, costs, and system fields are not exposed.')}</small>
        </div>

        {error ? <div className={s.error}>{t('oms.documentShare.error', 'Could not update public link.')}</div> : null}
        {loading ? <div className={s.empty}>{t('common.loading', 'Loading...')}</div> : null}

        {!loading && latest ? (
          <div className={s.linkCard}>
            <label>
              <span>{t('oms.documentShare.publicUrl', 'Public URL')}</span>
              <input value={latest.url || ''} readOnly />
            </label>
            <div className={s.metaGrid}>
              <div>
                <span>{t('oms.documentShare.expiresAt', 'Expires')}</span>
                <strong>{formatDate(latest.expiresAt, locale)}</strong>
              </div>
              <div>
                <span>{t('oms.documentShare.views', 'Views')}</span>
                <strong>{latest.viewCount || 0}</strong>
              </div>
              <div>
                <span>{t('oms.documentShare.downloads', 'Downloads')}</span>
                <strong>{latest.downloadCount || 0}</strong>
              </div>
            </div>
            <div className={s.actions}>
              <button type="button" onClick={() => copyLink(latest)}>
                {copiedId === latest.id ? t('oms.documentShare.copied', 'Copied') : t('oms.documentShare.copy', 'Copy')}
              </button>
              <a href={latest.url} target="_blank" rel="noopener noreferrer">
                {t('oms.documentShare.open', 'Open')}
              </a>
              <button type="button" className={s.danger} onClick={() => onRevoke?.(latest)} disabled={revoking}>
                {revoking ? t('oms.documentShare.revoking', 'Revoking...') : t('oms.documentShare.revoke', 'Revoke')}
              </button>
            </div>
          </div>
        ) : null}

        {!loading && !latest ? (
          <div className={s.empty}>{t('oms.documentShare.empty', 'No active public link yet.')}</div>
        ) : null}
      </div>
    </Modal>
  );
}
