import { FileText, Mail, Share2 } from 'lucide-react';
import s from './DocumentActionStrip.module.css';

export default function DocumentActionStrip({
  t,
  title,
  subtitle,
  onGeneratePdf,
  pdfLoading = false,
  pdfDisabled = false,
  pdfOpened = false,
  pdfFallbackUrl = '',
  onSend,
  sendLoading = false,
  sendDisabled = false,
  onShare,
  shareDisabled = false,
  error,
}) {
  return (
    <div className={s.strip}>
      <div className={s.copy}>
        <span>{t('oms.documentActions.eyebrow', 'Document')}</span>
        <strong>{title || t('oms.documentActions.title', 'Customer document')}</strong>
        <small>{subtitle || t('oms.documentActions.subtitle', 'Preview, generate PDF, email, or create a customer link from one place.')}</small>
        {pdfOpened ? <small className={s.success}>{t('oms.generatedDocuments.success.openedNewTab', 'PDF was created and opened in a new tab.')}</small> : null}
        {pdfFallbackUrl ? (
          <small className={s.warning}>
            {t('oms.generatedDocuments.success.popupBlocked', 'PDF was created. If it did not open automatically, open it manually.')}
            {' '}
            <a href={pdfFallbackUrl} target="_blank" rel="noreferrer">
              {t('oms.generatedDocuments.actions.openPdf', 'Open PDF')}
            </a>
          </small>
        ) : null}
        {error ? <small className={s.error}>{t('oms.generatedDocuments.errors.generateFailed', 'Could not generate PDF')}</small> : null}
      </div>
      <div className={s.actions}>
        <button type="button" className={s.action} onClick={onGeneratePdf} disabled={pdfDisabled || pdfLoading}>
          <FileText size={14} aria-hidden="true" />
          {pdfLoading ? t('oms.generatedDocuments.actions.generating', 'Generating...') : t('oms.generatedDocuments.actions.generatePdf', 'Generate PDF')}
        </button>
        <button type="button" className={s.action} onClick={onSend} disabled={sendDisabled || sendLoading}>
          <Mail size={14} aria-hidden="true" />
          {sendLoading ? t('oms.documentDelivery.sending', 'Sending...') : t('oms.documentDelivery.sendDocument', 'Send document')}
        </button>
        <button type="button" className={s.action} onClick={onShare} disabled={shareDisabled}>
          <Share2 size={14} aria-hidden="true" />
          {t('oms.documentShare.share', 'Share')}
        </button>
      </div>
    </div>
  );
}
