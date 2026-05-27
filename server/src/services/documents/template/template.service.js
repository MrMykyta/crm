'use strict';

const { Op } = require('sequelize');
const { Template } = require('../../../db/models');
const AppError = require('../../../errors/AppError');

async function createTemplate({
  companyId,
  documentTypeKey,
  name,
  description = null,
  status = 'draft',
  scope = 'custom',
  createdBy = null,
  transaction,
}) {
  if (companyId === null || companyId === undefined) {
    throw new AppError(400, 'companyId is required');
  }
  if (documentTypeKey === null || documentTypeKey === undefined || String(documentTypeKey).trim() === '') {
    throw new AppError(400, 'documentTypeKey is required');
  }
  if (name === null || name === undefined || String(name).trim() === '') {
    throw new AppError(400, 'name is required');
  }

  return Template.create(
    {
      companyId,
      documentTypeKey: String(documentTypeKey).trim(),
      name: String(name).trim(),
      description,
      status,
      scope,
      createdBy,
    },
    { transaction }
  );
}

async function getTemplateById({ templateId, companyId = null, includeArchived = true, transaction }) {
  if (templateId === null || templateId === undefined) {
    throw new AppError(400, 'templateId is required');
  }

  const where = { id: templateId };
  if (companyId !== null && companyId !== undefined) where.companyId = companyId;
  if (includeArchived === false) {
    where.status = { [Op.in]: ['draft', 'published'] };
  }

  return Template.findOne({ where, transaction });
}

async function listTemplates({
  companyId,
  documentTypeKey = null,
  status = null,
  scope = null,
  limit = 50,
  offset = 0,
  transaction,
}) {
  if (companyId === null || companyId === undefined) {
    throw new AppError(400, 'companyId is required');
  }

  const where = { companyId };
  if (documentTypeKey !== null && documentTypeKey !== undefined) where.documentTypeKey = documentTypeKey;
  if (status !== null && status !== undefined) where.status = status;
  if (scope !== null && scope !== undefined) where.scope = scope;

  return Template.findAll({
    where,
    order: [['updatedAt', 'DESC']],
    limit,
    offset,
    transaction,
  });
}

async function updateTemplateMeta({ templateId, companyId, patch = {}, transaction }) {
  if (templateId === null || templateId === undefined) {
    throw new AppError(400, 'templateId is required');
  }

  const template = await Template.findOne({
    where: {
      id: templateId,
      ...(companyId !== undefined && companyId !== null ? { companyId } : {}),
    },
    transaction,
  });

  if (template === null) {
    throw new AppError(404, 'Template not found');
  }

  const allowedPatch = {};
  if (Object.prototype.hasOwnProperty.call(patch, 'name')) allowedPatch.name = patch.name;
  if (Object.prototype.hasOwnProperty.call(patch, 'description')) allowedPatch.description = patch.description;
  if (Object.prototype.hasOwnProperty.call(patch, 'status')) allowedPatch.status = patch.status;
  if (Object.prototype.hasOwnProperty.call(patch, 'scope')) allowedPatch.scope = patch.scope;

  await template.update(allowedPatch, { transaction });
  return template;
}

async function archiveTemplate({ templateId, companyId = null, transaction }) {
  const template = await getTemplateById({
    templateId,
    companyId,
    includeArchived: true,
    transaction,
  });

  if (template === null) {
    throw new AppError(404, 'Template not found');
  }

  await template.update({ status: 'archived' }, { transaction });
  return template;
}

async function deleteTemplate({ templateId, companyId, transaction }) {
  if (templateId === null || templateId === undefined) {
    throw new AppError(400, 'templateId is required');
  }
  if (companyId === null || companyId === undefined) {
    throw new AppError(400, 'companyId is required');
  }

  return Template.destroy({
    where: {
      id: templateId,
      companyId,
    },
    transaction,
  });
}

async function setCompanyDefaultTemplate({ templateId, companyId, transaction }) {
  if (!templateId) throw new AppError(400, 'templateId is required');
  if (!companyId) throw new AppError(400, 'companyId is required');

  const template = await Template.findOne({
    where: { id: templateId, companyId, status: { [Op.ne]: 'archived' } },
    transaction,
  });
  if (!template) throw new AppError(404, 'Template not found or is archived');

  const { documentTypeKey } = template;

  // Unset any existing company_default for this type
  await Template.update(
    { scope: 'custom' },
    {
      where: { companyId, documentTypeKey, scope: 'company_default' },
      transaction,
    }
  );

  await template.update({ scope: 'company_default' }, { transaction });
  return template;
}

module.exports = {
  createTemplate,
  getTemplateById,
  listTemplates,
  updateTemplateMeta,
  archiveTemplate,
  deleteTemplate,
  setCompanyDefaultTemplate,
};
