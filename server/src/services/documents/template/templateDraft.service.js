'use strict';

const { TemplateDraft } = require('../../../db/models');
const AppError = require('../../../errors/AppError');
const {
  parseTemplateVersionContent,
} = require('./templateVersionParser');

function debugLog(message, payload = {}) {
  if (process.env.NODE_ENV === 'test') return;
  console.info(`[template-draft] ${message}`, payload);
}

function countSections(content) {
  return Array.isArray(content?.sections) ? content.sections.length : 0;
}

async function getDraftByTemplateId({ templateId, transaction }) {
  if (templateId === null || templateId === undefined) {
    throw new AppError(400, 'templateId is required');
  }

  const draftRow = await TemplateDraft.findByPk(templateId, { transaction });
  if (draftRow === null) {
    return null;
  }

  const parsedContent = parseTemplateVersionContent(draftRow.content);

  return {
    ...draftRow.get({ plain: true }),
    content: parsedContent,
  };
}

async function saveDraft({ templateId, content, schemaVersion, updatedBy = null, transaction }) {
  if (templateId === null || templateId === undefined) {
    throw new AppError(400, 'templateId is required');
  }

  const parsedContent = parseTemplateVersionContent(content);
  const derivedSchemaVersion = Number(parsedContent.schemaVersion) || 1;
  const sectionsCount = countSections(parsedContent);
  if (
    schemaVersion !== undefined &&
    schemaVersion !== null &&
    Number(schemaVersion) !== derivedSchemaVersion
  ) {
    throw new AppError(422, 'schemaVersion must match parsed content schemaVersion');
  }
  const now = new Date();

  const existing = await TemplateDraft.findByPk(templateId, { transaction });

  if (existing === null) {
    debugLog('saveDraft:create', {
      templateId,
      schemaVersion: derivedSchemaVersion,
      sectionsCount,
      updatedBy,
    });
    return TemplateDraft.create(
      {
        templateId,
        content: parsedContent,
        schemaVersion: derivedSchemaVersion,
        updatedAt: now,
        updatedBy,
      },
      { transaction }
    );
  }

  debugLog('saveDraft:update', {
    templateId,
    schemaVersion: derivedSchemaVersion,
    sectionsCount,
    updatedBy,
  });
  await existing.update(
    {
      content: parsedContent,
      schemaVersion: derivedSchemaVersion,
      updatedAt: now,
      updatedBy,
    },
    { transaction }
  );

  return existing;
}

async function deleteDraft({ templateId, transaction }) {
  if (templateId === null || templateId === undefined) {
    throw new AppError(400, 'templateId is required');
  }

  return TemplateDraft.destroy({
    where: { templateId },
    transaction,
  });
}

module.exports = {
  getDraftByTemplateId,
  saveDraft,
  deleteDraft,
};
