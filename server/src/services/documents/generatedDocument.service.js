'use strict';

const path = require('path');
const AppError = require('../../errors/AppError');
const { Company, Document } = require('../../models');
const offerService = require('../oms/offerService');
const invoiceService = require('../oms/invoiceService');
const creditNoteService = require('../oms/creditNoteService');
const fileService = require('../system/fileService');
const {
  resolveActiveTemplateForDocument,
} = require('./template/activeTemplateResolver.service');
const { renderTemplatePdf } = require('./render/pdf.service');
const {
  buildCreditNoteDocumentDto,
  buildDocumentDataContext,
  buildInvoiceDocumentDto,
  buildOfferDocumentDto,
  getDocumentTypeKey,
} = require('./render/customerDocumentAdapter');

const ENTITY_TYPES = Object.freeze({
  offer: {
    documentType: 'OFFER',
    ownerPermission: 'offer:update',
    load: async ({ id, user, locale }) => {
      const offer = await offerService.getOfferById(id, user);
      return {
        dto: buildOfferDocumentDto({ offer, locale }),
        entity: offer,
      };
    },
  },
  invoice: {
    documentType: 'INVOICE',
    ownerPermission: 'order:update',
    load: async ({ id, user, locale }) => {
      const invoice = await invoiceService.get(id, user);
      if (!invoice) throw new AppError(404, 'Invoice not found', { code: 'NOT_FOUND' });
      return {
        dto: buildInvoiceDocumentDto({ invoice, locale }),
        entity: invoice,
      };
    },
  },
  credit_note: {
    documentType: 'CREDIT_NOTE',
    ownerPermission: 'order:update',
    load: async ({ id, user, locale }) => {
      const creditNote = await creditNoteService.getById({ companyId: user.companyId, id });
      const sourceInvoiceId = creditNote?.invoiceId || creditNote?.sourceInvoice?.id || null;
      const invoice = sourceInvoiceId ? await invoiceService.get(sourceInvoiceId, user) : null;
      return {
        dto: buildCreditNoteDocumentDto({ creditNote, invoice, locale }),
        entity: creditNote,
      };
    },
  },
});

function normalizeEntityType(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'creditnote' || text === 'credit-note') return 'credit_note';
  return text;
}

function safeFilenamePart(value, fallback) {
  const text = String(value || fallback || 'document')
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 96);
  return text || fallback || 'document';
}

function getUserPermissions(user = {}) {
  const raw = user.permissions || user.permissionKeys || user.acl || [];
  if (Array.isArray(raw)) return new Set(raw.map(String));
  if (raw && typeof raw === 'object') return new Set(Object.keys(raw).filter((key) => raw[key]).map(String));
  return new Set();
}

function hasPermission(user, permission) {
  if (!permission) return true;
  if (user?.isSystem || user?.isOwner || user?.role === 'owner' || user?.role === 'admin') return true;
  const permissions = getUserPermissions(user);
  return permissions.has(permission) || permissions.has('*');
}

async function loadCompany(companyId) {
  const company = await Company.findOne({ where: { id: companyId } });
  if (!company) return {};
  const plain = company.get({ plain: true });
  return {
    name: plain.name || plain.legalName || 'Sunset',
    legalName: plain.legalName || plain.name || 'Sunset',
    nip: plain.nip || plain.taxId || '',
    regon: plain.regon || '',
    email: plain.email || '',
    phone: plain.phone || '',
    addressLine1: plain.address || plain.addressLine1 || '',
    postalCode: plain.postalCode || '',
    city: plain.city || '',
    country: plain.country || '',
  };
}

function documentNumber(entity = {}) {
  return entity.number || entity.title || entity.id || 'document';
}

function documentDate(entity = {}) {
  return entity.issueDate || entity.issuedAt || entity.createdAt || new Date();
}

async function generateForEntity({ entityType, entityId, user, locale = 'pl', templateId = null } = {}) {
  const normalizedEntityType = normalizeEntityType(entityType);
  const config = ENTITY_TYPES[normalizedEntityType];
  if (!config) {
    throw new AppError(400, 'Unsupported generated document entity type', { code: 'VALIDATION_ERROR' });
  }
  if (!user?.companyId) {
    throw new AppError(403, 'Company context required');
  }
  if (!entityId) {
    throw new AppError(400, 'entityId is required', { code: 'VALIDATION_ERROR' });
  }
  if (!hasPermission(user, config.ownerPermission)) {
    throw new AppError(403, 'Insufficient permissions');
  }

  const loaded = await config.load({ id: entityId, user, locale });
  const renderDto = loaded.dto;
  renderDto.company = {
    ...(await loadCompany(user.companyId)),
    ...(renderDto.company || {}),
  };

  const documentTypeKey = getDocumentTypeKey(renderDto.type);
  const [template, dataContext] = await Promise.all([
    resolveActiveTemplateForDocument({
      companyId: user.companyId,
      documentTypeKey,
      templateId,
    }),
    Promise.resolve(buildDocumentDataContext(renderDto)),
  ]);

  const { buffer } = await renderTemplatePdf({
    templateDraft: template.content,
    dataContext,
    renderContext: {
      mode: 'pdf',
      channel: 'pdf',
      locale: locale || renderDto.locale || template.content?.defaultLocale || 'pl',
      isEditorInteractive: false,
    },
    pdfOptions: {
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    },
  });

  const generatedAt = new Date();
  const totals = dataContext.totals || {};
  const currency = dataContext.document?.currency || renderDto.currency || 'PLN';

  const document = await Document.create({
    companyId: user.companyId,
    type: config.documentType,
    direction: 'sale',
    status: 'generated',
    number: documentNumber(loaded.entity),
    clientId: loaded.entity?.counterpartyId || loaded.entity?.customerId || loaded.entity?.customer?.id || null,
    issueDate: new Date(documentDate(loaded.entity)).toISOString().slice(0, 10),
    currency,
    language: locale || renderDto.locale || 'pl',
    template: template.templateId || null,
    templateVersionId: template.templateVersionId || null,
    sourceEntityType: normalizedEntityType,
    sourceEntityId: entityId,
    ownerId: user.id,
    createdBy: user.id,
    updatedBy: user.id,
    generatedBy: user.id,
    generatedAt,
    totalNet: totals.net || 0,
    totalVat: totals.vat || 0,
    totalGross: totals.gross || 0,
    totalDiscount: 0,
  });

  try {
    const filename = `${safeFilenamePart(normalizedEntityType)}-${safeFilenamePart(document.number, document.id)}.pdf`;
    const file = await fileService.createFromBuffer({
      buffer,
      filename,
      mime: 'application/pdf',
      ownerType: 'document',
      ownerId: document.id,
      purpose: 'document',
      visibility: 'private',
      companyId: user.companyId,
      user,
      enforcePolicy: false,
    });

    await document.update({ fileId: file.id });
    const reloaded = await Document.findByPk(document.id);

    return {
      document: reloaded ? reloaded.get({ plain: true }) : { ...document.get({ plain: true }), fileId: file.id },
      file,
      metadata: {
        entity: normalizedEntityType,
        entityId,
        type: config.documentType,
        generatedAt,
        generatedBy: user.id,
        fileId: file.id,
        templateVersion: template.templateVersionId || null,
        locale: locale || renderDto.locale || 'pl',
      },
    };
  } catch (error) {
    await document.destroy().catch(() => {});
    throw error;
  }
}

module.exports = {
  generateForEntity,
};
