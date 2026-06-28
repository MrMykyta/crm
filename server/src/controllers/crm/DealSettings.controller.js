'use strict';

const dealSettingsService = require('../../services/crm/dealSettingsService');

module.exports.get = async (req, res, next) => {
  try {
    res.status(200).json(await dealSettingsService.getSettings(req.user.companyId));
  } catch (error) {
    next(error);
  }
};

module.exports.update = async (req, res, next) => {
  try {
    res.status(200).json(await dealSettingsService.updateSettings(req.user.companyId, req.body || {}));
  } catch (error) {
    next(error);
  }
};

module.exports.listLostReasons = async (req, res, next) => {
  try {
    res.status(200).json(await dealSettingsService.listLostReasons(req.user.companyId));
  } catch (error) {
    next(error);
  }
};

module.exports.createLostReason = async (req, res, next) => {
  try {
    res.status(201).json(await dealSettingsService.createLostReason(req.user.companyId, req.body || {}));
  } catch (error) {
    next(error);
  }
};

module.exports.updateLostReason = async (req, res, next) => {
  try {
    res.status(200).json(await dealSettingsService.updateLostReason(
      req.user.companyId,
      req.params.id,
      req.body || {}
    ));
  } catch (error) {
    next(error);
  }
};

module.exports.deleteLostReason = async (req, res, next) => {
  try {
    res.status(200).json(await dealSettingsService.deleteLostReason(req.user.companyId, req.params.id));
  } catch (error) {
    next(error);
  }
};

module.exports.reorderLostReasons = async (req, res, next) => {
  try {
    const orderedLostReasonIds = req.body?.orderedLostReasonIds || req.body?.lostReasonIds || req.body;
    res.status(200).json(await dealSettingsService.reorderLostReasons(req.user.companyId, orderedLostReasonIds));
  } catch (error) {
    next(error);
  }
};
