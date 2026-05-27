'use strict';

const companyOfferSettingsService = require('../../services/crm/companyOfferSettingsService');

module.exports.get = async (req, res, next) => {
  try {
    const data = await companyOfferSettingsService.getCompanyOfferSettings({
      companyId: req.user.companyId,
    });
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.update = async (req, res, next) => {
  try {
    const data = await companyOfferSettingsService.updateCompanyOfferSettings({
      companyId: req.user.companyId,
      payload: req.body || {},
    });
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};
