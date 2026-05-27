'use strict';

const companyWarehouseDocumentSettingsService = require('../../services/crm/companyWarehouseDocumentSettingsService');

module.exports.get = async (req, res, next) => {
  try {
    const data = await companyWarehouseDocumentSettingsService.getCompanyWarehouseDocumentSettings({
      companyId: req.user.companyId,
    });
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.update = async (req, res, next) => {
  try {
    const data = await companyWarehouseDocumentSettingsService.updateCompanyWarehouseDocumentSettings({
      companyId: req.user.companyId,
      payload: req.body || {},
    });
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};
