import { useEffect, useMemo, useState } from 'react';
import Modal from '../../Modal';
import s from './DocumentDeliveryDialog.module.css';

function asText(value) {
  return String(value || '').trim();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asText(value));
}

export default function DocumentDeliveryDialog({
  open,
  title,
  documentLabel,
  documentNumber,
  defaultRecipientEmail,
  defaultRecipientSource,
  defaultSubject,
  defaultBody,
  locale,
  loading = false,
  error,
  onClose,
  onSend,
  t,
}) {
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (!open) return;
    setEmail(defaultRecipientEmail || '');
    setEmailTouched(false);
    setSubject(defaultSubject || '');
    setBody(defaultBody || '');
  }, [defaultBody, defaultRecipientEmail, defaultSubject, open]);

  const canSend = useMemo(() => isValidEmail(email) && !loading, [email, loading]);
  const recipientSource = useMemo(() => {
    const current = asText(email);
    const original = asText(defaultRecipientEmail);
    if (!current) return 'manual';
    if (!emailTouched && current === original) return defaultRecipientSource || 'manual';
    return 'manual';
  }, [defaultRecipientEmail, defaultRecipientSource, email, emailTouched]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSend) return;
    await onSend?.({
      recipientEmail: asText(email),
      subject: asText(subject),
      body: asText(body),
      locale,
    });
  };

  const helper = documentNumber
    ? `${documentLabel || t('oms.documentDelivery.document', 'Document')} ${documentNumber}`
    : documentLabel || t('oms.documentDelivery.document', 'Document');

  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      title={title || t('oms.documentDelivery.title', 'Send document')}
      size="sm"
      footer={(
        <>
          <Modal.Button type="button" onClick={onClose} disabled={loading}>
            {t('common.cancel', 'Cancel')}
          </Modal.Button>
          <Modal.Button type="submit" form="document-delivery-form" variant="primary" disabled={!canSend}>
            {loading ? t('oms.documentDelivery.sending', 'Sending...') : t('oms.documentDelivery.sendDocument', 'Send document')}
          </Modal.Button>
        </>
      )}
    >
      <form id="document-delivery-form" className={s.form} onSubmit={handleSubmit}>
        <div className={s.summary}>
          <span>{t('oms.documentDelivery.eyebrow', 'Email delivery')}</span>
          <strong>{helper}</strong>
          <small>{t('oms.documentDelivery.attachmentHint', 'A generated PDF will be attached automatically.')}</small>
          <div className={s.deliveryMeta}>
            <span>{t('oms.documentDelivery.mode.emailAttachment', 'Email with PDF attachment')}</span>
            <span>{t('oms.documentDelivery.lifecycleSeparate', 'Document delivery does not change lifecycle status.')}</span>
          </div>
        </div>

        <label className={s.field}>
          <span>{t('oms.documentDelivery.recipientEmail', 'Recipient email')}</span>
          <input
            value={email}
            onChange={(event) => {
              setEmailTouched(true);
              setEmail(event.target.value);
            }}
            placeholder={t('oms.documentDelivery.recipientPlaceholder', 'client@example.com')}
            autoComplete="email"
          />
          <small className={s.sourceHint}>
            {t(`oms.documentDelivery.sources.${recipientSource}`, t('oms.documentDelivery.sources.manual', 'Entered manually'))}
          </small>
        </label>

        <label className={s.field}>
          <span>{t('oms.documentDelivery.subject', 'Subject')}</span>
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder={t('oms.documentDelivery.subjectAuto', 'Use automatic subject')}
          />
        </label>

        <label className={s.field}>
          <span>{t('oms.documentDelivery.body', 'Message')}</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={5}
            placeholder={t('oms.documentDelivery.bodyAuto', 'Use automatic message')}
          />
        </label>

        {!isValidEmail(email) && asText(email) ? (
          <div className={s.error}>{t('oms.documentDelivery.invalidEmail', 'Enter a valid email address.')}</div>
        ) : null}
        {error ? (
          <div className={s.error}>{t('oms.documentDelivery.sendFailed', 'Could not send the document.')}</div>
        ) : null}
      </form>
    </Modal>
  );
}
