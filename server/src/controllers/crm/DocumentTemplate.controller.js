'use strict';

const AppError = require('../../errors/AppError');
const { sequelize } = require('../../db/models');
const templateService = require('../../services/documents/template/template.service');
const { setCompanyDefaultTemplate } = templateService;
const templateDraftService = require('../../services/documents/template/templateDraft.service');
const templateVersionService = require('../../services/documents/template/templateVersion.service');
const { buildInitialTemplateDraft } = require('../../services/documents/template/defaultTemplateLoader');
const {
  getDocumentType,
  hasDocumentType,
} = require('../../services/documents/templateRegistry/documentTypeRegistry');

function toPlain(entity) {
  if (!entity) return entity;
  if (typeof entity.get === 'function') return entity.get({ plain: true });
  return entity;
}

function debugLog(message, payload = {}) {
  if (process.env.NODE_ENV === 'test') return;
  console.info(`[document-template] ${message}`, payload);
}

function parsePositiveInt(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

function countSections(content) {
  return Array.isArray(content?.sections) ? content.sections.length : 0;
}

function cloneDraftContent(content, { templateName, documentTypeKey }) {
  const cloned = JSON.parse(JSON.stringify(content || {}));
  cloned.templateName = templateName;
  cloned.documentTypeKey = documentTypeKey;
  return cloned;
}

function requiresDefaultBootstrap(documentTypeKey) {
  const key = String(documentTypeKey || '').trim().toLowerCase();
  return key === 'faktura_vat' || key === 'oferta';
}

function toDraftResponseItem(draft) {
  const plain = toPlain(draft) || {};
  return {
    templateId: plain.templateId ?? null,
    content: plain.content ?? null,
    schemaVersion: plain.schemaVersion ?? null,
    updatedAt: plain.updatedAt ?? null,
    updatedBy: plain.updatedBy ?? null,
  };
}

function buildInitialDraft({ template }) {
  const resolvedType = getDocumentType(template.documentTypeKey);
  const defaultLocale = String(resolvedType?.capabilities?.defaultLocale || 'pl');
  const defaultDraft = buildInitialTemplateDraft({
    templateName: template.name,
    documentTypeKey: template.documentTypeKey,
    defaultLocale,
  });

  if (defaultDraft) {
    debugLog('buildInitialDraft:fromDefault', {
      documentTypeKey: template.documentTypeKey,
      sectionsCount: countSections(defaultDraft),
    });
    return defaultDraft;
  }

  if (requiresDefaultBootstrap(template.documentTypeKey)) {
    throw new AppError(
      500,
      `Default template bootstrap not found for documentTypeKey: ${template.documentTypeKey}`
    );
  }

  debugLog('buildInitialDraft:fallbackGeneric', {
    documentTypeKey: template.documentTypeKey,
  });

  return {
    templateName: String(template.name || 'Template'),
    documentTypeKey: String(template.documentTypeKey),
    schemaVersion: 1,
    defaultLocale,
    page: {
      size: 'A4',
      orientation: 'portrait',
      margins: {
        top: 20,
        right: 15,
        bottom: 20,
        left: 15,
      },
    },
    sections: [],
    styleTokens: {
      colorPrimary: '#1a2744',
      fontSizeBase: 10,
    },
    locales: {
      [defaultLocale]: {},
    },
    printSettings: {
      headerRepeat: true,
      tableHeaderRepeat: true,
      pageBreakBefore: [],
      orphanControl: true,
    },
    legalConstraints: {
      inherited: true,
      documentTypeKey: String(template.documentTypeKey),
      overrides: [],
    },
  };
}

async function ensureTemplateAccess({ templateId, companyId, transaction }) {
  if (!isUuid(templateId)) {
    throw new AppError(400, 'templateId must be a valid UUID');
  }

  const template = await templateService.getTemplateById({
    templateId,
    companyId,
    includeArchived: true,
    transaction,
  });
  if (!template) {
    throw new AppError(404, 'Template not found');
  }
  return template;
}

module.exports.list = async (req, res, next) => {
  try {
    const limit = parsePositiveInt(req.query?.limit, 50, { min: 1, max: 200 });
    const offset = parsePositiveInt(req.query?.offset, 0, { min: 0, max: 100000 });

    const items = await templateService.listTemplates({
      companyId: req.user.companyId,
      documentTypeKey: req.query?.documentTypeKey || null,
      status: req.query?.status || null,
      scope: req.query?.scope || null,
      limit,
      offset,
    });

    res.status(200).json({
      items: (items || []).map((item) => toPlain(item)),
    });
  } catch (error) {
    next(error);
  }
};

module.exports.create = async (req, res, next) => {
  try {
    const documentTypeKey = String(req.body?.documentTypeKey || '').trim();
    const name = String(req.body?.name || '').trim();

    if (!documentTypeKey) {
      throw new AppError(400, 'documentTypeKey is required');
    }
    if (!name) {
      throw new AppError(400, 'name is required');
    }
    if (!hasDocumentType(documentTypeKey)) {
      throw new AppError(422, `Unknown documentTypeKey: ${documentTypeKey}`);
    }

    const template = await templateService.createTemplate({
      companyId: req.user.companyId,
      documentTypeKey,
      name,
      createdBy: req.user?.id || null,
    });

    const templatePlain = toPlain(template);
    const initialDraft = buildInitialDraft({ template: templatePlain });
    const initialSectionsCount = countSections(initialDraft);
    debugLog('create:initialDraftBuilt', {
      templateId: templatePlain.id,
      documentTypeKey,
      sectionsCount: initialSectionsCount,
    });
    if (documentTypeKey === 'faktura_vat' && initialSectionsCount <= 0) {
      throw new AppError(500, 'Default faktura_vat draft is invalid: sections are empty.');
    }

    await templateDraftService.saveDraft({
      templateId: templatePlain.id,
      content: initialDraft,
      schemaVersion: initialDraft.schemaVersion,
      updatedBy: req.user?.id || null,
    });
    debugLog('create:draftSaved', {
      templateId: templatePlain.id,
      documentTypeKey,
      savedSectionsCount: initialSectionsCount,
    });

    res.status(201).json({ item: templatePlain });
  } catch (error) {
    next(error);
  }
};

module.exports.duplicate = async (req, res, next) => {
  try {
    const copyPlain = await sequelize.transaction(async (transaction) => {
      const sourceTemplate = await ensureTemplateAccess({
        templateId: req.params.templateId,
        companyId: req.user.companyId,
        transaction,
      });
      const sourcePlain = toPlain(sourceTemplate);
      const requestedName = String(req.body?.name || '').trim();
      const copyName = requestedName || `${sourcePlain.name || 'Template'} — Copy`;

      const copy = await templateService.createTemplate({
        companyId: req.user.companyId,
        documentTypeKey: sourcePlain.documentTypeKey,
        name: copyName,
        description: sourcePlain.description || null,
        status: 'draft',
        scope: 'custom',
        createdBy: req.user?.id || null,
        transaction,
      });
      const createdPlain = toPlain(copy);

      const sourceDraft = await templateDraftService.getDraftByTemplateId({
        templateId: sourcePlain.id,
        transaction,
      });

      let content = sourceDraft?.content || null;
      if (!content && sourcePlain.currentVersionId) {
        const version = await templateVersionService.getVersionById({
          versionId: sourcePlain.currentVersionId,
          includeContent: true,
          transaction,
        });
        content = version?.content || null;
      }
      if (!content) {
        content = buildInitialDraft({ template: sourcePlain });
      }

      const clonedContent = cloneDraftContent(content, {
        templateName: copyName,
        documentTypeKey: sourcePlain.documentTypeKey,
      });

      await templateDraftService.saveDraft({
        templateId: createdPlain.id,
        content: clonedContent,
        schemaVersion: clonedContent.schemaVersion,
        updatedBy: req.user?.id || null,
        transaction,
      });

      return createdPlain;
    });

    res.status(201).json({ item: copyPlain });
  } catch (error) {
    next(error);
  }
};

module.exports.getById = async (req, res, next) => {
  try {
    const template = await ensureTemplateAccess({
      templateId: req.params.templateId,
      companyId: req.user.companyId,
    });
    res.status(200).json({ item: toPlain(template) });
  } catch (error) {
    next(error);
  }
};

module.exports.getDraft = async (req, res, next) => {
  try {
    const template = await ensureTemplateAccess({
      templateId: req.params.templateId,
      companyId: req.user.companyId,
    });
    const templatePlain = toPlain(template);

    let draft = await templateDraftService.getDraftByTemplateId({
      templateId: req.params.templateId,
    });

    const hasSections = countSections(draft?.content) > 0;
    if (!draft || !hasSections) {
      debugLog('getDraft:repairNeeded', {
        templateId: req.params.templateId,
        reason: !draft ? 'missing_draft' : 'empty_sections',
        currentSectionsCount: countSections(draft?.content),
      });

      const initialDraft = buildInitialDraft({ template: templatePlain });
      const rebuiltSectionsCount = countSections(initialDraft);
      const saved = await templateDraftService.saveDraft({
        templateId: req.params.templateId,
        content: initialDraft,
        schemaVersion: initialDraft.schemaVersion,
        updatedBy: req.user?.id || null,
      });
      draft = toPlain(saved);
      debugLog('getDraft:repairSaved', {
        templateId: req.params.templateId,
        savedSectionsCount: rebuiltSectionsCount,
      });
    }

    res.status(200).json({ item: toDraftResponseItem(draft) });
  } catch (error) {
    next(error);
  }
};

module.exports.saveDraft = async (req, res, next) => {
  try {
    await ensureTemplateAccess({
      templateId: req.params.templateId,
      companyId: req.user.companyId,
    });

    const saved = await templateDraftService.saveDraft({
      templateId: req.params.templateId,
      content: req.body?.content,
      schemaVersion: req.body?.schemaVersion,
      updatedBy: req.user?.id || null,
    });

    res.status(200).json({ item: toPlain(saved) });
  } catch (error) {
    next(error);
  }
};

module.exports.remove = async (req, res, next) => {
  try {
    await ensureTemplateAccess({
      templateId: req.params.templateId,
      companyId: req.user.companyId,
    });

    await templateService.deleteTemplate({
      templateId: req.params.templateId,
      companyId: req.user.companyId,
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

module.exports.setAsDefault = async (req, res, next) => {
  try {
    const template = await ensureTemplateAccess({
      templateId: req.params.templateId,
      companyId: req.user.companyId,
    });
    const templatePlain = toPlain(template);
    if (templatePlain.status === 'archived') {
      throw new AppError(422, 'Cannot set an archived template as default');
    }

    const updated = await setCompanyDefaultTemplate({
      templateId: req.params.templateId,
      companyId: req.user.companyId,
    });

    res.status(200).json({ item: toPlain(updated) });
  } catch (error) {
    next(error);
  }
};

module.exports.publish = async (req, res, next) => {
  try {
    const template = await ensureTemplateAccess({
      templateId: req.params.templateId,
      companyId: req.user.companyId,
    });

    const createdVersion = await templateVersionService.createVersionFromDraft({
      templateId: req.params.templateId,
      publisherId: req.user?.id || null,
      changelog: typeof req.body?.changelog === 'string' ? req.body.changelog : null,
      activate: true,
    });

    const freshTemplate = await templateService.getTemplateById({
      templateId: req.params.templateId,
      companyId: req.user.companyId,
      includeArchived: true,
    });

    const createdVersionPlain = toPlain(createdVersion) || {};
    const templatePlain = toPlain(freshTemplate) || toPlain(template) || {};

    res.status(200).json({
      item: {
        templateId: templatePlain.id || req.params.templateId,
        currentVersionId: templatePlain.currentVersionId || createdVersionPlain.id || null,
        status: templatePlain.status || 'published',
        version: {
          id: createdVersionPlain.id || null,
          versionNumber: createdVersionPlain.versionNumber || null,
          schemaVersion: createdVersionPlain.schemaVersion || null,
          publishedAt: createdVersionPlain.publishedAt || null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
