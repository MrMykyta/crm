'use strict';

const documentTemplateService = require('../../services/crm/documentTemplateService');

module.exports.list = async (req, res, next) => {
  try {
    const items = await documentTemplateService.listCompanyDocumentTemplateSettings({
      companyId: req.user.companyId,
    });
    res.status(200).json({ items });
  } catch (error) {
    next(error);
  }
};

module.exports.update = async (req, res, next) => {
  try {
    const items = await documentTemplateService.updateCompanyDocumentTemplateSettings({
      companyId: req.user.companyId,
      payload: req.body || {},
    });
    res.status(200).json({ items });
  } catch (error) {
    next(error);
  }
};
