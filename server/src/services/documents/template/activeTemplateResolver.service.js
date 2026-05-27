'use strict';

const { Op } = require('sequelize');
const { Template, TemplateVersionContent } = require('../../../db/models');
const { buildInitialTemplateDraft } = require('./defaultTemplateLoader');
const { parseTemplateVersionContent } = require('./templateVersionParser');
const { getDraftByTemplateId } = require('./templateDraft.service');
const AppError = require('../../../errors/AppError');

// Maps document model type (uppercase) to template documentTypeKey.
const DOC_TYPE_TO_TEMPLATE_KEY = {
  INVOICE: 'faktura_vat',
  QUOTE:   'oferta',
  ORDER:   'zamowienie',
  // Warehouse documents — all subtypes share the 'wz' template family for now.
  WZ: 'wz',
  PZ: 'wz',
  MM: 'wz',
  RW: 'wz',
  PW: 'wz',
};

function documentTypeToTemplateKey(docType) {
  return DOC_TYPE_TO_TEMPLATE_KEY[String(docType || '').trim().toUpperCase()] || null;
}

async function resolveActiveTemplateForDocument({
  companyId,
  documentTypeKey,
  templateId = null,
  previewDraft = false,
  transaction = null,
}) {
  // 1. Explicit templateId provided
  if (templateId) {
    const template = await Template.findOne({
      where: {
        id: templateId,
        companyId,
        status: { [Op.ne]: 'archived' },
      },
      transaction,
    });
    if (!template) throw new AppError(404, 'Template not found or is archived');

    const plain = template.get({ plain: true });

    if (plain.currentVersionId) {
      const contentRow = await TemplateVersionContent.findByPk(plain.currentVersionId, { transaction });
      if (contentRow) {
        return {
          source: 'selected',
          templateId: plain.id,
          templateVersionId: plain.currentVersionId,
          documentTypeKey: plain.documentTypeKey,
          content: parseTemplateVersionContent(contentRow.content),
        };
      }
    }

    // No published version yet — use draft only in preview mode.
    // TODO(template-versions): replace draft fallback with immutable TemplateVersionContent once
    //   version history is fully wired. Draft should never be used for real document rendering.
    if (previewDraft) {
      const draft = await getDraftByTemplateId({ templateId: plain.id, transaction });
      if (draft?.content) {
        return {
          source: 'selected',
          templateId: plain.id,
          templateVersionId: null,
          documentTypeKey: plain.documentTypeKey,
          content: draft.content,
        };
      }
    }
    // fall through — templateId had no usable content
  }

  // 2. Company template for documentTypeKey
  if (documentTypeKey) {
    // Prefer company_default scope first
    const defaultTemplate = await Template.findOne({
      where: {
        companyId,
        documentTypeKey,
        scope: 'company_default',
        status: { [Op.ne]: 'archived' },
      },
      transaction,
    });

    if (defaultTemplate?.currentVersionId) {
      const contentRow = await TemplateVersionContent.findByPk(defaultTemplate.currentVersionId, { transaction });
      if (contentRow) {
        return {
          source: 'company_default',
          templateId: defaultTemplate.id,
          templateVersionId: defaultTemplate.currentVersionId,
          documentTypeKey,
          content: parseTemplateVersionContent(contentRow.content),
        };
      }
    }

    // Fall back to newest published template for this type
    const publishedTemplate = await Template.findOne({
      where: {
        companyId,
        documentTypeKey,
        status: 'published',
      },
      order: [['updatedAt', 'DESC']],
      transaction,
    });

    if (publishedTemplate?.currentVersionId) {
      const contentRow = await TemplateVersionContent.findByPk(publishedTemplate.currentVersionId, { transaction });
      if (contentRow) {
        return {
          source: 'company_default',
          templateId: publishedTemplate.id,
          templateVersionId: publishedTemplate.currentVersionId,
          documentTypeKey,
          content: parseTemplateVersionContent(contentRow.content),
        };
      }
    }
  }

  // 3. System default JSON
  const effectiveTypeKey = documentTypeKey || 'faktura_vat';
  const systemDefault = buildInitialTemplateDraft({
    templateName: 'Default',
    documentTypeKey: effectiveTypeKey,
    defaultLocale: 'pl',
  });

  if (!systemDefault) {
    throw new AppError(500, `No template available for documentTypeKey: ${effectiveTypeKey}`);
  }

  return {
    source: 'system_default',
    templateId: null,
    templateVersionId: null,
    documentTypeKey: effectiveTypeKey,
    content: systemDefault,
  };
}

module.exports = {
  resolveActiveTemplateForDocument,
  documentTypeToTemplateKey,
};
