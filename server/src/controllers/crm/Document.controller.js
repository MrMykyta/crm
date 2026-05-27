'use strict';

const documentService = require('../../services/crm/documentService');
const {
  resolveActiveTemplateForDocument,
  documentTypeToTemplateKey,
} = require('../../services/documents/template/activeTemplateResolver.service');
const { buildRenderContextForDocument } = require('../../services/documents/renderContext/documentRenderContext.service');

module.exports.list = async (req, res, next) => {
  try {
    const data = await documentService.list({
      query: req.query || {},
      companyId: req.user.companyId,
    });
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.create = async (req, res, next) => {
  try {
    const data = await documentService.create({
      payload: req.body || {},
      user: req.user,
    });
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.getById = async (req, res, next) => {
  try {
    const data = await documentService.getById({
      id: req.params.id,
      companyId: req.user.companyId,
    });
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.update = async (req, res, next) => {
  try {
    const data = await documentService.update({
      id: req.params.id,
      payload: req.body || {},
      user: req.user,
    });
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.convert = async (req, res, next) => {
  try {
    const data = await documentService.convert({
      id: req.params.id,
      payload: req.body || {},
      user: req.user,
    });
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.getRenderTemplate = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const documentId = req.params.id;
    const queryTemplateId = req.query?.templateId || null;
    const previewDraft = req.query?.previewDraft === 'true';

    // Verify document belongs to company and get its type
    const document = await documentService.getById({ id: documentId, companyId });
    const documentTypeKey = documentTypeToTemplateKey(document.type);

    const [template, dataContext] = await Promise.all([
      resolveActiveTemplateForDocument({
        companyId,
        documentTypeKey,
        templateId: queryTemplateId,
        previewDraft,
      }),
      buildRenderContextForDocument({ companyId, documentId }),
    ]);

    res.status(200).json({ template, dataContext });
  } catch (error) {
    next(error);
  }
};
