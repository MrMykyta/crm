'use strict';

const express = require('express');
const CompanyOfferSettingsController = require('../../controllers/crm/CompanyOfferSettings.controller');
const { requireMember } = require('../../middleware/requireMember');
const authorize = require('../../middleware/authorize');
const validateBody = require('../../middleware/validateBody');
const companyOfferSettingsSchema = require('../../schemas/companyOfferSettingsSchema');

const router = express.Router();

router.get('/', requireMember, authorize('company:settings:read'), CompanyOfferSettingsController.get);
router.put(
  '/',
  requireMember,
  authorize('company:settings:update'),
  validateBody(companyOfferSettingsSchema.update),
  CompanyOfferSettingsController.update
);

module.exports = router;
