'use strict';

const companyOrderSettingsService = require('../../services/crm/companyOrderSettingsService');

module.exports.get = async (req, res, next) => {
  try {
    const data = await companyOrderSettingsService.getCompanyOrderSettings({
      companyId: req.user.companyId,
    });
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.update = async (req, res, next) => {
  try {
    const data = await companyOrderSettingsService.updateCompanyOrderSettings({
      companyId: req.user.companyId,
      payload: req.body || {},
    });
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};
