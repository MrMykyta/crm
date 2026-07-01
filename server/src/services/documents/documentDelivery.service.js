'use strict';

const fs = require('fs/promises');
const path = require('path');
const AppError = require('../../errors/AppError');
const { Contact, ContactPoint, Counterparty, Document, File } = require('../../models');
const { STORAGE_ROOT } = require('../../config/files');
const mailer = require('../system/mailer');
const eventService = require('../system/eventService');
const generatedDocumentService = require('./generatedDocument.service');
const offerService = require('../oms/offerService');
const invoiceService = require('../oms/invoiceService');
const creditNoteService = require('../oms/creditNoteService');

const ENTITY_CONFIG = Object.freeze({
  offer: {
    documentType: 'OFFER',
    label: { en: 'Offer', pl: 'Oferta', ru: 'Предложение', ua: 'Пропозиція' },
    load: ({ id, user }) => offerService.getOfferById(id, user),
    updateAfterSend: async ({ entity, user }) => {
      const status = String(entity?.status || '').toLowerCase();
      if (status === 'draft') {
        return offerService.changeOfferStatus(entity.id, 'sent', {
          internalNotesAppend: null,
        }, user);
      }
      return entity;
    },
  },
  invoice: {
    documentType: 'INVOICE',
    label: { en: 'Invoice', pl: 'Faktura', ru: 'Счёт', ua: 'Рахунок' },
    load: ({ id, user }) => invoiceService.get(id, user),
    updateAfterSend: async ({ entity }) => entity,
  },
  credit_note: {
    documentType: 'CREDIT_NOTE',
    label: { en: 'Credit note', pl: 'Korekta', ru: 'Корректировка', ua: 'Коригування' },
    load: ({ id, user }) => creditNoteService.getById({ companyId: user.companyId, id }),
    updateAfterSend: async ({ entity }) => entity,
  },
});

const MAIL_TEMPLATES = Object.freeze({
  en: {
    subject: ({ label, number }) => `${label}${number ? ` ${number}` : ''}`,
    body: ({ label, number }) => [
      '<p>Hello,</p>',
      `<p>Please find attached ${label.toLowerCase()}${number ? ` ${escapeHtml(number)}` : ''}.</p>`,
      '<p>Best regards</p>',
    ].join(''),
  },
  pl: {
    subject: ({ label, number }) => `${label}${number ? ` ${number}` : ''}`,
    body: ({ label, number }) => [
      '<p>Dzień dobry,</p>',
      `<p>W załączniku przesyłamy ${label.toLowerCase()}${number ? ` ${escapeHtml(number)}` : ''}.</p>`,
      '<p>Z poważaniem</p>',
    ].join(''),
  },
  ru: {
    subject: ({ label, number }) => `${label}${number ? ` ${number}` : ''}`,
    body: ({ label, number }) => [
      '<p>Здравствуйте,</p>',
      `<p>Во вложении отправляем ${label.toLowerCase()}${number ? ` ${escapeHtml(number)}` : ''}.</p>`,
      '<p>С уважением</p>',
    ].join(''),
  },
  ua: {
    subject: ({ label, number }) => `${label}${number ? ` ${number}` : ''}`,
    body: ({ label, number }) => [
      '<p>Вітаємо,</p>',
      `<p>У вкладенні надсилаємо ${label.toLowerCase()}${number ? ` ${escapeHtml(number)}` : ''}.</p>`,
      '<p>З повагою</p>',
    ].join(''),
  },
});

function normalizeEntityType(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'creditnote' || text === 'credit-note') return 'credit_note';
  return text;
}

function normalizeLocale(value) {
  const text = String(value || '').trim().toLowerCase();
  return MAIL_TEMPLATES[text] ? text : 'pl';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function getEntityNumber(entity) {
  return entity?.number || entity?.title || entity?.id || '';
}

function getCounterpartyId(entity) {
  return entity?.counterpartyId ||
    entity?.customerId ||
    entity?.counterparty?.id ||
    entity?.customer?.id ||
    entity?.order?.customerId ||
    entity?.sourceOrder?.customerId ||
    null;
}

function getDirectContact(entity) {
  const contact = entity?.contact || entity?.primaryContact || null;
  if (!contact?.email) return null;
  return {
    email: contact.email,
    name: contact.name || contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || null,
  };
}

function contactName(contact) {
  if (!contact) return null;
  return contact.name || contact.fullName || contact.displayName || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || null;
}

async function findPrimaryContactPerson({ companyId, counterpartyId }) {
  if (!companyId || !counterpartyId) return null;
  return Contact.findOne({
    where: {
      companyId,
      counterpartyId,
      status: 'active',
    },
    order: [
      ['isPrimary', 'DESC'],
      ['createdAt', 'ASC'],
    ],
  });
}

async function findPrimaryContactEmailPoint({ companyId, contactId }) {
  if (!companyId || !contactId) return null;
  const point = await ContactPoint.findOne({
    where: {
      companyId,
      ownerType: 'contact',
      ownerId: contactId,
      channel: 'email',
    },
    order: [
      ['isPrimary', 'DESC'],
      ['createdAt', 'ASC'],
    ],
  });
  if (!point?.valueRaw || !isValidEmail(point.valueRaw)) return null;
  return {
    email: point.valueRaw,
    name: point.label || null,
  };
}

async function findPrimaryCounterpartyEmail({ companyId, counterpartyId }) {
  if (!companyId || !counterpartyId) return null;
  const point = await ContactPoint.findOne({
    where: {
      companyId,
      ownerType: 'counterparty',
      ownerId: counterpartyId,
      channel: 'email',
    },
    order: [
      ['isPrimary', 'DESC'],
      ['createdAt', 'ASC'],
    ],
  });
  if (!point?.valueRaw || !isValidEmail(point.valueRaw)) return null;
  return {
    email: point.valueRaw,
    name: point.label || null,
  };
}

async function findCounterpartyLegacyEmail({ companyId, counterpartyId }) {
  if (!companyId || !counterpartyId) return null;
  const counterparty = await Counterparty.findOne({ where: { id: counterpartyId, companyId } });
  const email = counterparty?.email || counterparty?.primaryEmail || counterparty?.billingEmail || counterparty?.contactEmail || null;
  if (!email || !isValidEmail(email)) return null;
  return {
    email,
    name: counterparty.shortName || counterparty.fullName || counterparty.name || null,
  };
}

async function resolveRecipient({ entity, user, recipientEmail, recipientName }) {
  const manualEmail = String(recipientEmail || '').trim();
  if (manualEmail) {
    if (!isValidEmail(manualEmail)) {
      throw new AppError(400, 'Recipient email is invalid', { code: 'VALIDATION_ERROR' });
    }
    return {
      email: manualEmail,
      name: String(recipientName || '').trim() || null,
      source: 'manual',
    };
  }

  const counterpartyId = getCounterpartyId(entity);
  const primaryCounterpartyEmail = await findPrimaryCounterpartyEmail({
    companyId: user.companyId,
    counterpartyId,
  });
  if (primaryCounterpartyEmail?.email) {
    return { ...primaryCounterpartyEmail, source: 'counterparty_primary_email' };
  }

  const primaryContact = await findPrimaryContactPerson({
    companyId: user.companyId,
    counterpartyId,
  });
  const primaryContactPoint = await findPrimaryContactEmailPoint({
    companyId: user.companyId,
    contactId: primaryContact?.id,
  });
  if (primaryContactPoint?.email) {
    return {
      ...primaryContactPoint,
      name: primaryContactPoint.name || contactName(primaryContact),
      source: 'primary_contact_email_point',
    };
  }

  const direct = getDirectContact(entity);
  if (direct?.email && isValidEmail(direct.email)) {
    return { ...direct, source: 'contact_legacy_email' };
  }

  if (primaryContact?.email && isValidEmail(primaryContact.email)) {
    return {
      email: primaryContact.email,
      name: contactName(primaryContact),
      source: 'contact_legacy_email',
    };
  }

  const counterpartyLegacy = await findCounterpartyLegacyEmail({
    companyId: user.companyId,
    counterpartyId,
  });
  if (counterpartyLegacy?.email) {
    return { ...counterpartyLegacy, source: 'counterparty_legacy_email' };
  }

  throw new AppError(400, 'Recipient email is required', { code: 'RECIPIENT_REQUIRED' });
}

async function findLatestGeneratedDocument({ companyId, entityType, entityId }) {
  return Document.findOne({
    where: {
      companyId,
      sourceEntityType: entityType,
      sourceEntityId: entityId,
    },
    order: [
      ['generatedAt', 'DESC'],
      ['createdAt', 'DESC'],
    ],
  });
}

async function ensureGeneratedDocument({ entityType, entityId, user, locale, templateId, documentId }) {
  if (documentId) {
    const document = await Document.findOne({
      where: {
        id: documentId,
        companyId: user.companyId,
        sourceEntityType: entityType,
        sourceEntityId: entityId,
      },
    });
    if (!document) throw new AppError(404, 'Generated document not found', { code: 'NOT_FOUND' });
    if (!document.fileId) throw new AppError(409, 'Generated document has no PDF file', { code: 'DOCUMENT_FILE_MISSING' });
    return { document: document.get({ plain: true }), generated: false };
  }

  const existing = await findLatestGeneratedDocument({ companyId: user.companyId, entityType, entityId });
  if (existing?.fileId) {
    return { document: existing.get({ plain: true }), generated: false };
  }

  const result = await generatedDocumentService.generateForEntity({
    entityType,
    entityId,
    user,
    locale,
    templateId,
  });
  return { document: result.document, generated: true };
}

async function loadAttachment(document) {
  const file = await File.findOne({ where: { id: document.fileId, companyId: document.companyId } });
  if (!file) throw new AppError(404, 'Generated PDF file not found', { code: 'NOT_FOUND' });
  if (file.mime !== 'application/pdf') {
    throw new AppError(409, 'Generated file is not a PDF', { code: 'INVALID_DOCUMENT_FILE' });
  }
  const absolutePath = path.join(STORAGE_ROOT, file.storagePath);
  const content = await fs.readFile(absolutePath);
  return {
    file: file.get({ plain: true }),
    attachment: {
      filename: file.filename || `${document.number || document.id}.pdf`,
      content,
      contentType: 'application/pdf',
    },
  };
}

function buildTemplate({ entityType, entity, locale, subject, body }) {
  const config = ENTITY_CONFIG[entityType];
  const template = MAIL_TEMPLATES[locale] || MAIL_TEMPLATES.pl;
  const label = config.label[locale] || config.label.pl;
  const number = getEntityNumber(entity);
  return {
    subject: String(subject || '').trim() || template.subject({ label, number }),
    html: String(body || '').trim() || template.body({ label, number }),
  };
}

async function sendEmail({ entityType, entityId, user, payload = {} }) {
  const normalizedEntityType = normalizeEntityType(entityType);
  const config = ENTITY_CONFIG[normalizedEntityType];
  if (!config) {
    throw new AppError(400, 'Unsupported document delivery entity type', { code: 'VALIDATION_ERROR' });
  }
  if (!user?.companyId) throw new AppError(403, 'Company context required');
  if (!entityId) throw new AppError(400, 'entityId is required', { code: 'VALIDATION_ERROR' });

  const locale = normalizeLocale(payload.locale);
  const entity = await config.load({ id: entityId, user });
  if (!entity) throw new AppError(404, 'Entity not found', { code: 'NOT_FOUND' });

  const recipient = await resolveRecipient({
    entity,
    user,
    recipientEmail: payload.recipientEmail || payload.email,
    recipientName: payload.recipientName,
  });
  const generated = await ensureGeneratedDocument({
    entityType: normalizedEntityType,
    entityId,
    user,
    locale,
    templateId: payload.templateId || null,
    documentId: payload.documentId || null,
  });
  const { file, attachment } = await loadAttachment(generated.document);
  const mail = buildTemplate({
    entityType: normalizedEntityType,
    entity,
    locale,
    subject: payload.subject,
    body: payload.body,
  });

  const mailResult = await mailer.sendMail({
    to: recipient.email,
    subject: mail.subject,
    html: mail.html,
    attachments: [attachment],
  });

  const updatedEntity = await config.updateAfterSend({ entity, user, payload });
  const timestamp = new Date();
  await eventService.create(
    user.companyId,
    'document.delivery.sent',
    {
      channel: 'email',
      entityType: normalizedEntityType,
      entityId,
      documentId: generated.document.id,
      fileId: file.id,
      recipient,
      subject: mail.subject,
      generatedDocumentCreated: generated.generated,
      userId: user.id || null,
      providerMessageId: mailResult?.messageId || null,
      dryRun: Boolean(mailResult?.dryRun),
      sentAt: timestamp,
    },
    { type: normalizedEntityType, id: entityId }
  );

  return {
    ok: true,
    channel: 'email',
    entityType: normalizedEntityType,
    entityId,
    recipient,
    document: generated.document,
    file,
    generatedDocumentCreated: generated.generated,
    messageId: mailResult?.messageId || null,
    dryRun: Boolean(mailResult?.dryRun),
    sentAt: timestamp,
    entity: updatedEntity,
  };
}

module.exports = {
  sendEmail,
};
