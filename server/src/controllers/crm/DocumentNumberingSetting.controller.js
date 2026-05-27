'use strict';

const documentNumberingService = require('../../services/crm/documentNumberingService');

module.exports.list = async (req, res, next) => {
  try {
    const items = await documentNumberingService.listCompanyNumberingSettings({
      companyId: req.user.companyId,
    });
    res.status(200).json({ items });
  } catch (error) {
    next(error);
  }
};

module.exports.update = async (req, res, next) => {
  try {
    const items = await documentNumberingService.updateCompanyNumberingSettings({
      companyId: req.user.companyId,
      payload: req.body || {},
    });
    res.status(200).json({ items });
  } catch (error) {
    next(error);
  }
};

module.exports.updateByType = async (req, res, next) => {
  try {
    const item = await documentNumberingService.updateCompanyNumberingSetting({
      companyId: req.user.companyId,
      documentType: req.params.documentType,
      payload: req.body || {},
    });
    res.status(200).json(item);
  } catch (error) {
    next(error);
  }
};

module.exports.preview = async (req, res, next) => {
  try {
    const preview = await documentNumberingService.previewNextDocumentNumber({
      companyId: req.user.companyId,
      documentType: req.body?.documentType,
      pattern: req.body?.pattern,
      issueDate: req.body?.issueDate,
    });
    res.status(200).json(preview);
  } catch (error) {
    next(error);
  }
};

module.exports.bootstrap = async (req, res, next) => {
  try {
    const items = await documentNumberingService.bootstrapCompanyNumberingSettings({
      companyId: req.user.companyId,
    });
    res.status(200).json({ items });
  } catch (error) {
    next(error);
  }
};

module.exports.rebuild = async (req, res, next) => {
  try {
    const items = await documentNumberingService.rebuildCompanyNumberingSettings({
      companyId: req.user.companyId,
      payload: req.body || {},
    });
    res.status(200).json({ items });
  } catch (error) {
    next(error);
  }
};
