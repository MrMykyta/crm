'use strict';

const crypto = require('crypto');
const {
  sequelize,
  Template,
  TemplateVersion,
  TemplateVersionContent,
  TemplateDraft,
} = require('../../../db/models');
const AppError = require('../../../errors/AppError');
const {
  parseTemplateVersionContent,
} = require('./templateVersionParser');
const { validateTemplateDraft } = require('../validation/validation.service');

function sortForCanonicalHash(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sortForCanonicalHash(item));
  }

  const isObject = value !== null && typeof value === 'object';
  if (isObject) {
    const out = {};
    const keys = Object.keys(value).sort();
    for (const key of keys) {
      out[key] = sortForCanonicalHash(value[key]);
    }
    return out;
  }

  return value;
}

function computeContentHash(content) {
  const canonical = JSON.stringify(sortForCanonicalHash(content));
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

async function listVersions({ templateId, limit = 100, offset = 0, transaction }) {
  if (templateId === null || templateId === undefined) {
    throw new AppError(400, 'templateId is required');
  }

  return TemplateVersion.findAll({
    where: { templateId },
    order: [['versionNumber', 'DESC']],
    limit,
    offset,
    transaction,
  });
}

async function getVersionById({ versionId, includeContent = true, transaction }) {
  if (versionId === null || versionId === undefined) {
    throw new AppError(400, 'versionId is required');
  }

  const versionRow = await TemplateVersion.findByPk(versionId, { transaction });
  if (versionRow === null) {
    return null;
  }

  if (includeContent === false) {
    return versionRow;
  }

  const contentRow = await TemplateVersionContent.findByPk(versionId, { transaction });

  return {
    ...versionRow.get({ plain: true }),
    content: contentRow ? parseTemplateVersionContent(contentRow.content) : null,
  };
}

async function createVersionFromDraft({
  templateId,
  publisherId = null,
  changelog = null,
  activate = true,
  transaction: externalTransaction,
}) {
  if (templateId === null || templateId === undefined) {
    throw new AppError(400, 'templateId is required');
  }

  const execute = async (transaction) => {
    const template = await Template.findByPk(templateId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (template === null) {
      throw new AppError(404, 'Template not found');
    }

    const draft = await TemplateDraft.findByPk(templateId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (draft === null) {
      throw new AppError(404, 'Template draft not found');
    }

    const parsedContent = parseTemplateVersionContent(draft.content);
    const validationResult = validateTemplateDraft({
      templateDraft: parsedContent,
      documentTypeKey: parsedContent.documentTypeKey || template.documentTypeKey,
    });

    const blockingIssues = validationResult.issues.filter(
      (issue) => issue && issue.severity === 'BLOCKING'
    );

    if (blockingIssues.length > 0) {
      throw new AppError(422, 'Template draft contains blocking validation issues', {
        code: 'TEMPLATE_DRAFT_INVALID',
        details: {
          issues: blockingIssues,
        },
      });
    }

    const contentHash = computeContentHash(parsedContent);

    const maxVersionNumber = await TemplateVersion.max('versionNumber', {
      where: { templateId },
      transaction,
    });

    const nextVersionNumber = (Number.isFinite(maxVersionNumber) ? maxVersionNumber : 0) + 1;

    const versionRow = await TemplateVersion.create(
      {
        templateId,
        versionNumber: nextVersionNumber,
        schemaVersion: Number(parsedContent.schemaVersion) || Number(draft.schemaVersion) || 1,
        status: 'published',
        contentHash,
        publisherId,
        publishedAt: new Date(),
        changelog,
      },
      { transaction }
    );

    await TemplateVersionContent.create(
      {
        templateVersionId: versionRow.id,
        content: parsedContent,
      },
      { transaction }
    );

    if (activate) {
      await template.update(
        {
          currentVersionId: versionRow.id,
          status: 'published',
        },
        { transaction }
      );
    }

    return versionRow;
  };

  if (externalTransaction) {
    return execute(externalTransaction);
  }

  return sequelize.transaction(async (transaction) => execute(transaction));
}

async function activateVersion({ templateId, versionId, companyId = null, transaction }) {
  if (templateId === null || templateId === undefined) {
    throw new AppError(400, 'templateId is required');
  }
  if (versionId === null || versionId === undefined) {
    throw new AppError(400, 'versionId is required');
  }

  const template = await Template.findOne({
    where: {
      id: templateId,
      ...(companyId !== null && companyId !== undefined ? { companyId } : {}),
    },
    transaction,
  });

  if (template === null) {
    throw new AppError(404, 'Template not found');
  }

  const version = await TemplateVersion.findOne({
    where: { id: versionId, templateId },
    transaction,
  });

  if (version === null) {
    throw new AppError(404, 'Template version not found');
  }

  await template.update(
    {
      currentVersionId: versionId,
      status: 'published',
    },
    { transaction }
  );

  return template;
}

module.exports = {
  listVersions,
  getVersionById,
  createVersionFromDraft,
  activateVersion,
  computeContentHash,
};
