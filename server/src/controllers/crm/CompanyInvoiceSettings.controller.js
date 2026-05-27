'use strict';

const companyInvoiceSettingsService = require('../../services/crm/companyInvoiceSettingsService');

module.exports.get = async (req, res, next) => {
  try {
    const data = await companyInvoiceSettingsService.getCompanyInvoiceSettings({
      companyId: req.user.companyId,
    });
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.update = async (req, res, next) => {
  try {
    const data = await companyInvoiceSettingsService.updateCompanyInvoiceSettings({
      companyId: req.user.companyId,
      payload: req.body || {},
    });
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

